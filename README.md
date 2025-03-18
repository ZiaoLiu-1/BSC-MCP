# BSC Wallet Provider for Cursor

This MCP (Model Context Protocol) server provides tools for managing BSC wallets and tokens directly within Cursor.

## Features

- **Wallet Management**: Create, import, list wallets and check balances
- **Token Operations**: Transfer tokens, check balances, and approve spending
- **Network Switching**: Toggle between BSC Mainnet and Testnet without restart
- **Persistent Storage**: Wallets are saved locally for future sessions

## Installation

1. Clone this repository
2. Install dependencies
   ```
   npm install
   ```
3. Create a `.env` file (optional) to customize network settings

## Adding to Cursor

1. Open Cursor
2. Go to Settings -> MCP Servers
3. Click "Add new global MCP server"
4. Give it a name (e.g., "BSC Wallet")
5. For the command, enter:
   ```
   node /path/to/mcp-server-new.js
   ```
   Replace `/path/to/` with the actual path where you saved the file
   
   Example: `node ~/Desktop/mcp/mcp-server-new.js`

## Available Tools

### Wallet Management
- **wallet.create** - Create a new BSC wallet
- **wallet.import** - Import an existing BSC wallet using private key
- **wallet.list** - List all available wallets
- **wallet.balance** - Get the balance of a wallet
- **wallet.send** - Send BNB/tBNB from a wallet to another address

### Token Management
- **token.list** - List all tokens for a wallet
- **token.balance** - Get the balance of a token
- **token.transfer** - Transfer tokens between wallets
- **token.approve** - Approve token spending

### Network Operations
- **network.switch** - Switch between mainnet and testnet

## Usage Examples

### Create a wallet
```javascript
const result = await mcp_BSC_wallet_wallet_create({ name: "MyWallet" });
```

### Switch network
```javascript
// Switch to mainnet
const result = await mcp_BSC_wallet_network_switch({ network: "mainnet" });

// Switch to testnet
const result = await mcp_BSC_wallet_network_switch({ network: "testnet" });
```

### Send tokens
```javascript
const result = await mcp_BSC_wallet_token_transfer({
  address: "0xYourWalletAddress",
  tokenAddress: "0xTokenContractAddress",
  to: "0xRecipientAddress",
  amount: "100"
});
```

## Network Configuration

The server can work with both BSC Mainnet and Testnet:

- **Testnet**: For testing with free tBNB (default)
- **Mainnet**: For real transactions with actual BNB

You can switch networks at any time using the `network.switch` tool without restarting the server.

## Notes

- Wallets are stored in the `wallets` directory as JSON files
- The network state persists during the server session
- Your private keys are stored locally and are never sent to any external services 