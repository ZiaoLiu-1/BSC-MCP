import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

// Load environment variables
dotenv.config();

// Get the directory name for the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize BSC provider with network configuration
const provider = new ethers.JsonRpcProvider(
  process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com',
  {
    name: 'bnbt',
    chainId: 97
  }
);

// Helper function to read wallet files
const getWalletDir = () => {
  const walletDir = path.join(__dirname, 'wallets');
  if (!fs.existsSync(walletDir)) {
    fs.mkdirSync(walletDir, { recursive: true });
  }
  return walletDir;
};

// Helper function to list wallets
const listWallets = () => {
  const walletDir = getWalletDir();
  const files = fs.readdirSync(walletDir);
  return files
    .filter(file => file.endsWith('.json'))
    .map(file => {
      const walletData = JSON.parse(fs.readFileSync(path.join(walletDir, file), 'utf8'));
      return walletData.address;
    });
};

// Helper function to get wallet details
const getWalletDetails = async (address) => {
  const balance = await provider.getBalance(address);
  return {
    address,
    balance: ethers.formatEther(balance),
    balanceInWei: balance.toString(),
    currency: 'tBNB'
  };
};

// Define tool schemas
const WalletCreateSchema = z.object({
  name: z.string().optional()
});

const WalletImportSchema = z.object({
  privateKey: z.string(),
  name: z.string().optional()
});

const WalletBalanceSchema = z.object({
  address: z.string()
});

const WalletSendSchema = z.object({
  address: z.string(),
  to: z.string(),
  amount: z.string()
});

const TokenListSchema = z.object({
  address: z.string()
});

const TokenBalanceSchema = z.object({
  address: z.string(),
  tokenAddress: z.string()
});

const TokenTransferSchema = z.object({
  address: z.string(),
  tokenAddress: z.string(),
  to: z.string(),
  amount: z.string()
});

const TokenApproveSchema = z.object({
  address: z.string(),
  tokenAddress: z.string(),
  spender: z.string(),
  amount: z.string()
});

// Tool implementations
const walletCreateTool = async (args) => {
  try {
    // Generate a new random wallet
    const wallet = ethers.Wallet.createRandom();
    const walletName = args.name || `wallet-${Date.now()}`;
    const walletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      name: walletName,
      createdAt: new Date().toISOString()
    };
    
    // Save wallet to file
    const walletDir = getWalletDir();
    fs.writeFileSync(
      path.join(walletDir, `${walletName}.json`),
      JSON.stringify(walletData, null, 2)
    );
    
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          wallet: {
            address: wallet.address,
            name: walletName
          }
        })
      }]
    };
  } catch (error) {
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'error',
          message: error.message
        })
      }],
      isError: true
    };
  }
};

const walletImportTool = async (args) => {
  try {
    // Create wallet from private key
    const wallet = new ethers.Wallet(args.privateKey);
    const walletName = args.name || `wallet-${Date.now()}`;
    const walletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      name: walletName,
      createdAt: new Date().toISOString()
    };
    
    // Save wallet to file
    const walletDir = getWalletDir();
    fs.writeFileSync(
      path.join(walletDir, `${walletName}.json`),
      JSON.stringify(walletData, null, 2)
    );
    
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          wallet: {
            address: wallet.address,
            name: walletName
          }
        })
      }]
    };
  } catch (error) {
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'error',
          message: error.message
        })
      }],
      isError: true
    };
  }
};

const walletListTool = async () => {
  try {
    const addresses = listWallets();
    const detailsPromises = addresses.map(getWalletDetails);
    const wallets = await Promise.all(detailsPromises);
    
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          wallets,
          totalWallets: wallets.length
        })
      }]
    };
  } catch (error) {
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'error',
          message: error.message
        })
      }],
      isError: true
    };
  }
};

const walletBalanceTool = async (args) => {
  try {
    const details = await getWalletDetails(args.address);
    
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          wallet: details
        })
      }]
    };
  } catch (error) {
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'error',
          message: error.message
        })
      }],
      isError: true
    };
  }
};

const walletSendTool = async (args) => {
  try {
    // Find wallet file
    const walletDir = getWalletDir();
    const files = fs.readdirSync(walletDir);
    const walletFile = files.find(file => {
      const data = JSON.parse(fs.readFileSync(path.join(walletDir, file), 'utf8'));
      return data.address.toLowerCase() === args.address.toLowerCase();
    });
    
    if (!walletFile) {
      throw new Error(`Wallet with address ${args.address} not found`);
    }
    
    // Load wallet
    const walletData = JSON.parse(fs.readFileSync(path.join(walletDir, walletFile), 'utf8'));
    const wallet = new ethers.Wallet(walletData.privateKey, provider);
    
    // Send transaction
    const tx = await wallet.sendTransaction({
      to: args.to,
      value: ethers.parseEther(args.amount)
    });
    
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          transaction: {
            hash: tx.hash,
            from: args.address,
            to: args.to,
            amount: args.amount,
            blockNumber: tx.blockNumber
          }
        })
      }]
    };
  } catch (error) {
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'error',
          message: error.message
        })
      }],
      isError: true
    };
  }
};

const tokenListTool = async (args) => {
  try {
    // For simplicity, just return a list of known tokens
    const tokens = [
      { symbol: 'BUSD', name: 'Binance USD', address: '0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee' },
      { symbol: 'CAKE', name: 'PancakeSwap Token', address: '0xFa60D973F7642B748046464e165A65B7323b0DEE' }
    ];
    
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          tokens,
          wallet: args.address
        })
      }]
    };
  } catch (error) {
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'error',
          message: error.message
        })
      }],
      isError: true
    };
  }
};

const tokenBalanceTool = async (args) => {
  try {
    // Create token contract instance
    const abi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)"
    ];
    const tokenContract = new ethers.Contract(args.tokenAddress, abi, provider);
    
    // Get token details
    const balance = await tokenContract.balanceOf(args.address);
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();
    
    // Format balance
    const formattedBalance = ethers.formatUnits(balance, decimals);
    
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          token: {
            address: args.tokenAddress,
            symbol,
            balance: formattedBalance,
            balanceRaw: balance.toString()
          },
          wallet: args.address
        })
      }]
    };
  } catch (error) {
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'error',
          message: error.message
        })
      }],
      isError: true
    };
  }
};

const tokenTransferTool = async (args) => {
  try {
    // Find wallet file
    const walletDir = getWalletDir();
    const files = fs.readdirSync(walletDir);
    const walletFile = files.find(file => {
      const data = JSON.parse(fs.readFileSync(path.join(walletDir, file), 'utf8'));
      return data.address.toLowerCase() === args.address.toLowerCase();
    });
    
    if (!walletFile) {
      throw new Error(`Wallet with address ${args.address} not found`);
    }
    
    // Load wallet
    const walletData = JSON.parse(fs.readFileSync(path.join(walletDir, walletFile), 'utf8'));
    const wallet = new ethers.Wallet(walletData.privateKey, provider);
    
    // Create token contract instance
    const abi = [
      "function transfer(address to, uint amount) returns (bool)",
      "function decimals() view returns (uint8)"
    ];
    const tokenContract = new ethers.Contract(args.tokenAddress, abi, wallet);
    
    // Get token decimals
    const decimals = await tokenContract.decimals();
    
    // Send transaction
    const tx = await tokenContract.transfer(args.to, ethers.parseUnits(args.amount, decimals));
    
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          transaction: {
            hash: tx.hash,
            from: args.address,
            to: args.to,
            tokenAddress: args.tokenAddress,
            amount: args.amount
          }
        })
      }]
    };
  } catch (error) {
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'error',
          message: error.message
        })
      }],
      isError: true
    };
  }
};

const tokenApproveTool = async (args) => {
  try {
    // Find wallet file
    const walletDir = getWalletDir();
    const files = fs.readdirSync(walletDir);
    const walletFile = files.find(file => {
      const data = JSON.parse(fs.readFileSync(path.join(walletDir, file), 'utf8'));
      return data.address.toLowerCase() === args.address.toLowerCase();
    });
    
    if (!walletFile) {
      throw new Error(`Wallet with address ${args.address} not found`);
    }
    
    // Load wallet
    const walletData = JSON.parse(fs.readFileSync(path.join(walletDir, walletFile), 'utf8'));
    const wallet = new ethers.Wallet(walletData.privateKey, provider);
    
    // Create token contract instance
    const abi = [
      "function approve(address spender, uint amount) returns (bool)",
      "function decimals() view returns (uint8)"
    ];
    const tokenContract = new ethers.Contract(args.tokenAddress, abi, wallet);
    
    // Get token decimals
    const decimals = await tokenContract.decimals();
    
    // Send transaction
    const tx = await tokenContract.approve(args.spender, ethers.parseUnits(args.amount, decimals));
    
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          transaction: {
            hash: tx.hash,
            from: args.address,
            spender: args.spender,
            tokenAddress: args.tokenAddress,
            amount: args.amount
          }
        })
      }]
    };
  } catch (error) {
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'error',
          message: error.message
        })
      }],
      isError: true
    };
  }
};

// 1. Create an MCP server instance
const server = new Server(
  {
    name: "BSC Wallet Provider",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// 2. Define the list of tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "wallet.create",
        description: "Create a new BSC wallet",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Optional name for the wallet"
            }
          },
          required: []
        }
      },
      {
        name: "wallet.import",
        description: "Import an existing BSC wallet using private key",
        inputSchema: {
          type: "object",
          properties: {
            privateKey: {
              type: "string",
              description: "Private key of the wallet"
            },
            name: {
              type: "string",
              description: "Optional name for the wallet"
            }
          },
          required: ["privateKey"]
        }
      },
      {
        name: "wallet.list",
        description: "List all available wallets",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "wallet.balance",
        description: "Get the balance of a wallet",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Wallet address"
            }
          },
          required: ["address"]
        }
      },
      {
        name: "wallet.send",
        description: "Send BNB from a wallet to another address",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Source wallet address"
            },
            to: {
              type: "string",
              description: "Destination address"
            },
            amount: {
              type: "string",
              description: "Amount of BNB to send"
            }
          },
          required: ["address", "to", "amount"]
        }
      },
      {
        name: "token.list",
        description: "List all available tokens for a wallet",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Wallet address"
            }
          },
          required: ["address"]
        }
      },
      {
        name: "token.balance",
        description: "Get the balance of a token for a wallet",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Wallet address"
            },
            tokenAddress: {
              type: "string",
              description: "Token contract address"
            }
          },
          required: ["address", "tokenAddress"]
        }
      },
      {
        name: "token.transfer",
        description: "Transfer tokens from a wallet to another address",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Source wallet address"
            },
            tokenAddress: {
              type: "string",
              description: "Token contract address"
            },
            to: {
              type: "string",
              description: "Destination address"
            },
            amount: {
              type: "string",
              description: "Amount of tokens to transfer"
            }
          },
          required: ["address", "tokenAddress", "to", "amount"]
        }
      },
      {
        name: "token.approve",
        description: "Approve a spender to use tokens from a wallet",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Wallet address"
            },
            tokenAddress: {
              type: "string",
              description: "Token contract address"
            },
            spender: {
              type: "string",
              description: "Spender address"
            },
            amount: {
              type: "string",
              description: "Amount of tokens to approve"
            }
          },
          required: ["address", "tokenAddress", "spender", "amount"]
        }
      }
    ]
  };
});

// 3. Implement the tool call logic
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case "wallet.create": {
      const validated = WalletCreateSchema.parse(args);
      return await walletCreateTool(validated);
    }
    case "wallet.import": {
      const validated = WalletImportSchema.parse(args);
      return await walletImportTool(validated);
    }
    case "wallet.list": {
      return await walletListTool();
    }
    case "wallet.balance": {
      const validated = WalletBalanceSchema.parse(args);
      return await walletBalanceTool(validated);
    }
    case "wallet.send": {
      const validated = WalletSendSchema.parse(args);
      return await walletSendTool(validated);
    }
    case "token.list": {
      const validated = TokenListSchema.parse(args);
      return await tokenListTool(validated);
    }
    case "token.balance": {
      const validated = TokenBalanceSchema.parse(args);
      return await tokenBalanceTool(validated);
    }
    case "token.transfer": {
      const validated = TokenTransferSchema.parse(args);
      return await tokenTransferTool(validated);
    }
    case "token.approve": {
      const validated = TokenApproveSchema.parse(args);
      return await tokenApproveTool(validated);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// 4. Start the MCP server with a stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BSC Wallet Provider MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
}); 