import type { ModelSelection, ProviderInstanceId } from "@t3tools/contracts";
import type { ProviderInstanceEntry } from "../../providerInstances";
import presets from "./localPickerPresets.json";

export function usesLocalPicker(entries: ReadonlyArray<ProviderInstanceEntry>) {
  return ["codex", "codexHigh"].every((id) =>
    entries.some((e) => e.instanceId === id && e.driverKind === "codex"),
  );
}

export function localSelectionLabel(selection: ModelSelection) {
  const options = selection.options ?? [];
  const effort = options.find((o) => o.id === "reasoningEffort" || o.id === "effort")?.value;
  const tier = options.find((o) => o.id === "serviceTier" || o.id === "fastMode");
  const speed = tier
    ? tier.value === "priority" || tier.value === true
      ? "Fast"
      : tier.value === "default" || tier.value === false
        ? "Standard"
        : String(tier.value)
    : selection.model === "claude-fable-5-2"
      ? "Standard"
      : "Speed unspecified";
  return `${selection.model} · ${effort ?? "Reasoning unspecified"} · ${speed}`;
}

export function localPickerRows(
  entries: ReadonlyArray<ProviderInstanceEntry>,
  current: ModelSelection,
  preserveLegacy = true,
) {
  const rows = presets.map((preset) => {
    // These two local identities share presentation only; continuation keeps its exact identity.
    const id =
      preserveLegacy && preset.provider === "codex" && current.instanceId === "codexHigh"
        ? "codexHigh"
        : preset.provider;
    const entry = entries.find((e) => e.instanceId === id);
    const model = entry?.models.find((m) => m.slug === preset.model);
    const selection: ModelSelection = {
      instanceId: id as ProviderInstanceId,
      model: preset.model,
      options: preset.options,
    };
    const valid = preset.options.every((option) => {
      const descriptor = model?.capabilities?.optionDescriptors?.find((d) => d.id === option.id);
      return descriptor?.type === "select"
        ? descriptor.options.some((o) => o.id === option.value)
        : descriptor?.type === "boolean" && typeof option.value === "boolean";
    });
    const reason = !preset.available
      ? preset.unavailableReason
      : !entry?.enabled || !entry.isAvailable || entry.status !== "ready"
        ? "Provider unavailable"
        : !model || !valid
          ? "Unavailable in current catalog"
          : null;
    return {
      group: preset.provider === "codex" ? "Codex" : "Claude",
      label: `${preset.model} · ${preset.options[0]?.value} · ${preset.speed ?? (preset.options.some((o) => o.value === "priority") ? "Fast" : "Standard")}`,
      selection,
      reason,
    };
  });
  for (const entry of entries) {
    if (
      (entry.driverKind === "codex" && ["codex", "codexHigh"].includes(entry.instanceId)) ||
      entry.instanceId === "claudeAgent"
    )
      continue;
    for (const model of entry.models)
      rows.push({
        group: `${entry.displayName} (${entry.instanceId})`,
        label: model.name,
        selection: { instanceId: entry.instanceId, model: model.slug },
        reason:
          entry.enabled && entry.isAvailable && entry.status === "ready"
            ? null
            : "Provider unavailable",
      });
  }
  return rows;
}
