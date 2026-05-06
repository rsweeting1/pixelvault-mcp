# pixelvault-mcp

MCP server for [PixelVault](https://pixelvault-ui.vercel.app) — AI-native marketplace for pre-cleared licensed assets.

## Install

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "pixelvault": {
      "command": "npx",
      "args": ["-y", "pixelvault-mcp"]
    }
  }
}
```

Or run directly:

```
npx pixelvault-mcp
```

## Tools

### search_assets
Search PixelVault's database of pre-cleared AI-generated assets using a natural language brief. Returns a ranked shortlist with compliance status and rationale for each match.

### get_asset_details
Retrieve full metadata and compliance documentation for a specific asset by ID.

### generate_usage_agreement
Generate a completed usage agreement draft based on your project parameters (usage type, territory, duration, platform).

## About

PixelVault is a compliance-cleared AI asset marketplace. Every asset is sourced from licensed AI platforms (Adobe Firefly, Moonvalley) and pre-cleared for commercial use. The MCP server gives Claude agents native access to search, evaluate, and license assets without leaving your workflow.

- **Site:** https://pixelvault-ui.vercel.app
- **OpenAPI:** https://pixelvault-ui.vercel.app/openapi.json
- **npm:** `pixelvault-mcp`

## License

MIT
