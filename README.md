# imgpage

imgpage is a small local bridge to the hosted html2img
MCP server, which turns markup and web pages into
rendered output. Give it a complete, self-contained
HTML document — styles in an inline style block — and
it comes back as a PNG image sized to a viewport you
choose, or as an A4 vector PDF with selectable text
when you ask for the pdf format. Or give it the
address of a live page and it screenshots that page
instead, whole page or just one element, again as PNG
or PDF. Every render also returns a shareable CDN
URL; PDF renders return the URL only.

This package renders nothing itself. It answers the
tool list locally, exactly as captured from the live
endpoint, and forwards each tool call upstream,
returning whatever comes back untouched. There are
two tools, and per the captured descriptions each
call consumes one credit on your own html2img plan.
Nothing in this package can buy credits, start a
checkout, top up an account, or mint a key: it only
spends against a plan you already have, through the
two rendering calls below.

## Tools

- `generate-image-from-html` — render HTML and CSS
  into a PNG image, or into an A4 vector PDF with
  format `pdf`. Required: `html` (the full markup;
  include CSS in an inline style block; publicly
  accessible remote image URLs work, and images that
  are not hosted anywhere should be embedded as base64
  data URIs). Optional: `css`, `width` (1-5000,
  default 1920), `height` (1-5000, default 1080),
  `fullpage`, `dpi` (1-4), `ms_delay` (1-5000),
  `wait_for_selector`, and `format` (`png` or `pdf`;
  with `pdf`, width, height, dpi and fullpage are
  ignored). Returns the rendered image plus a
  shareable CDN URL; PDF renders return the URL only.
  Consumes one credit per call.
- `screenshot-url` — capture a live web page by URL
  as a PNG screenshot, or as an A4 vector PDF with
  format `pdf`. Required: `url` (the fully-qualified
  URL of the page). Optional: `css`, `width` (1-5000,
  default 1920), `height` (1-5000, default 1080),
  `fullpage`, `selector` (capture only the matching
  element), `dpi` (1-4), `ms_delay` (1-5000),
  `wait_for_selector`, and `format` (`png` or `pdf`;
  with `pdf`, width, height, dpi, fullpage and
  selector are ignored). Returns the rendered image
  plus a shareable CDN URL; PDF renders return the
  URL only. Consumes one credit per call.

## Configuration

- `HTML2IMG_MCP_URL` (optional) — override the
  upstream endpoint. Defaults to
  `https://app.html2img.com/mcp`. (The override hook
  is this rebuild's own labelled reconstruction.)
- `HTML2IMG_API_KEY` (optional) — when set, every
  upstream request carries an
  `Authorization: Bearer <key>` header, for the
  caller's own html2img API key. When it is not set,
  no key header is sent. (The header name and Bearer
  form are pinned by the original's registry record,
  which declares a required secret `Authorization`
  header; the record pins no package env name, so
  forwarding the key from this env var is a labelled
  reconstruction — the original surface was captured
  keyless.)

### Forwarding mechanics

On the first tool call the client opens a streamable
HTTP session upstream: a JSON-RPC `initialize`
request (protocolVersion `2025-03-26`, clientInfo
name `imgpage`), then a
`notifications/initialized` notification, then the
`tools/call` request carrying the caller's arguments
unchanged. When the upstream answers `initialize`
with an `Mcp-Session-Id` header, that value rides on
every later request of the session, which is reused
for the life of the process. Replies may arrive as
plain JSON or as server-sent events; both are read.

Successful upstream results pass through verbatim,
including any `isError` flag the upstream sets.
Failures — a JSON-RPC error, a non-2xx status, an
unreadable response, or a request that cannot be
completed — come back as an `isError` result whose
text starts with `imgpage error:` (this rendering is
this rebuild's own labelled reconstruction).

## CLI

Each tool is also a subcommand taking one JSON
argument string:

```bash
npx @reneturcios/imgpage generate-image-from-html '{"html":"<h1>Hello</h1>"}'
npx @reneturcios/imgpage screenshot-url '{"url":"https://example.com"}'
npx @reneturcios/imgpage --version
```

Exit codes: `0` on success, `1` on an `isError`
result, `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/imgpage mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "imgpage": {
      "command": "npx",
      "args": ["-y", "@reneturcios/imgpage", "mcp"]
    }
  }
}
```

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/imgpage
docker run --rm ghcr.io/cloudcorprecords/imgpage --version
```

The container's default command is `mcp`, so the first
form is a stdio MCP server; any other arguments reach
the CLI normally.

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

The test suite runs entirely against a stubbed
JSON-RPC upstream — no live network calls.

## License

MIT — see `LICENSE`.
