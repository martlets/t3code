import type {
  ModelCapabilities,
  ModelPickerPresentation,
  ModelSelection,
  ProviderInstanceId,
} from "@t3tools/contracts";

export interface PickerProvider {
  readonly instanceId: ProviderInstanceId;
  readonly available: boolean;
  readonly models: ReadonlyArray<{
    readonly slug: string;
    readonly capabilities?: ModelCapabilities | null;
  }>;
}

export function samePickerSelection(a: ModelSelection, b: ModelSelection | null): boolean {
  return (
    !!b &&
    a.instanceId === b.instanceId &&
    a.model === b.model &&
    JSON.stringify([...(a.options ?? [])].sort((x, y) => x.id.localeCompare(y.id))) ===
      JSON.stringify([...(b.options ?? [])].sort((x, y) => x.id.localeCompare(y.id)))
  );
}

/** Both clients consume the same ordered payload. Missing payload means use the full dynamic catalog. */
export function resolveModelPickerPresets(
  presentation: ModelPickerPresentation | undefined,
  providers: ReadonlyArray<PickerProvider>,
  current: ModelSelection | null,
  preserveIdentity = true,
) {
  const seen = new Set<string>();
  return (presentation?.presets ?? []).flatMap((preset) => {
    if (seen.has(preset.id)) return [];
    seen.add(preset.id);
    const group = presentation?.groups.find((candidate) => candidate.id === preset.groupId);
    if (!group) return [];
    const instanceId =
      preserveIdentity &&
      current &&
      preset.selection.instanceId === group.canonicalInstanceId &&
      group.preserveInstanceIds.includes(current.instanceId)
        ? current.instanceId
        : preset.selection.instanceId;
    // Preserve explicit, unrelated options for the same model. Merely opening a menu never normalizes a saved selection.
    const extras =
      current?.instanceId === instanceId && current.model === preset.selection.model
        ? (current.options ?? []).filter(
            (option) => !preset.selection.options?.some((next) => next.id === option.id),
          )
        : [];
    const selection: ModelSelection = {
      ...preset.selection,
      instanceId,
      ...(extras.length ? { options: [...extras, ...(preset.selection.options ?? [])] } : {}),
    };
    const provider = providers.find((candidate) => candidate.instanceId === instanceId);
    const model = provider?.models.find((candidate) => candidate.slug === selection.model);
    const valid = (preset.selection.options ?? []).every((option) => {
      const descriptor = model?.capabilities?.optionDescriptors?.find(
        (candidate) => candidate.id === option.id,
      );
      return descriptor?.type === "select"
        ? descriptor.options.some((choice) => choice.id === option.value)
        : descriptor?.type === "boolean" && typeof option.value === "boolean";
    });
    const reason =
      preset.disabledReason ??
      (!provider?.available
        ? "Provider unavailable"
        : !model || !valid
          ? "Unavailable in current catalog"
          : null);
    return [
      {
        id: preset.id,
        groupId: group.id,
        group: group.label,
        label: preset.label,
        selection,
        reason,
      },
    ];
  });
}
