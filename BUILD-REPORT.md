# BUILD REPORT — imgpage

Rebuild of `com.html2img/html-to-image` v1.0.0 (remote-only)
as `@reneturcios/imgpage` 0.1.0 / `io.github.CloudCorpRecords/imgpage`.
**Full surface built: all 2 captured tools.**

## Fixture conflicts

**None.** The spec, the brief, and the fixture agree on the two tool
names and their required fields. Required fields as served, taken from
the fixture (`harness/fixtures/html2img-tools-original.json`):

- `generate-image-from-html` — required: `html`
- `screenshot-url` — required: `url`

The fixture's tool literals (name, description, inputSchema — the
capture and fixture carry **no `title` key**, so no title is served;
asserted by a dedicated test) are served verbatim from
`src/forward.ts`; the literals were generated programmatically from
the fixture JSON (parsed and re-serialised by
`/tmp/b38-imgpage-gen.py`, not retyped) and verified by the
registration-integrity test (served tools/list deep-equals the
fixture's 2 tool objects, in order) and again by the parity harness.

Judgment call recorded in the spec, followed here: both captured
descriptions state the call "Consumes one credit per call" — metering
on the caller's own pre-existing plan. The 2-tool surface holds no
purchase, checkout, top-up or key-minting tool, so the surface is
built in full (the appindex precedent).

## What was built

All 19 factory files under `builds/imgpage/`:

- `package.json` (`@reneturcios/imgpage` 0.1.0, bin
  `imgpage` → `dist/cli.js`, deps exactly `@modelcontextprotocol/sdk ^1`
  + `zod ^3`; devDeps `@types/node ^20`, `tsx ^4`, `typescript ^5`)
- `server.json` (description exactly the prescribed 80-char string
  "Render HTML and CSS to a PNG image or PDF, or screenshot a live web page by URL.";
  npm entry carries `"version": "0.1.0"`; OCI entry
  `ghcr.io/cloudcorprecords/imgpage:0.1.0` carries **no** version field)
- `Dockerfile` (node:20-alpine both stages; server-name label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/imgpage"`
  matches `server.json`)
- `tsconfig.json` (fleet-identical, 318 bytes), `.gitignore`,
  `package-lock.json`, `README.md` (fresh prose), `LICENSE` (MIT,
  Copyright (c) 2026 Rene Turcios), `CHANGELOG.md` (single 0.1.0 entry,
  2026-10-28)
- `src/index.ts`, `src/cli.ts`, `src/mcp.ts`, `src/types.ts`,
  `src/forward.ts` (core; exports `VERSION = "0.1.0"`)
- `test/forward.test.ts`
- `.github/workflows/{ci.yml, publish.yml, publish-container.yml,
  registry-publish.yml}` (container workflow: IMAGE
  `ghcr.io/cloudcorprecords/imgpage`, smoke assertion on server name
  `imgpage`)

Plus `BUILD-REPORT.md` (this file) and the `parity-out/` harness output.

## Design

- Forwarding client to `https://app.html2img.com/mcp` (pinned),
  overridable via `HTML2IMG_MCP_URL` (LABELLED RECONSTRUCTION).
  tools/call is forwarded as a streamable-HTTP JSON-RPC client:
  initialize (protocolVersion `2025-03-26`, clientInfo `imgpage`) →
  notifications/initialized → tools/call, honouring `Mcp-Session-Id`
  when issued; session established lazily and reused per client.
  Plain-JSON and SSE replies both parsed; the matching-id message
  wins; upstream results pass through verbatim (including `isError`
  and extra fields such as `structuredContent`).
- When `HTML2IMG_API_KEY` is set, an `Authorization: Bearer <key>`
  header is sent on every upstream request (header name and Bearer
  form pinned by the registry record's own remote declaration, which
  declares a required secret `Authorization` header; the env name and
  the env forwarding are LABELLED RECONSTRUCTIONS — the record pins
  no package env name and the capture was keyless). When unset, no
  key header is sent. No `X-API-Key` header is sent in either case.
  Both branches are covered by tests.
- Upstream failures (JSON-RPC error, non-2xx status, malformed body,
  throwing/timing-out fetch) surface as `imgpage error:` text results
  (LABELLED RECONSTRUCTION).
- Registration via the MCP SDK **low-level** `Server` API
  (`ListToolsRequestSchema` / `CallToolRequestSchema` handlers)
  serving the fixture literals exactly; no `McpServer` + zod
  registration (per the task brief, overriding TEMPLATE.md §2 item 12).
  `src/mcp.ts` also exports `createServer` / `startMcpServer` /
  `handleCallTool` so the MCP layer is testable without a transport;
  the CLI's `mcp` subcommand starts it over stdio.
- Core takes an injectable fetch (`ForwardDeps.fetchFn`), so all tests
  run against a stubbed JSON-RPC upstream. No live network calls in
  tests; no live call claimed beyond the coordinator's tools/list
  captures.

## Labelled reconstructions (from the spec)

- `HTML2IMG_MCP_URL` env override of the pinned endpoint
  `https://app.html2img.com/mcp`.
- `HTML2IMG_API_KEY` env name and the forwarding of its value as
  `Authorization: Bearer <value>` (header name and Bearer form pinned
  by the registry record; env name pinned by nothing, capture keyless).
- The `imgpage error:` failure rendering for upstream failures.

## Lockfile (Route 3, clean from birth)

Generated in the build dir with no `node_modules` present and no
pre-existing lockfile:
`npm install --package-lock-only --ignore-scripts --offline`.
Verified: parses, `name == @reneturcios/imgpage`,
**128 package entries**, sha256
`0e4d4d35f5faf74e8b0155de006bdb2cd8a0505a8835b225ba961727b1dbbdfb`.
Then `npm install --offline --ignore-scripts` in the build dir for
`node_modules`.

## Verification (all in the build dir unless noted)

- `npx tsc --noEmit` → exit 0
- `npm run build` → real `dist/` (cli.js, forward.js, mcp.js, all
  non-empty, with `.d.ts` + source maps)
- `node dist/cli.js --version` → `0.1.0`; unknown subcommand → usage on
  stderr, exit 2
- `npm test` → **52 tests, 52 pass, 0 fail** (8 suites: registration
  integrity — served tools deep-equal the fixture's full 2 tool
  objects, names in order, exactly the fixture's keys with no `title`
  key, required fields per tool, every property key in order, format
  enum + property-type literals, credit wording, isKnownTool; session
  establishment/reuse/session-id handling, clientInfo/protocol
  version; env URL override, explicit url override, explicit-over-env
  precedence, blank-env fallback; Authorization Bearer header present
  on every request when the key is set / absent when unset / no
  X-API-Key header in either case; verbatim argument forwarding for
  both tools incl. fully-specified calls; verbatim result pass-through
  incl. upstream isError and SSE; JSON-RPC/init/malformed/no-result/
  HTTP/throw/timeout failures → `imgpage error:`; parseRpcBody JSON +
  SSE + matching-id + [DONE] cases; MCP-layer MethodNotFound /
  InvalidParams validation; CLI --version / -v / unknown exit 2 /
  bad-JSON exit 2 / `mcp extra` exit 2)
- Parity: `python3 harness/parity.py --original
  harness/fixtures/html2img-tools-original.json --rebuild
  "stdio:node builds/imgpage/dist/cli.js mcp" --out
  builds/imgpage/parity-out` (run from `~/workspace/mcp-rebuild-100`)
  → **PASS, parity 100.0, 2/2 identical, no missing/extra/schema
  diffs** (see `parity-out/parity.json`)
- Consistency sweep: package.json version = server.json top-level =
  npm-entry version = OCI tag = core `VERSION` = CHANGELOG heading
  (0.1.0); package.json `mcpName` = server.json `name` = Dockerfile
  label; server.json description measured at 80 chars; OCI entry
  confirmed to have no `version` field.

Clean-room: all prose and code written fresh for imgpage; only the
mechanics were patterned on the sibling carddata build (same
forwarding-client class), and only the fixture's tool literals are
served verbatim.
