import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";
import * as Option from "effect/Option";
import {
  DEFAULT_SERVER_SETTINGS,
  ModelPickerPresentation,
  ProviderInstanceId,
  ProviderDriverKind,
  type ModelSelection,
  type ServerConfig,
  ServerConfigProviderStatusesPayload,
} from "@t3tools/contracts";
import {
  resolveModelPickerPresets,
  samePickerSelection,
} from "@t3tools/client-runtime/model-picker";
import { applyServerConfigProjection } from "../../../../packages/client-runtime/src/state/serverConfigProjection";
import { pickerPresetRows } from "../../../web/src/components/chat/modelPickerPresentation";
import type { ProviderInstanceEntry } from "../../../web/src/providerInstances";
import catalog from "../../../web/src/components/chat/fixtures/localPickerCatalog.json";
import payload from "../../../server/src/provider/modelPickerPresentation.json";
import { modelPickerPresentation } from "../../../server/src/provider/modelPickerPresentation";
import {
  buildModelOptions,
  buildPresetModelOptions,
  buildModelMenuActions,
  groupByProvider,
} from "./modelOptions";

const presentation = Schema.decodeSync(ModelPickerPresentation)(payload);
const decodeStatuses = Schema.decodeUnknownSync(ServerConfigProviderStatusesPayload);
const providers = catalog.map((p) => ({
  ...p,
  driver: p.instanceId === "claudeAgent" ? "claudeAgent" : "codex",
  installed: true,
  status: "ready",
  auth: { status: "authenticated" },
  models: p.models.map((m) => ({ ...m, name: m.slug, isCustom: false })),
})) as unknown as ServerConfig["providers"];
const entries = providers.map((p) => ({
  ...p,
  driverKind: p.driver,
  isAvailable: true,
})) as unknown as ProviderInstanceEntry[];
const config = {
  environment: { capabilities: {} },
  providers,
  modelPickerPresentation: presentation,
} as ServerConfig;
const current: ModelSelection = {
  instanceId: ProviderInstanceId.make("codexHigh"),
  model: "gpt-6.1-sol",
  options: [
    { id: "reasoningEffort", value: "high" },
    { id: "serviceTier", value: "priority" },
    { id: "futureOption", value: "retain" },
  ],
};

function compareConsumers(next: ModelPickerPresentation, preserve = false) {
  const web = pickerPresetRows(entries, current, preserve, next);
  const mobile = buildPresetModelOptions(
    { ...config, modelPickerPresentation: next },
    current,
    undefined,
    null,
    preserve,
  );
  expect(
    mobile.map((row) => ({
      label: row.label,
      group: row.providerLabel,
      selection: row.selection,
      disabled: row.isUnavailable,
    })),
  ).toEqual(
    web.map((row) => ({
      label: row.label,
      group: row.group,
      selection: row.selection,
      disabled: !!row.reason,
    })),
  );
  return { web, mobile };
}

describe("central picker presentation", () => {
  it("publishes the 14 ordered owner presets without mutating the runtime catalog", () => {
    const before = structuredClone(providers);
    expect(modelPickerPresentation(providers)).toEqual(presentation);
    expect(
      modelPickerPresentation(providers.filter((p) => p.instanceId !== "codexHigh")),
    ).toBeUndefined();
    const { web, mobile } = compareConsumers(presentation);
    expect(web).toHaveLength(14);
    expect(web.filter((row) => !row.reason)).toHaveLength(12);
    expect(web.filter((row) => row.reason).map((row) => row.label)).toEqual([
      "claude-fable-5-2 · high · Fast",
      "claude-fable-5-2 · medium · Fast",
    ]);
    expect(
      web
        .filter((row) => row.group === "Codex")
        .every((row) => row.selection.instanceId === "codex"),
    ).toBe(true);
    for (const row of mobile) {
      const fast = row.label.endsWith("Fast");
      if (row.providerDriver === "codex") {
        expect(row.selection.options).toEqual([
          { id: "reasoningEffort", value: row.label.includes("medium") ? "medium" : "high" },
          { id: "serviceTier", value: fast ? "priority" : "default" },
        ]);
      } else {
        expect(row.selection.options?.[0]).toEqual({
          id: "effort",
          value: row.label.includes("medium") ? "medium" : "high",
        });
        if (row.selection.model === "claude-opus-5-5" || fast)
          expect(row.selection.options?.[1]).toEqual({ id: "fastMode", value: fast });
      }
    }
    expect(providers).toEqual(before);
  });

  it("server-only reorder, relabel, replacement and disabled changes reach both consumers and deduplicate stable IDs", () => {
    const first = presentation.presets[0]!;
    const next = {
      ...presentation,
      groups: presentation.groups.map((g) => ({ ...g, label: `Central ${g.label}` })),
      presets: [
        { ...first, id: "new", label: "New server row", disabledReason: "Temporarily disabled" },
        ...presentation.presets.slice(2).toReversed(),
        first,
        first,
      ],
    };
    const { web } = compareConsumers(next);
    expect(web[0]).toMatchObject({
      id: "new",
      label: "New server row",
      group: "Central Codex",
      reason: "Temporarily disabled",
    });
    expect(web.filter((r) => r.id === first.id)).toHaveLength(1);
    expect(web.some((r) => r.id === presentation.presets[1]!.id)).toBe(false);
  });

  it("preserves saved legacy identity, outside choices and unknown options without normalization on open", () => {
    const before = structuredClone(current);
    const { web } = compareConsumers(presentation, true);
    expect(
      web.filter((r) => r.group === "Codex").every((r) => r.selection.instanceId === "codexHigh"),
    ).toBe(true);
    expect(
      web.find((r) => r.label === "gpt-6.1-sol · high · Standard")?.selection.options,
    ).toContainEqual({ id: "futureOption", value: "retain" });
    const full = buildModelOptions(config, current, undefined, null);
    expect(
      full.find(
        (r) => r.selection.instanceId === current.instanceId && r.selection.model === current.model,
      )?.selection,
    ).toEqual(current);
    const outside = { ...current, model: "historical-saved-model" };
    expect(
      buildModelOptions(config, outside, undefined, null).find(
        (r) => r.selection.model === outside.model,
      )?.selection,
    ).toEqual(outside);
    expect(current).toEqual(before);
  });

  it("keeps hidden current selection and full GLM catalog independently of preferred rows", () => {
    const glm = {
      ...providers[0]!,
      instanceId: ProviderInstanceId.make("opencode"),
      models: [{ ...providers[0]!.models[0]!, slug: "fixture/outside-model" }],
    };
    const extended = {
      ...config,
      providers: [...providers, glm],
      settings: {
        ...DEFAULT_SERVER_SETTINGS,
        providerInstances: {
          codexHigh: { driver: ProviderDriverKind.make("codex"), enabled: true },
          opencode: { driver: ProviderDriverKind.make("opencode"), enabled: true },
        },
        providerModelPreferences: { codexHigh: { hiddenModels: [current.model], modelOrder: [] } },
      },
    } as ServerConfig;
    const full = buildModelOptions(extended, current, undefined, null);
    expect(full.some((row) => row.selection.model === "fixture/outside-model")).toBe(true);
    expect(
      full.find(
        (row) => row.selection.instanceId === "codexHigh" && row.selection.model === current.model,
      )?.selection,
    ).toEqual(current);
  });

  it("uses the dynamic full catalog when payload is absent, and clears the payload on legacy status updates", () => {
    expect(resolveModelPickerPresets(undefined, [], current)).toEqual([]);
    expect(
      buildPresetModelOptions({ providers } as ServerConfig, current, undefined, null),
    ).toEqual([]);
    expect(
      buildModelOptions({ providers } as ServerConfig, current, undefined, null).map(
        (row) => `${row.selection.instanceId}:${row.selection.model}`,
      ),
    ).toEqual(
      providers.flatMap((provider) =>
        provider.models.map((model) => `${provider.instanceId}:${model.slug}`),
      ),
    );
    const snapshot = { version: 1 as const, type: "snapshot" as const, config };
    const state = applyServerConfigProjection(Option.none(), snapshot);
    const changed = { ...presentation, presets: presentation.presets.slice(0, 2) };
    const live = applyServerConfigProjection(state, {
      version: 1,
      type: "providerStatuses",
      payload: { providers, modelPickerPresentation: changed },
    });
    expect(Option.getOrThrow(live).config.modelPickerPresentation?.presets).toHaveLength(2);
    const legacy = applyServerConfigProjection(live, {
      version: 1,
      type: "providerStatuses",
      payload: { providers },
    });
    expect(Option.getOrThrow(legacy).config.modelPickerPresentation).toBeUndefined();
    expect(decodeStatuses({ providers: [] })).toEqual({ providers: [] });
  });

  it("does not select same-model presets with a different effort/tier, and disables unsupported native menu actions", () => {
    const options = buildPresetModelOptions(config, null, undefined, null, false);
    const selected = options[0]!.selection;
    expect(samePickerSelection(selected, selected)).toBe(true);
    expect(samePickerSelection(options[1]!.selection, selected)).toBe(false);
    const actions = buildModelMenuActions(groupByProvider(options), selected).flatMap(
      (a) => a.subactions ?? [],
    );
    expect(actions.filter((a) => a.state === "on")).toHaveLength(1);
    expect(actions.filter((a) => a.attributes?.disabled)).toHaveLength(2);
    const missing = buildPresetModelOptions(
      { ...config, providers: providers.map((p) => ({ ...p, models: [] })) },
      current,
      undefined,
      null,
    );
    expect(missing.every((row) => row.isUnavailable)).toBe(true);
    const locked = buildPresetModelOptions(config, current, current.instanceId, null);
    expect(
      locked
        .filter((row) => row.providerDriver === "claudeAgent")
        .every((row) => row.isUnavailable),
    ).toBe(true);
  });
});
