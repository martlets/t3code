import { useRef } from "react";
import type { ModelSelection } from "@t3tools/contracts";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { localPickerRows, localSelectionLabel } from "./localPickerPresets";

export function LocalPresetPicker(props: {
  entries: ReadonlyArray<ProviderInstanceEntry>;
  current: ModelSelection;
  preserveLegacy?: boolean | undefined;
  disabled?: boolean | undefined;
  getDisabledReason?: (selection: ModelSelection) => string | null;
  onSelect: (selection: ModelSelection) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const rows = localPickerRows(props.entries, props.current, props.preserveLegacy);
  return (
    <div
      data-model-picker-content
      ref={list}
      className="max-h-86.5 w-96 max-w-[calc(100vw-2rem)] overflow-auto p-2"
      onKeyDown={(event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const buttons = Array.from(
          list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
        );
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : Math.max(
                  0,
                  Math.min(buttons.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)),
                );
        event.preventDefault();
        buttons[next]?.focus();
      }}
    >
      <div className="p-2 text-sm">
        <div>Current selection: {localSelectionLabel(props.current)}</div>
        <div className="text-xs text-muted-foreground">
          Profile:{" "}
          {props.current.instanceId === "codexHigh"
            ? "Codex (legacy defaults)"
            : props.current.instanceId}
        </div>
      </div>
      <p className="px-2 pb-2 text-xs text-muted-foreground">
        Thread choices override profile defaults. Fast and Standard request a service tier; delivery
        can vary.
      </p>
      {rows.map((row, index) => {
        const reason = row.reason ?? props.getDisabledReason?.(row.selection);
        return (
          <div key={`${row.selection.instanceId}:${row.label}`}>
            {index === 0 || rows[index - 1]?.group !== row.group ? (
              <div className="p-2 font-medium text-sm">{row.group}</div>
            ) : null}
            <button
              type="button"
              disabled={props.disabled || !!reason}
              aria-label={row.label}
              className="w-full rounded-sm p-2 text-left text-sm hover:bg-accent focus-visible:bg-accent disabled:opacity-50"
              onClick={() => {
                if (!props.disabled && !reason) props.onSelect(row.selection);
              }}
            >
              {row.label}
              {reason ? <span className="block text-xs">{reason}</span> : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}
