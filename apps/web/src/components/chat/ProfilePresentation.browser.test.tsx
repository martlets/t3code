import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import "~/index.css";
import { render } from "../../../test/render";
import { deriveProviderInstanceEntries } from "../../providerInstances";
import { ModelPickerSidebar } from "./ModelPickerSidebar";
import { LocalPresetPicker } from "./LocalPresetPicker";
import catalog from "./fixtures/localPickerCatalog.json";

it("keeps readable profile navigation and dispatches the original legacy identity on a narrow screen", async () => {
  const entries = deriveProviderInstanceEntries(
    catalog.map((p) => ({
      ...p,
      driver: p.instanceId === "claudeAgent" ? "claudeAgent" : "codex",
      displayName: p.instanceId === "codexHigh" ? "Codex High" : p.displayName,
      status: "ready",
      auth: { status: "authenticated" },
      installed: true,
      version: null,
      slashCommands: [],
      skills: [],
    })) as unknown as ServerProvider[],
  );
  const choose = vi.fn();
  await using screen = await render(
    <div
      data-testid="profile-fixture"
      style={{ width: 360 }}
      className="bg-background text-foreground"
    >
      <div className="flex">
        <ModelPickerSidebar
          selectedInstanceId={ProviderInstanceId.make("codexHigh")}
          onSelectInstance={choose}
          onFocusSearch={() => {}}
          instanceEntries={entries}
        />
        <div className="min-w-0 p-2 text-sm">
          Full model catalog remains available for each profile.
        </div>
      </div>
      <LocalPresetPicker
        entries={entries}
        current={{
          instanceId: ProviderInstanceId.make("codexHigh"),
          model: "gpt-6.1-sol",
          options: [
            { id: "reasoningEffort", value: "medium" },
            { id: "serviceTier", value: "priority" },
          ],
        }}
        onSelect={choose}
      />
    </div>,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Codex (legacy defaults)", exact: true }),
  );
  expect(choose).toHaveBeenCalledExactlyOnceWith("codexHigh");
  await expect
    .element(screen.getByText("Current selection: gpt-6.1-sol · medium · Fast requested"))
    .toBeVisible();
});
