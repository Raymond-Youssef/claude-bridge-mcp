# claude-bridge-mcp

An MCP server that connects the [Claude Bridge Chrome extension](https://github.com/Raymond-Youssef/claude-bridge-chrome-extension) to [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Click any element in Chrome and Claude Code instantly knows the React component name, source file, props, and styles.

## Quick start

```bash
claude mcp add claude-bridge -- npx claude-bridge-mcp
```

That's it. The server starts automatically when Claude Code needs it.

## What it does

When you capture a UI element with the Claude Bridge Chrome extension, this MCP server receives the element data over WebSocket and exposes it to Claude Code through two tools:

### `get_selected_element`

Returns full context for the last captured element:

- **React component** — name, source file path + line number, props, parent chain (up to 3 levels)
- **DOM** — CSS selector, tag, id, classes, text content
- **Computed styles** — color, font, padding, margin, display, flex, border-radius, etc.
- **HTML** — outer HTML snippet (up to 2000 chars)
- **Page context** — URL and capture timestamp

Accepts an optional `index` parameter to retrieve previous selections from history.

### `get_selection_history`

Returns a summary of the last 10 captured elements, showing component name, source file, and page URL for each.

## How it works

```
Chrome Extension  →  WebSocket (:18925)  →  MCP Server (stdio)  →  Claude Code
```

1. The Chrome extension captures element data (React fiber info, DOM, styles) and sends it over WebSocket
2. This server stores the last 10 captures in memory
3. Claude Code queries the data via MCP tools to understand what you're pointing at

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `CLAUDE_BRIDGE_PORT` | `18925` | WebSocket port the server listens on |

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Claude Bridge Chrome extension](https://github.com/Raymond-Youssef/claude-bridge-chrome-extension)
- Node.js 18+

## Privacy

All data stays on your machine. The server runs locally and communicates only over `localhost`.

## License

MIT
