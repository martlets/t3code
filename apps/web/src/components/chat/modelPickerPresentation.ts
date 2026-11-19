import type { ModelPickerPresentation, ModelSelection } from "@t3tools/contracts";
import { resolveModelPickerPresets } from "@t3tools/client-runtime/model-picker";
import type { ProviderInstanceEntry } from "../../providerInstances";

export function selectionLabel(selection: ModelSelection, modelName = selection.model) {
  const options = selection.options ?? [];
  const effort = options.find((o) => o.id === "reasoningEffort" || o.id === "effort")?.value;
  const tier = options.find((o) => o.id === "serviceTier" || o.id === "fastMode");
  const speed = tier
    ? tier.value === "priority" || tier.value === true
      ? "Fast requested"
      : tier.value === "default" || tier.value === false
        ? "Standard requested"
        : String(tier.value)
    : "Speed inherited / unspecified";
  return `${modelName} · ${effort ?? "Thinking inherited / unspecified"} · ${speed}`;
}

export function pickerPresetRows(
  entries: ReadonlyArray<ProviderInstanceEntry>,
  current: ModelSelection,
  preserveLegacy = true,
  presentation?: ModelPickerPresentation,
) {
  return resolveModelPickerPresets(
    presentation,
    entries.map((entry) => ({
      instanceId: entry.instanceId,
      available: entry.enabled && entry.isAvailable && entry.status === "ready",
      models: entry.models,
    })),
    current,
    preserveLegacy,
  );
}
