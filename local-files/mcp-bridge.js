#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

// MCP Server configuration
const MCP_CONFIG = {
  command: 'npx',
  args: ['-y', '@taazkareem/clickup-mcp-server@latest'],
  env: {
    ...process.env,
    CLICKUP_API_KEY: process.env.CLICKUP_API_KEY || 'YOUR_CLICKUP_API_KEY',
    CLICKUP_TEAM_ID: process.env.CLICKUP_TEAM_ID || 'YOUR_CLICKUP_TEAM_ID',
    DOCUMENT_SUPPORT: 'true'
  }
};

class MCPBridge {
  constructor() {
    this.mcpProcess = null;
  }

  async startMCPServer() {
    return new Promise((resolve, reject) => {
      this.mcpProcess = spawn(MCP_CONFIG.command, MCP_CONFIG.args, {
        env: MCP_CONFIG.env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let initTimeout = setTimeout(() => {
        reject(new Error('MCP server failed to initialize within timeout'));
      }, 10000);

      this.mcpProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('MCP Server Output:', output);

        // Check if server is ready (adjust this condition based on your MCP server's output)
        if (output.includes('Server started') || output.includes('ready')) {
          clearTimeout(initTimeout);
          resolve();
        }
      });

      this.mcpProcess.stderr.on('data', (data) => {
        console.error('MCP Server Error:', data.toString());
      });

      this.mcpProcess.on('error', (error) => {
        clearTimeout(initTimeout);
        reject(error);
      });
    });
  }

  async sendCommand(action, params = {}) {
    if (!this.mcpProcess) {
      await this.startMCPServer();
    }

    return new Promise((resolve, reject) => {
      const command = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: this.getMethodForAction(action),
        params: params
      };

      const commandString = JSON.stringify(command) + '\n';

      let responseData = '';
      const responseTimeout = setTimeout(() => {
        reject(new Error('MCP command timeout'));
      }, 30000);

      const onData = (data) => {
        responseData += data.toString();

        try {
          const response = JSON.parse(responseData.trim());
          clearTimeout(responseTimeout);
          this.mcpProcess.stdout.removeListener('data', onData);

          if (response.error) {
            reject(new Error(`MCP Error: ${response.error.message}`));
          } else {
            resolve(response.result);
          }
        } catch (e) {
          // Continue accumulating data if JSON is incomplete
        }
      };

      this.mcpProcess.stdout.on('data', onData);
      this.mcpProcess.stdin.write(commandString);
    });
  }

  getMethodForAction(action) {
    const actionMethods = {
      'list_tasks': 'tools/list',
      'get_task': 'tools/call',
      'create_task': 'tools/call',
      'update_task': 'tools/call',
      'list_spaces': 'tools/call',
      'get_resources': 'resources/list'
    };

    return actionMethods[action] || 'tools/list';
  }

  async cleanup() {
    if (this.mcpProcess) {
      this.mcpProcess.kill('SIGTERM');
      this.mcpProcess = null;
    }
  }
}

async function main() {
  try {
    // Get input from n8n (passed as environment variables or command line args)
    const action = process.env.N8N_ACTION || process.argv[2] || 'list_tasks';
    const params = process.env.N8N_PARAMS ? JSON.parse(process.env.N8N_PARAMS) : {};

    console.log(`Executing MCP action: ${action} with params:`, params);

    const bridge = new MCPBridge();
    const result = await bridge.sendCommand(action, params);

    // Output result for n8n to capture
    console.log(JSON.stringify({
      success: true,
      action: action,
      result: result,
      timestamp: new Date().toISOString()
    }));

    await bridge.cleanup();
    process.exit(0);

  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    process.exit(1);
  }
}

// Handle process cleanup
process.on('SIGINT', async () => {
  console.log('Received SIGINT, cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, cleaning up...');
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { MCPBridge };
