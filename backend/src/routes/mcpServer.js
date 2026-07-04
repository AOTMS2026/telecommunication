const express = require('express');
const router = express.Router();
const { protectMcp } = require('../middleware/mcpAuth');
const { TOOLS, callTool } = require('../services/mcpToolset');

const PROTOCOL_VERSION = '2025-03-26';

// Real MCP endpoint — this is what Claude/ChatGPT/Gemini connect to.
// POST https://<backend>/mcp  with header  Authorization: Bearer mcp_xxx
router.post('/', protectMcp, async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};
  if (jsonrpc !== '2.0' || !method) {
    return res.status(400).json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32600, message: 'Invalid JSON-RPC request' } });
  }

  try {
    switch (method) {
      case 'initialize':
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: 'aotms-mcp-server', version: '1.0.0' },
          },
        });

      case 'notifications/initialized':
        return res.status(202).end();

      case 'ping':
        return res.json({ jsonrpc: '2.0', id, result: {} });

      case 'tools/list':
        return res.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });

      case 'tools/call': {
        const { name, arguments: args } = params || {};
        const tool = TOOLS.find(t => t.name === name);
        if (!tool) {
          return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${name}` } });
        }
        try {
          const data = await callTool(name, args || {});
          return res.json({
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: false },
          });
        } catch (toolErr) {
          return res.json({
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: toolErr.message }], isError: true },
          });
        }
      }

      default:
        return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  } catch (err) {
    return res.json({ jsonrpc: '2.0', id, error: { code: -32000, message: err.message } });
  }
});

// This server only implements Streamable HTTP (POST). No SSE stream on GET.
router.get('/', protectMcp, (req, res) => {
  res.status(405).json({ message: 'Method not allowed. Use POST with JSON-RPC 2.0 body.' });
});

module.exports = router;