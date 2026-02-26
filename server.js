#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer } from 'ws';

const WS_PORT = parseInt(process.env.CLAUDE_BRIDGE_PORT || '18925', 10);

let selectedElement = null;
let elementHistory = [];

// --- WebSocket: receives from Chrome extension ---
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.error('[claude-bridge] Chrome extension connected');

  ws.on('message', (data) => {
    selectedElement = JSON.parse(data.toString());
    elementHistory.unshift(selectedElement);
    if (elementHistory.length > 10) elementHistory.pop();

    const name = selectedElement.react?.componentChain?.[0]?.componentName
              || selectedElement.selector;
    console.error(`[claude-bridge] Captured: ${name}`);
  });
});

// --- MCP Server ---
const server = new Server(
  { name: 'claude-bridge', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_selected_element',
      description:
        'Returns the UI element the user last Option+Clicked in Chrome. ' +
        'Includes React component name, source file path + line number, props, ' +
        'CSS selector, computed styles, and HTML snippet. ' +
        'Use this to find which file to modify.',
      inputSchema: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'History index. 0 = latest (default), 1 = previous.'
          }
        }
      }
    },
    {
      name: 'get_selection_history',
      description: 'Returns a summary of the last 10 selected elements.',
      inputSchema: { type: 'object', properties: {} }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_selected_element') {
    const index = args?.index || 0;
    const el = elementHistory[index];

    if (!el) {
      return {
        content: [{
          type: 'text',
          text: 'No element selected. Enable inspect mode and Option+Click an element in Chrome.'
        }]
      };
    }

    const lines = [];

    // React component info — the most valuable part
    if (el.react?.componentChain?.length) {
      const comp = el.react.componentChain[0];
      lines.push(`## React Component`);
      lines.push(`- **Name:** ${comp.componentName}`);
      if (comp.fileName) {
        lines.push(`- **File:** ${comp.fileName}`);
        if (comp.lineNumber) lines.push(`- **Line:** ${comp.lineNumber}`);
      }
      if (el.react.componentChain.length > 1) {
        lines.push(`- **Parent chain:** ${
          el.react.componentChain.map(c => c.componentName).join(' → ')
        }`);
      }
      if (el.react.props && Object.keys(el.react.props).length) {
        lines.push(`- **Props:** \`${JSON.stringify(el.react.props)}\``);
      }
    }

    // DOM info
    lines.push(`\n## DOM`);
    lines.push(`- **Selector:** \`${el.selector}\``);
    lines.push(`- **Tag:** \`<${el.tagName}>\``);
    if (el.id) lines.push(`- **ID:** ${el.id}`);
    if (el.className) lines.push(`- **Classes:** \`${el.className}\``);
    if (el.textContent) lines.push(`- **Text:** "${el.textContent.slice(0, 100)}"`);

    // Computed styles
    if (el.computedStyles && Object.keys(el.computedStyles).length) {
      lines.push(`\n## Current Styles`);
      for (const [prop, val] of Object.entries(el.computedStyles)) {
        lines.push(`- \`${prop}\`: ${val}`);
      }
    }

    // HTML snippet
    lines.push(`\n## HTML`);
    lines.push('```html');
    lines.push(el.html);
    lines.push('```');

    // Context
    lines.push(`\n- **Page:** ${el.pageUrl}`);
    lines.push(`- **Captured:** ${el.timestamp}`);

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  if (name === 'get_selection_history') {
    if (!elementHistory.length) {
      return { content: [{ type: 'text', text: 'No elements selected yet.' }] };
    }

    const summary = elementHistory.map((el, i) => {
      const comp = el.react?.componentChain?.[0];
      const label = comp?.componentName || el.selector;
      const file = comp?.fileName?.split('/').pop() || '(no source)';
      return `${i}: **${label}** — ${file} — ${el.pageUrl}`;
    }).join('\n');

    return { content: [{ type: 'text', text: summary }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[claude-bridge] MCP server running, WebSocket on :${WS_PORT}`);
