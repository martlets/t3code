import { ModelPickerPresentation, type ServerProvider } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import presentation from "./modelPickerPresentation.json" with { type: "json" };

const preferred = Schema.decodeSync(ModelPickerPresentation)(presentation);

/** The local preferred menu applies only to this configured pair; every other server keeps its dynamic catalog. */
export function modelPickerPresentation(
  providers: ReadonlyArray<ServerProvider>,
): ModelPickerPresentation | undefined {
  return ["codex", "codexHigh"].every((id) =>
    providers.some((provider) => provider.instanceId === id && provider.driver === "codex"),
  )
    ? preferred
    : undefined;
}
