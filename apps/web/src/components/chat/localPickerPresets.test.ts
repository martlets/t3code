import schedules from "./fixtures/localPickerSchedules.json";
import { expect, it } from "vite-plus/test";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { ProviderInstanceId, type ModelSelection } from "@t3tools/contracts";
import catalog from "./fixtures/localPickerCatalog.json";
import { localPickerRows, localSelectionLabel, usesLocalPicker } from "./localPickerPresets";

export function fixtureEntries(): ProviderInstanceEntry[] {
  return catalog.map((p) => ({
    ...p,
    driverKind: p.instanceId === "claudeAgent" ? "claudeAgent" : "codex",
    status: "ready",
    isAvailable: true,
    installed: true,
    isDefault: false,
    models: p.models.map((m) => ({ ...m, name: m.slug, isCustom: false })),
  })) as unknown as ProviderInstanceEntry[];
}
const current = {
  instanceId: ProviderInstanceId.make("codexHigh"),
  model: "gpt-6.1-sol",
  options: [
    { id: "reasoningEffort", value: "high" },
    { id: "serviceTier", value: "default" },
  ],
} as ModelSelection;

it("validates every preferred combination against the installed catalog and preserves exact dispatch", () => {
  const entries = fixtureEntries();
  const before = JSON.stringify(entries);
  const rows = localPickerRows(entries, current);
  expect(rows.filter((r) => !r.reason)).toHaveLength(12);
  expect(rows.filter((r) => r.reason)).toHaveLength(2);
  expect(
    rows.filter((r) => r.reason).every((r) => r.reason?.includes("no fastMode descriptor")),
  ).toBe(true);
  expect(
    rows.filter((r) => r.group === "Codex").every((r) => r.selection.instanceId === "codexHigh"),
  ).toBe(true);
  const captured: ModelSelection[] = [];
  rows.filter((r) => !r.reason).forEach((r) => captured.push(r.selection));
  expect(
    captured.find(
      (s) => s.model === current.model && s.options?.some((o) => o.value === "default"),
    ),
  ).toEqual(current);
  expect(
    captured.filter((s) => s.instanceId === "codexHigh").every((s) => s.options?.length === 2),
  ).toBe(true);
  expect(
    localPickerRows(entries, current, false)
      .filter((r) => r.group === "Codex")
      .every((r) => r.selection.instanceId === "codex"),
  ).toBe(true);
  expect(JSON.stringify(entries)).toBe(before);
});

it("retains other accounts and rejects missing catalog support without substitutions", () => {
  const entries = fixtureEntries();
  const other = { ...entries[0]!, instanceId: "codex_work" } as ProviderInstanceEntry;
  expect(usesLocalPicker([entries[0]!, other])).toBe(false);
  const rows = localPickerRows([...entries, other], current);
  expect(rows.some((r) => r.selection.instanceId === other.instanceId)).toBe(true);
  const missing = entries.map((e) => ({ ...e, models: [] }));
  expect(localPickerRows(missing, current).every((r) => r.reason)).toBe(true);
  expect(localSelectionLabel(current)).toBe("gpt-6.1-sol · high · Standard");
  expect(localSelectionLabel({ ...current, model: "historical-model" })).toContain(
    "historical-model",
  );
});

it("leaves all seven captured schedule selections and enablement intact, including options outside the menu", () => {
  const before = structuredClone(schedules);
  for (const schedule of schedules) {
    const selection = {
      ...schedule.modelSelection,
      instanceId: ProviderInstanceId.make(schedule.modelSelection.instanceId),
    };
    localPickerRows(fixtureEntries(), selection);
    localSelectionLabel(selection);
  }
  expect(schedules).toEqual(before);
  expect(schedules).toHaveLength(7);
  expect(schedules.filter((s) => s.enabled)).toHaveLength(1);
  expect(schedules.some((s) => s.modelSelection.options?.some((o) => o.value === "max"))).toBe(
    true,
  );
});
