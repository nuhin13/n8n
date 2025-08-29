// mcp-http-wrapper.js
const express = require('express');
const { spawn } = require('child_process');

const app = express();
app.use(express.json());

app.post('/mcp/call', async (req, res) => {
    const { method, params } = req.body;

    // Call your MCP server
    const mcp = spawn('npx', ['-y', '@taazkareem/clickup-mcp-server@latest'], {
        env: {
            ...process.env,
            CLICKUP_API_KEY: "pk_42504975_ENW1G44B67UA6YMMQGGUSVIT63RP6W05",
            CLICKUP_TEAM_ID: "36240623",
            DOCUMENT_SUPPORT: "true"
        }
    });

    // Handle MCP communication here
    // This is a simplified version - implement proper JSON-RPC

    res.json({ result: "MCP response" });
});

app.listen(3001, () => console.log('MCP wrapper running on port 3001'));