# Changelog

## 0.1.0 (2026-10-28)

- First release: a forwarding client for the hosted html2img MCP server, serving the two captured tools locally for tools/list and forwarding every tools/call upstream over a streamable-HTTP JSON-RPC session (initialize, notifications/initialized, tools/call, honouring the Mcp-Session-Id header when issued).
- Tools: `generate-image-from-html` and `screenshot-url`. Each call consumes one credit on the caller's own html2img plan, per the captured descriptions; no purchase, checkout, top-up or key-minting tool is part of this surface.
- Upstream results pass through verbatim; upstream failures surface as `imgpage error:` text results.
- One bin serves the CLI (one subcommand per tool, plus `--version`) and the stdio MCP server (`mcp` subcommand). Upstream endpoint overridable via `HTML2IMG_MCP_URL`; when `HTML2IMG_API_KEY` is set it is sent as an `Authorization: Bearer` header.
