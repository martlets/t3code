// @vitest-environment jsdom
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { EnvironmentId, ProviderInstanceId, type ModelSelection } from "@t3tools/contracts";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { ProviderModelPicker } from "./ProviderModelPicker";
import catalog from "./fixtures/localPickerCatalog.json";

vi.mock("../../state/entities", async () => {
  const { ModelPickerPresentation } = await import("@t3tools/contracts");
  const Schema = await import("effect/Schema");
  const { default: payload } =
    await import("../../../../server/src/provider/modelPickerPresentation.json");
  const presentation = Schema.decodeSync(ModelPickerPresentation)(payload);
  return {
    useServerConfigs: () => new Map([["test", { modelPickerPresentation: presentation }]]),
  };
});
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

vi.mock("../ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverPopup: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: () => null,
}));
vi.mock("./ChatGptSharingControl", () => ({ ChatGptSharingControl: () => null }));
vi.mock("./ModelPickerContent", () => ({
  resolveModelPickerSelectedModel: () => undefined,
  ModelPickerContent: ({
    onToggleModel,
  }: {
    onToggleModel: (id: ReturnType<typeof ProviderInstanceId.make>, model: string) => void;
  }) => (
    <button onClick={() => onToggleModel(ProviderInstanceId.make("codex"), "gpt-6.1-sol")}>
      Add second model
    </button>
  ),
}));
const second = { instanceId: ProviderInstanceId.make("codex"), model: "gpt-6.1-sol" };
const dispatch = vi.fn();
function Harness({ multiple = false }: { multiple?: boolean }) {
  const [selection, setSelection] = useState(current);
  const [fanout, setFanout] = useState<ModelSelection[] | undefined>(
    multiple ? [current, second] : undefined,
  );
  return (
    <>
      <output>{JSON.stringify({ selection, fanout })}</output>
      <ProviderModelPicker
        preservePresetIdentity={false}
        open
        environmentId={EnvironmentId.make("test")}
        lockedProvider={null}
        currentSelection={selection}
        activeInstanceId={selection.instanceId}
        model={selection.model}
        {...(fanout !== undefined ? { selectedModels: fanout } : {})}
        instanceEntries={entries}
        modelOptionsByInstance={new Map()}
        onInstanceModelChange={() => {
          throw Error("Unexpected catalog replacement");
        }}
        onToggleModel={() => setFanout([selection, second])}
        onPresetSelect={(next) => {
          dispatch(next);
          setSelection(next);
          setFanout(undefined);
        }}
      />
    </>
  );
}
function state() {
  return JSON.parse(container.querySelector("output")!.textContent!);
}
async function clickText(text: string) {
  const target = [...container.querySelectorAll("button")].find((b) => b.textContent === text);
  expect(target, `visible control: ${text}`).toBeDefined();
  await act(() => target!.click());
}
it("returns from two models without changing fanout, then applies an exact explicit preset", async () => {
  dispatch.mockClear();
  await act(() => root.render(<Harness />));
  await clickText("All models / select multiple");
  await clickText("Add second model");
  const before = state();
  expect(before.fanout).toEqual([current, second]);
  await clickText("Back to presets");
  expect(state()).toEqual(before);
  expect(dispatch).not.toHaveBeenCalled();
  await act(() => button("gpt-6.1-sol · high · Standard").click());
  const exact = {
    instanceId: "codex",
    model: "gpt-6.1-sol",
    options: [
      { id: "reasoningEffort", value: "high" },
      { id: "serviceTier", value: "default" },
    ],
  };
  expect(dispatch).toHaveBeenCalledExactlyOnceWith(exact);
  expect(state()).toEqual({ selection: exact });
});
it("opens an existing multiple selection in the catalog and returns without changing it", async () => {
  await act(() => root.render(<Harness multiple />));
  expect(container.textContent).toContain("Add second model");
  const before = state();
  await clickText("Back to presets");
  expect(state()).toEqual(before);
  expect(button("gpt-6.1-sol · high · Standard")).toBeDefined();
});
