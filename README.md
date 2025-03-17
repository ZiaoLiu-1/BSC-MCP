# MCP Server for BSC Wallet Management

This MCP (Model Context Protocol) server provides tools for managing BSC wallets and tokens, as well as deploying smart contracts directly from your local environment.

## Available Tools

### Wallet Management
- **wallet.create** - Create a new BSC wallet
- **wallet.import** - Import an existing BSC wallet using private key
- **wallet.list** - List all available wallets
- **wallet.balance** - Get the balance of a wallet
- **wallet.send** - Send BNB from a wallet to another address

### Token Management
- **token.list** - List all available tokens for a wallet
- **token.balance** - Get the balance of a token for a wallet
- **token.transfer** - Transfer tokens from a wallet to another address
- **token.approve** - Approve a spender to use tokens from a wallet

### Contract Deployment
- **contract.deploy** - Deploy a smart contract from a compiled JSON artifact

## How to Use Contract Deployment

The new contract deployment feature allows you to deploy smart contracts directly from your local environment without having to use additional tools or commands.

### Prerequisites
1. A compiled contract JSON artifact (ABI and bytecode)
2. A wallet with sufficient BNB for gas fees

### Example Usage

1. Create or import a wallet:
```javascript
// Create a new wallet
const result = await mcp__wallet_create({ name: "DeployerWallet" });

// Or import an existing wallet
const result = await mcp__wallet_import({ 
  privateKey: "your-private-key", 
  name: "DeployerWallet" 
});
```

2. Make sure your wallet has enough BNB for gas fees:
```javascript
const result = await mcp__wallet_balance({ address: "your-wallet-address" });
```

3. Deploy a contract using the compiled JSON artifact:
```javascript
const result = await mcp__contract_deploy({
  address: "your-wallet-address",
  contractPath: "/path/to/your/contract.json",
  constructorArgs: ["Constructor", "Args", "Here"],
  gasLimit: "5000000" // Optional
});
```

### Example: Deploy an ERC20 Token

The repository includes a sample ERC20 token contract JSON artifact (`SimpleToken.json`) that you can use to test the deployment feature:

```javascript
const result = await mcp__contract_deploy({
  address: "your-wallet-address",
  contractPath: "./SimpleToken.json",
  constructorArgs: ["My Token", "MTK", "1000000000000000000000000"] // Name, Symbol, Initial Supply (1 million tokens with 18 decimals)
});
```

After successful deployment, you'll receive a response with the contract address and transaction hash:

```json
{
  "status": "success",
  "contract": {
    "address": "0x...",
    "deploymentTransaction": "0x...",
    "deployer": "0x..."
  }
}
```

## Notes

- The contract deployment feature currently supports only compiled JSON artifacts with ABI and bytecode.
- Direct Solidity compilation is not supported. You need to compile your contracts separately before deployment.
- Make sure your wallet has enough BNB to cover the gas fees for contract deployment.
- The constructor arguments must match the expected types and order defined in your contract. 