// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { ProviderInstanceId, type ModelSelection } from "@t3tools/contracts";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { LocalPresetPicker } from "./LocalPresetPicker";
import catalog from "./fixtures/localPickerCatalog.json";

const entries = catalog.map((p) => ({
  ...p,
  driverKind: p.instanceId === "claudeAgent" ? "claudeAgent" : "codex",
  status: "ready",
  isAvailable: true,
  installed: true,
  isDefault: false,
  models: p.models.map((m) => ({ ...m, name: m.slug, isCustom: false })),
})) as unknown as ProviderInstanceEntry[];
const current: ModelSelection = {
  instanceId: ProviderInstanceId.make("codexHigh"),
  model: "gpt-6.2-astra",
  options: [
    { id: "reasoningEffort", value: "high" },
    { id: "serviceTier", value: "priority" },
  ],
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
function button(label: string) {
  const found = [...container.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === label,
  );
  if (!found) throw Error(`Missing button: ${label}`);
  return found;
}
it.each([true, false])(
  "preserves 6.2 until selection and routes legacy=%s exactly",
  async (preserveLegacy) => {
    const dispatch = vi.fn();
    const before = structuredClone(current);
    await act(() =>
      root.render(
        <LocalPresetPicker
          entries={entries}
          current={current}
          preserveLegacy={preserveLegacy}
          onSelect={dispatch}
        />,
      ),
    );
    expect(container.textContent).toContain(
      "Current selection: gpt-6.2-astra · high · Fast requested",
    );
    expect(dispatch).not.toHaveBeenCalled();
    await act(() => button("claude-fable-5-2 · high · Fast").click());
    expect(dispatch).not.toHaveBeenCalled();
    const sol = button("gpt-6.1-sol · high · Standard");
    await act(() => sol.click());
    expect(dispatch).toHaveBeenLastCalledWith({
      instanceId: preserveLegacy ? "codexHigh" : "codex",
      model: "gpt-6.1-sol",
      options: [
        { id: "reasoningEffort", value: "high" },
        { id: "serviceTier", value: "default" },
      ],
    });
    expect(current).toEqual(before);
    const fable = button("claude-fable-5-2 · high · Standard");
    fable.focus();
    await act(() =>
      fable.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })),
    );
    expect(document.activeElement).toBe(button("claude-fable-5-2 · medium · Standard"));
  },
);
it("rejects locked and busy choices, and keeps current options when support disappears", async () => {
  const dispatch = vi.fn();
  await act(() =>
    root.render(
      <LocalPresetPicker
        entries={entries}
        current={current}
        onSelect={dispatch}
        getDisabledReason={() => "Continuation unavailable"}
      />,
    ),
  );
  await act(() => button("gpt-6.1-sol · high · Standard").click());
  expect(dispatch).not.toHaveBeenCalled();
  await act(() =>
    root.render(
      <LocalPresetPicker entries={entries} current={current} onSelect={dispatch} disabled />,
    ),
  );
  await act(() => button("gpt-6.1-sol · high · Standard").click());
  expect(dispatch).not.toHaveBeenCalled();
  await act(() =>
    root.render(
      <LocalPresetPicker
        entries={entries.map((e) => ({ ...e, models: [] }))}
        current={current}
        onSelect={dispatch}
      />,
    ),
  );
  expect([...container.querySelectorAll("button")].every((b) => b.disabled)).toBe(true);
  expect(container.textContent).toContain(
    "Current selection: gpt-6.2-astra · high · Fast requested",
  );
});
