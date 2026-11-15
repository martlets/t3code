import { useState } from "react";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { ProviderInstanceId, type ModelSelection } from "@t3tools/contracts";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { render } from "../../../test/render";
import { ComposerModelPicker } from "./ComposerFooterControls";
import { LocalPresetPicker } from "./LocalPresetPicker";
import catalog from "./fixtures/localPickerCatalog.json";

it("keeps legacy options visible, skips unsupported Fast with keyboard, and captures exact selection", async () => {
  const entries = catalog.map((p) => ({
    ...p,
    snapshot: {
      ...p,
      auth: { status: "authenticated" },
      status: "ready",
      driver: p.instanceId === "claudeAgent" ? "claudeAgent" : "codex",
      installed: true,
      version: null,
      slashCommands: [],
      skills: [],
    },
    driverKind: p.instanceId === "claudeAgent" ? "claudeAgent" : "codex",
    status: "ready",
    isAvailable: true,
    installed: true,
    isDefault: false,
    models: p.models.map((m) => ({ ...m, name: m.slug, isCustom: false })),
  })) as unknown as ProviderInstanceEntry[];
  const dispatch = vi.fn();
  function Picker() {
    const [current, setCurrent] = useState({
      instanceId: ProviderInstanceId.make("codexHigh"),
      model: "historical-model",
      options: [
        { id: "reasoningEffort", value: "medium" },
        { id: "serviceTier", value: "priority" },
      ],
    } as ModelSelection);
    return (
      <LocalPresetPicker
        entries={entries}
        current={current}
        onSelect={(selection) => {
          dispatch(selection);
          setCurrent(selection);
        }}
      />
    );
  }
  await using screen = await render(<Picker />);
  await expect
    .element(screen.getByText("Current selection: historical-model · medium · Fast"))
    .toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: /claude-fable-5-2 · high · Fast/ }))
    .toBeDisabled();
  const sol = screen.getByRole("button", { name: "gpt-6.1-sol · high · Standard", exact: true });
  await sol.click();
  expect(dispatch).toHaveBeenLastCalledWith({
    instanceId: ProviderInstanceId.make("codexHigh"),
    model: "gpt-6.1-sol",
    options: [
      { id: "reasoningEffort", value: "high" },
      { id: "serviceTier", value: "default" },
    ],
  });
  await userEvent.keyboard("{ArrowDown}");
  expect(dispatch).toHaveBeenCalledTimes(1);
  await userEvent.keyboard("{Enter}");
  expect(dispatch).toHaveBeenLastCalledWith({
    instanceId: ProviderInstanceId.make("codexHigh"),
    model: "gpt-6.1-sol",
    options: [
      { id: "reasoningEffort", value: "high" },
      { id: "serviceTier", value: "priority" },
    ],
  });
  await expect
    .element(screen.getByText("Current selection: gpt-6.1-sol · high · Fast"))
    .toBeVisible();
});

it.each([false, true])(
  "dispatches canonical Codex presets with multi-model setting %s",
  async (multipleModelsEnabled) => {
    const entries = catalog.map((p) => ({
      ...p,
      snapshot: {
        ...p,
        auth: { status: "authenticated" },
        status: "ready",
        driver: p.instanceId === "claudeAgent" ? "claudeAgent" : "codex",
        installed: true,
        version: null,
        slashCommands: [],
        skills: [],
      },
      driverKind: p.instanceId === "claudeAgent" ? "claudeAgent" : "codex",
      status: "ready",
      isAvailable: true,
      installed: true,
      isDefault: false,
      models: p.models.map((m) => ({ ...m, name: m.slug, isCustom: false })),
    })) as unknown as ProviderInstanceEntry[];
    const dispatch = vi.fn();
    const current: ModelSelection = {
      instanceId: ProviderInstanceId.make("codexHigh"),
      model: "gpt-6.1-sol",
      options: [
        { id: "reasoningEffort", value: "high" },
        { id: "serviceTier", value: "priority" },
      ],
    };
    await using _screen = await render(
      <ComposerModelPicker
        environmentId={null}
        activeInstanceId={current.instanceId}
        model={current.model}
        lockedProvider={null}
        instanceEntries={entries}
        modelOptionsByInstance={new Map(entries.map((e) => [e.instanceId, e.models]))}
        multipleModelsEnabled={multipleModelsEnabled}
        multipleModelSelections={null}
        onMultipleModelSelectionsChange={() => {}}
        selectedModelSelection={current}
        onProviderModelSelect={dispatch}
        preserveLocalIdentity={false}
        open
      />,
    );
    if (multipleModelsEnabled) {
      await page.getByRole("button", { name: "All models / select multiple", exact: true }).click();
      await page.getByRole("button", { name: "Back to presets", exact: true }).click();
    }
    await page.getByRole("button", { name: "gpt-6.1-sol · high · Standard", exact: true }).click();
    expect(dispatch).toHaveBeenCalledWith(ProviderInstanceId.make("codex"), "gpt-6.1-sol", {
      selection: {
        instanceId: ProviderInstanceId.make("codex"),
        model: "gpt-6.1-sol",
        options: [
          { id: "reasoningEffort", value: "high" },
          { id: "serviceTier", value: "default" },
        ],
      },
    });
  },
);
