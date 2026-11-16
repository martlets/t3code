import type { ModelSelection } from "@t3tools/contracts";

export function localSelectionLabel(selection: ModelSelection, modelName = selection.model) {
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
