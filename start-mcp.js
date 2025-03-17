// Script to start the MCP server and output configuration
const { spawn } = require('child_process');
const path = require('path');

// MCP configuration
const mcpConfig = {
  providers: [
    {
      name: 'BSC Wallet Provider',
      endpoint: 'http://localhost:3000/mcp/v1',
      capabilities: [
        'wallet.create',
        'wallet.import',
        'wallet.list',
        'wallet.balance',
        'wallet.send',
        'token.list', 
        'token.balance',
        'token.transfer',
        'token.approve'
      ]
    }
  ]
};

// Check if server is already running
const http = require('http');
const checkServer = () => {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000/health', (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.end();
  });
};

// Main function
async function main() {
  // Check if server is already running
  const isRunning = await checkServer();
  
  if (isRunning) {
    // Server is already running, just output the configuration
    console.log(JSON.stringify(mcpConfig));
  } else {
    // Start the server
    const serverProcess = spawn('npm', ['start'], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd()
    });
    
    // Detach the process so it continues running after this script exits
    serverProcess.unref();
    
    // Wait for server to start (up to 5 seconds)
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const serverStarted = await checkServer();
      
      if (serverStarted) {
        console.log(JSON.stringify(mcpConfig));
        break;
      }
      
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      console.error('Failed to start server');
      process.exit(1);
    }
  }
}

// Run the main function
main(); 