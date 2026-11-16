import { expect, it } from "vite-plus/test";
import { ProviderInstanceId } from "@t3tools/contracts";
import { localSelectionLabel } from "./localPickerPresets";

it("preserves selection and distinguishes explicit requests from absent saved options", () => {
  const selection = { instanceId: ProviderInstanceId.make("codexHigh"), model: "historical-model" };
  expect(localSelectionLabel(selection)).toBe(
    "historical-model · Thinking inherited / unspecified · Speed inherited / unspecified",
  );
  const explicit = {
    ...selection,
    options: [
      { id: "reasoningEffort", value: "medium" },
      { id: "serviceTier", value: "priority" },
    ],
  };
  const before = structuredClone(explicit);
  expect(localSelectionLabel(explicit)).toBe("historical-model · medium · Fast requested");
  expect(explicit).toEqual(before);
  expect(
    localSelectionLabel({ ...selection, options: [{ id: "fastMode", value: false }] }),
  ).toContain("Standard requested");
});
