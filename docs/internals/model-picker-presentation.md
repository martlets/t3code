# Server-owned model picker presentation

All web, desktop (Windows, macOS and Linux), iOS, Android and future T3 clients
must use the connected environment's optional `ServerConfig.modelPickerPresentation`
for preferred model menus. Clients must not ship their own preset lists or infer
preferred thinking/speed combinations from instance names. The server owns row IDs,
labels, order, groups, complete `ModelSelection` values and disabled reasons. See
[the wire schema](../../packages/contracts/src/server.ts),
[server catalog](../../apps/server/src/provider/modelPickerPresentation.ts) and
[shared selector](../../packages/client-runtime/src/modelPicker.ts).

The current server catalog applies to the configured local Codex/codexHigh pair.
It is a server build input. Changing it requires server deployment; compatible
clients receive it at connection and in existing provider-status updates. No client
rebuild, extra polling, runtime provider replacement or model-slug remapping is
needed for subsequent presentation changes. Other environments omit the payload.
The payload is separate from the full runtime `providers` catalog and from saved
settings. Changing presentation must not change provider registrations, credentials,
sessions, defaults, schedules, option descriptors or existing selections.

## Consumer requirements

- Preserve stable row identity and server order. Repeated IDs produce one row.
  Group labels and continuation identity policy come from the payload. Keep presets
  contiguous within their presentation group; each group's first row sets its order.
- Dispatch the complete selection, including explicit options. Never overwrite an
  explicit preset with remembered options or silently turn an unsupported Fast row
  into Standard. A disabled reason prevents selection; missing providers, models or
  option support also disable a row. Project and continuation restrictions still apply.
- New choices use the canonical instance. Existing contexts may retain only the
  saved identities explicitly allowed by their presentation group. Preserve unrelated
  explicit options for a same-model selection and never normalize a selection merely
  by opening or switching views in a picker.
- Offer the full dynamic catalog, including other providers, and show the current
  selection even when it is hidden, missing or outside the preferred menu. Provide
  a return to presets. Returning from multi-model browsing must preserve the staged
  models until the user explicitly chooses a preset.
- An absent payload means the server's dynamic provider/model catalog and existing
  current-selection behavior. Do not fall back to a bundled copy of preferred rows.
  A reconnect or status replacement from a server lacking the payload clears it.

## Compatibility boundary

Adding this optional field leaves older config decoders and runtime provider lists
usable. It cannot teach a frozen consumer to render presets. Known older web/desktop
code derives CO/CH badges from instance IDs; older native code keys rows by
`instanceId:model.slug` and builds a selection without row-specific options. Two
same-model effort/tier rows collapse in that representation. Server display names
cannot override those algorithms. There is no universally CH/CO-free provider-list
fallback that also preserves those IDs, full catalogs and saved contexts.

Do not remove, rename, hide or disable a runtime instance to disguise this limitation.
A frozen client with these algorithms is not updatable through server data alone.
Its remedy is a compatible client release or the compatible server-hosted web client.
A client with no payload support still receives the complete legacy provider list;
that is an execution-compatible fallback, with the presentation limitation stated.

Release owners must record the actual client version, route, payload consumption and
runtime identity/options for each supported surface. A source change or viewport
emulation proves neither distribution nor device acceptance. Native iOS delivery
requires a signed binary or an authorized OTA matching its installed channel/runtime;
unknown installed versions and inaccessible devices remain unverified. Desktop
renderers and externally hosted web bundles require their own consumer update even
when they connect to an updated server. These requirements apply to new clients too.
