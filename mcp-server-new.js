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
import { request, gql } from 'graphql-request';
import gmgnClient from './src/services/gmgn.js';
import { getTopTradersGMGN, getTokenTradesGMGN, getMultipleTopTradersGMGN } from './src/services/gmgn-wrapper.js';
import { getTopTradersGMGNTron, getTokenTradesGMGNTron, getMultipleTopTradersGMGNTron } from './src/services/gmgn-tron-wrapper.js';

// Get the directory name for the current module first
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
// Using path.resolve to ensure .env is loaded from the same directory as this script
// This enables running the script from any directory: node /path/to/mcp-server-new.js
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Set up Bitquery API directly in the server
const BITQUERY_ENDPOINT = 'https://streaming.bitquery.io/graphql';
const BITQUERY_API_KEY = process.env.BITQUERY_API_KEY;

// Bitquery API headers
const bitqueryHeaders = {
  'Content-Type': 'application/json',
  'X-API-KEY': BITQUERY_API_KEY
};

// Direct implementation of Bitquery functions
// Get newly created tokens on Four Meme
async function getNewlyCreatedTokensOnFourMeme(limit = 10) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        Transfers(
          orderBy: { descending: Block_Time }
          limit: { count: ${limit} }
          where: {
            Transaction: {
              To: { is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b" }
            }
            Transfer: {
              Sender: { is: "0x0000000000000000000000000000000000000000" }
            }
          }
        ) {
          Transfer {
            Amount
            AmountInUSD
            Currency {
              Name
              Symbol
              SmartContract
              Decimals
            }
            Id
            Index
            Success
            Type
            URI
            Sender
            Receiver
          }
          Call {
            From
            Value
            To
            Signature {
              Name
              Signature
            }
          }
          Log {
            SmartContract
            Signature {
              Name
            }
          }
          TransactionStatus {
            Success
          }
          Transaction {
            Hash
            From
            To
          }
          Block {
            Time
            Number
          }
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, bitqueryHeaders);
    return data.EVM.Transfers;
  } catch (error) {
    console.error('Error fetching newly created tokens:', error);
    throw error;
  }
}

// Get latest trades of a token on Four Meme
async function getLatestTradesOfToken(tokenAddress, limit = 10) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        Events(
          where: {
            Log: {Signature: {Name: {is: "TokenSale"}}}, 
            Arguments: {includes: {Value: {Address: {is: "${tokenAddress}"}}}}}
          orderBy: {descending: Block_Time}
          limit: {count: ${limit}}
        ) {
          Log {
            Signature {
              Name
            }
          }
          Transaction {
            From
            To
            Value
            Type
            Hash
          }
          Arguments {
            Type
            Value {
              ... on EVM_ABI_Boolean_Value_Arg {
                bool
              }
              ... on EVM_ABI_Bytes_Value_Arg {
                hex
              }
              ... on EVM_ABI_BigInt_Value_Arg {
                bigInteger
              }
              ... on EVM_ABI_String_Value_Arg {
                string
              }
              ... on EVM_ABI_Integer_Value_Arg {
                integer
              }
              ... on EVM_ABI_Address_Value_Arg {
                address
              }
            }
            Name
          }
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, bitqueryHeaders);
    return data.EVM.Events;
  } catch (error) {
    console.error(`Error fetching latest trades for token ${tokenAddress}:`, error);
    throw error;
  }
}

// Track trades by a Four Meme user
async function getTradesByUser(userAddress) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        buys: Transfers(
          orderBy: { descending: Block_Time }
          where: {
            Transaction: {
              To: { is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b" }
            }
            Transfer: {
              Receiver: { is: "${userAddress}" }
            }
          }
        ) {
          Transfer {
            Amount
            AmountInUSD
            Currency {
              Name
              Symbol
              SmartContract
              Decimals
            }
            Id
            Index
            Success
            Type
            URI
            Sender
            Receiver
          }
          TransactionStatus {
            Success
          }
          Transaction {
            Hash
            From
            To
          }
          Block {
            Time
            Number
          }
        }
        sells: Transfers(
          orderBy: { descending: Block_Time }
          where: {
            Transaction: {
              To: { is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b" }
            }
            Transfer: {
              Sender: { is: "${userAddress}" }
            }
          }
        ) {
          Transfer {
            Amount
            AmountInUSD
            Currency {
              Name
              Symbol
              SmartContract
              Decimals
            }
            Id
            Index
            Success
            Type
            URI
            Sender
            Receiver
          }
          TransactionStatus {
            Success
          }
          Transaction {
            Hash
            From
            To
          }
          Block {
            Time
            Number
          }
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, bitqueryHeaders);
    return {
      buys: data.EVM.buys,
      sells: data.EVM.sells
    };
  } catch (error) {
    console.error(`Error fetching trades for user ${userAddress}:`, error);
    throw error;
  }
}

// Get latest transfers of a token on Four Meme
async function getLatestTokenTransfers(tokenAddress, limit = 10) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        Transfers(
          orderBy: { descending: Block_Time }
          limit: { count: ${limit} }
          where: {
            Transaction: {
              To: { is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b" }
            }
            Transfer: {
              Currency: {
                SmartContract: { is: "${tokenAddress}" }
              }
            }
            TransactionStatus: { Success: true }
          }
        ) {
          Transfer {
            Amount
            AmountInUSD
            Currency {
              Name
              Symbol
              SmartContract
              Decimals
            }
            Sender
            Receiver
          }
          Transaction {
            Hash
          }
          Block {
            Time
            Number
          }
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, bitqueryHeaders);
    return data.EVM.Transfers;
  } catch (error) {
    console.error(`Error fetching token transfers for ${tokenAddress}:`, error);
    throw error;
  }
}

// Get top buyers for a token on Four Meme
async function getTopBuyersForToken(tokenAddress) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        Transfers(
          orderBy: { descending: Block_Time, descendingByField: "total" }
          where: {
            Transaction: {
              To: { is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b" }
            }
            Transfer: {
              Currency: {
                SmartContract: { is: "${tokenAddress}" }
              }
              Sender: { is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b" }
            }
            TransactionStatus: { Success: true }
          }
        ) {
          Transfer {
            Amount
            AmountInUSD
            Currency {
              Name
              Symbol
              SmartContract
              Decimals
            }
            Buyer: Receiver
          }
          total: sum(of: Transfer_Amount)
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, bitqueryHeaders);
    return data.EVM.Transfers;
  } catch (error) {
    console.error(`Error fetching top buyers for token ${tokenAddress}:`, error);
    throw error;
  }
}

// Track liquidity add events for all tokens on Four Meme
async function getLiquidityAddedEvents(limit = 20) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        Events(
          limit: {count: ${limit}}
          where: {
            LogHeader: {Address: {is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b"}},
            Log: {Signature: {Name: {is: "LiquidityAdded"}}}
          }
        ) {
          Block {
            Time
            Number
            Hash
          }
          Transaction {
            Hash
            From
            To
          }
          Arguments {
            Name
            Value {
              ... on EVM_ABI_Integer_Value_Arg {
                integer
              }
              ... on EVM_ABI_Address_Value_Arg {
                address
              }
              ... on EVM_ABI_BigInt_Value_Arg {
                bigInteger
              }
            }
          }
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, bitqueryHeaders);
    return data.EVM.Events;
  } catch (error) {
    console.error('Error fetching liquidity added events:', error);
    throw error;
  }
}

// Track liquidity add events for a specific token on Four Meme
async function getTokenLiquidityAddedEvents(tokenAddress, limit = 20) {
  const query = gql`
    {
      EVM(dataset: realtime, network: bsc) {
        Events(
          limit: {count: ${limit}}
          where: {
            LogHeader: {Address: {is: "0x5c952063c7fc8610ffdb798152d69f0b9550762b"}}, 
            Log: {Signature: {Name: {is: "LiquidityAdded"}}}, 
            Arguments: {includes: {Name: {is: "token1"}, Value: {Address: {is: "${tokenAddress}"}}}}
          }
        ) {
          Block {
            Time
            Number
            Hash
          }
          Transaction {
            Hash
            From
            To
          }
          Arguments {
            Name
            Value {
              ... on EVM_ABI_Integer_Value_Arg {
                integer
              }
              ... on EVM_ABI_Address_Value_Arg {
                address
              }
              ... on EVM_ABI_BigInt_Value_Arg {
                bigInteger
              }
            }
          }
        }
      }
    }
  `;

  try {
    const data = await request(BITQUERY_ENDPOINT, query, null, bitqueryHeaders);
    return data.EVM.Events;
  } catch (error) {
    console.error(`Error fetching liquidity added events for token ${tokenAddress}:`, error);
    throw error;
  }
}

// Make network configuration mutable for runtime switching
let currentNetwork = process.env.NETWORK || 'testnet';
let isMainnet = currentNetwork === 'mainnet';

// Function to get network configuration based on the current network
const getNetworkConfig = () => {
  return {
    rpc: isMainnet 
      ? (process.env.BSC_MAINNET_RPC || 'https://bsc-rpc.publicnode.com')
      : (process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com'),
    chainId: parseInt(isMainnet 
      ? (process.env.BSC_MAINNET_CHAIN_ID || '56')
      : (process.env.BSC_TESTNET_CHAIN_ID || '97')),
    name: isMainnet 
      ? (process.env.BSC_MAINNET_NETWORK_NAME || 'bsc')
      : (process.env.BSC_TESTNET_NETWORK_NAME || 'bnbt'),
    explorer: isMainnet 
      ? (process.env.BSC_MAINNET_EXPLORER || 'https://bscscan.com')
      : (process.env.BSC_TESTNET_EXPLORER || 'https://testnet.bscscan.com')
  };
};

// Function to get token addresses based on current network
const getTokenAddresses = () => {
  return {
    BUSD: isMainnet 
      ? (process.env.BSC_MAINNET_BUSD_ADDRESS || '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56')
      : (process.env.BSC_TESTNET_BUSD_ADDRESS || '0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee'),
    CAKE: isMainnet 
      ? (process.env.BSC_MAINNET_CAKE_ADDRESS || '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82')
      : (process.env.BSC_TESTNET_CAKE_ADDRESS || '0x8d008B313C1d6C7fE2982F62d32Da7507cF43551')
  };
};

// Initialize with current configuration
let NETWORK_CONFIG = getNetworkConfig();
let TOKEN_ADDRESSES = getTokenAddresses();

// Initialize BSC provider with network configuration - this will be replaced when switching networks
let provider = new ethers.JsonRpcProvider(
  NETWORK_CONFIG.rpc,
  {
    name: NETWORK_CONFIG.name,
    chainId: NETWORK_CONFIG.chainId
  }
);

console.error(`Connected to ${isMainnet ? 'BSC Mainnet' : 'BSC Testnet'}`);
console.error(`Network: ${NETWORK_CONFIG.name}, Chain ID: ${NETWORK_CONFIG.chainId}`);

// Function to switch network and update all configurations
const switchNetwork = async (newNetwork) => {
  if (newNetwork !== 'mainnet' && newNetwork !== 'testnet') {
    throw new Error('Invalid network. Use "mainnet" or "testnet"');
  }
  
  // Only switch if it's a different network
  if (currentNetwork === newNetwork) {
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'info',
          message: `Already on ${newNetwork}`,
          network: currentNetwork
        })
      }]
    };
  }
  
  // Update network state
  currentNetwork = newNetwork;
  isMainnet = currentNetwork === 'mainnet';
  
  // Update configurations
  NETWORK_CONFIG = getNetworkConfig();
  TOKEN_ADDRESSES = getTokenAddresses();
  
  // Create new provider with updated configuration
  provider = new ethers.JsonRpcProvider(
    NETWORK_CONFIG.rpc,
    {
      name: NETWORK_CONFIG.name,
      chainId: NETWORK_CONFIG.chainId
    }
  );
  
  console.error(`Switched to ${isMainnet ? 'BSC Mainnet' : 'BSC Testnet'}`);
  console.error(`Network: ${NETWORK_CONFIG.name}, Chain ID: ${NETWORK_CONFIG.chainId}`);
  
  return {
    content: [{ 
      type: "text", 
      text: JSON.stringify({
        status: 'success',
        message: `Switched to ${newNetwork}`,
        network: currentNetwork,
        networkDetails: {
          name: NETWORK_CONFIG.name,
          chainId: NETWORK_CONFIG.chainId,
          rpc: NETWORK_CONFIG.rpc,
          explorer: NETWORK_CONFIG.explorer
        }
      })
    }]
  };
};

// Define a schema for the network switch tool
const NetworkSwitchSchema = z.object({
  network: z.string().refine(val => val === 'mainnet' || val === 'testnet', {
    message: 'Network must be either "mainnet" or "testnet"'
  })
});

// Helper function to read wallet files
const getWalletDir = () => {
  const walletDir = path.join(__dirname, process.env.WALLET_DIR || 'wallets');
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
    currency: isMainnet ? 'BNB' : 'tBNB',
    network: currentNetwork
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

// Bitquery tool schemas
const NewTokensSchema = z.object({
  limit: z.number().min(1).max(100).optional()
});

const TokenTradesSchema = z.object({
  tokenAddress: z.string(),
  limit: z.number().min(1).max(100).optional()
});

const UserTradesSchema = z.object({
  userAddress: z.string()
});

const TokenTransfersSchema = z.object({
  tokenAddress: z.string(),
  limit: z.number().min(1).max(100).optional()
});

const TopBuyersSchema = z.object({
  tokenAddress: z.string()
});

const LiquidityEventsSchema = z.object({
  limit: z.number().min(1).max(100).optional()
});

const TokenLiquidityEventsSchema = z.object({
  tokenAddress: z.string(),
  limit: z.number().min(1).max(100).optional()
});

// GMGN Schemas
const GMGNTopTradersSchema = z.object({
  tokenAddress: z.string().describe("Token smart contract address"),
  limit: z.number().optional().describe("Maximum number of traders to return (default: 100)"),
  orderBy: z.string().optional().describe("Field to order results by (default: 'profit')"),
  direction: z.string().optional().describe("Sort direction (asc or desc)"),
});

const GMGNMultipleTopTradersSchema = z.object({
  tokenAddresses: z.array(z.string()).describe("Array of token smart contract addresses"),
  limit: z.number().optional().describe("Maximum number of traders to return per token (default: 5)"),
  orderBy: z.string().optional().describe("Field to order results by (default: 'profit')"),
  direction: z.string().optional().describe("Sort direction (asc or desc)"),
});

const GMGNTokenTradesSchema = z.object({
  tokenAddress: z.string().describe("Token smart contract address"),
  fromTimestamp: z.number().optional().describe("Start timestamp"),
  toTimestamp: z.number().optional().describe("End timestamp"),
  limit: z.number().optional().describe("Maximum number of trades to return (default: 100)"),
  maker: z.string().optional().describe("Trader wallet address"),
});

// GMGN Tool Implementations
async function topTradersGMGNTool({ tokenAddress, limit = 100, orderBy = "profit", direction = "desc" }) {
  try {
    const result = await getTopTradersGMGN(tokenAddress, limit, orderBy, direction);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "success",
            network: currentNetwork,
            topTraders: result.traders || [],
            count: result.count || 0,
            tokenAddress
          })
        }
      ]
    };
  } catch (error) {
    console.error("Error in topTradersGMGNTool:", error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: error.message,
            network: currentNetwork
          })
        }
      ]
    };
  }
}

async function multipleTopTradersGMGNTool({ tokenAddresses, limit = 5, orderBy = "profit", direction = "desc" }) {
  try {
    const result = await getMultipleTopTradersGMGN(tokenAddresses, limit, orderBy, direction);
    
    // Transform the results into a more readable format
    const formattedResults = {};
    
    for (const [tokenAddress, data] of Object.entries(result.results)) {
      if (data.status === "success") {
        formattedResults[tokenAddress] = {
          topTraders: data.traders.slice(0, limit),
          count: data.count
        };
      } else {
        formattedResults[tokenAddress] = {
          error: data.message || "Unknown error",
          topTraders: []
        };
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: result.status,
            network: currentNetwork,
            errors: result.errors,
            results: formattedResults
          })
        }
      ]
    };
  } catch (error) {
    console.error("Error in multipleTopTradersGMGNTool:", error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: error.message,
            network: currentNetwork
          })
        }
      ]
    };
  }
}

async function tokenTradesGMGNTool({ tokenAddress, fromTimestamp = 0, toTimestamp = Math.floor(Date.now() / 1000), limit = 100, maker = "" }) {
  try {
    const result = await getTokenTradesGMGN(tokenAddress, fromTimestamp, toTimestamp, limit, maker);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "success",
            network: currentNetwork,
            trades: result.data || [],
            tokenAddress
          })
        }
      ]
    };
  } catch (error) {
    console.error("Error in tokenTradesGMGNTool:", error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: error.message,
            network: currentNetwork
          })
        }
      ]
    };
  }
}

async function topTradersGMGNTronTool({ tokenAddress, limit = 100, orderBy = "profit", direction = "desc" }) {
  try {
    const result = await getTopTradersGMGNTron(tokenAddress, limit, orderBy, direction);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "success",
            network: "tron",
            topTraders: result.traders || [],
            count: result.count || 0,
            tokenAddress
          })
        }
      ]
    };
  } catch (error) {
    console.error("Error in topTradersGMGNTronTool:", error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: error.message,
            network: "tron"
          })
        }
      ]
    };
  }
}

async function multipleTopTradersGMGNTronTool({ tokenAddresses, limit = 5, orderBy = "profit", direction = "desc" }) {
  try {
    const result = await getMultipleTopTradersGMGNTron(tokenAddresses, limit, orderBy, direction);
    
    // Transform the results into a more readable format
    const formattedResults = {};
    
    for (const [tokenAddress, data] of Object.entries(result.results)) {
      if (data.status === "success") {
        formattedResults[tokenAddress] = {
          topTraders: data.traders.slice(0, limit),
          count: data.count
        };
      } else {
        formattedResults[tokenAddress] = {
          error: data.message || "Unknown error",
          topTraders: []
        };
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: result.status,
            network: "tron",
            errors: result.errors,
            results: formattedResults
          })
        }
      ]
    };
  } catch (error) {
    console.error("Error in multipleTopTradersGMGNTronTool:", error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: error.message,
            network: "tron"
          })
        }
      ]
    };
  }
}

async function tokenTradesGMGNTronTool({ tokenAddress, fromTimestamp = 0, toTimestamp = Math.floor(Date.now() / 1000), limit = 100, maker = "" }) {
  try {
    const result = await getTokenTradesGMGNTron(tokenAddress, fromTimestamp, toTimestamp, limit, maker);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "success",
            network: "tron",
            trades: result.data || [],
            tokenAddress
          })
        }
      ]
    };
  } catch (error) {
    console.error("Error in tokenTradesGMGNTronTool:", error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: error.message,
            network: "tron"
          })
        }
      ]
    };
  }
}

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
      createdAt: new Date().toISOString(),
      network: currentNetwork
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
            name: walletName,
            network: currentNetwork
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
      createdAt: new Date().toISOString(),
      network: currentNetwork
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
            name: walletName,
            network: currentNetwork
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
          totalWallets: wallets.length,
          network: currentNetwork
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
          wallet: details,
          network: currentNetwork
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
            blockNumber: tx.blockNumber,
            network: currentNetwork,
            explorer: tx.hash ? `${NETWORK_CONFIG.explorer}/tx/${tx.hash}` : null
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
    // Create a registry of known tokens with correct addresses from environment variables
    const knownTokens = [
      { symbol: 'BUSD', name: 'Binance USD', address: TOKEN_ADDRESSES.BUSD },
      { symbol: 'CAKE', name: 'PancakeSwap Token', address: TOKEN_ADDRESSES.CAKE }
    ];
    
    // Add token balance information to each token
    const tokensWithBalances = await Promise.all(
      knownTokens.map(async token => {
        try {
          // Create token contract instance
          const abi = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)"
          ];
          const tokenContract = new ethers.Contract(token.address, abi, provider);
          
          // Get token balance
          const balance = await tokenContract.balanceOf(args.address);
          const decimals = await tokenContract.decimals();
          
          // Format balance
          const formattedBalance = ethers.formatUnits(balance, decimals);
          
          return {
            ...token,
            balance: formattedBalance,
            balanceRaw: balance.toString(),
            hasBalance: balance > 0
          };
        } catch (error) {
          console.error(`Error getting balance for token ${token.symbol}:`, error);
          return {
            ...token,
            balance: '0',
            balanceRaw: '0',
            hasBalance: false,
            error: error.message
          };
        }
      })
    );
    
    // Filter tokens to include only those with non-zero balances and known tokens
    const tokensToDisplay = tokensWithBalances.filter(token => 
      token.hasBalance || knownTokens.some(kt => kt.address === token.address)
    );
    
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          tokens: tokensToDisplay,
          wallet: args.address,
          network: currentNetwork
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
          wallet: args.address,
          network: currentNetwork
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
            amount: args.amount,
            network: currentNetwork,
            explorer: tx.hash ? `${NETWORK_CONFIG.explorer}/tx/${tx.hash}` : null
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
            amount: args.amount,
            network: currentNetwork,
            explorer: tx.hash ? `${NETWORK_CONFIG.explorer}/tx/${tx.hash}` : null
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

// Network switching tool implementation
const networkSwitchTool = async (args) => {
  try {
    return await switchNetwork(args.network);
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

// Bitquery tools implementations
const newTokensTool = async (args) => {
  try {
    const tokens = await getNewlyCreatedTokensOnFourMeme(args.limit || 10);
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          tokens: tokens,
          count: tokens.length,
          network: currentNetwork
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

const tokenTradesTool = async (args) => {
  try {
    const trades = await getLatestTradesOfToken(args.tokenAddress, args.limit || 10);
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          trades: trades,
          count: trades.length,
          tokenAddress: args.tokenAddress,
          network: currentNetwork
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

const userTradesTool = async (args) => {
  try {
    const trades = await getTradesByUser(args.userAddress);
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          buys: trades.buys,
          buyCount: trades.buys.length,
          sells: trades.sells,
          sellCount: trades.sells.length,
          userAddress: args.userAddress,
          network: currentNetwork
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

const tokenTransfersTool = async (args) => {
  try {
    const transfers = await getLatestTokenTransfers(args.tokenAddress, args.limit || 10);
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          transfers: transfers,
          count: transfers.length,
          tokenAddress: args.tokenAddress,
          network: currentNetwork
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

const topBuyersTool = async (args) => {
  try {
    const buyers = await getTopBuyersForToken(args.tokenAddress);
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          buyers: buyers,
          count: buyers.length,
          tokenAddress: args.tokenAddress,
          network: currentNetwork
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

const liquidityEventsTool = async (args) => {
  try {
    const events = await getLiquidityAddedEvents(args.limit || 20);
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          events: events,
          count: events.length,
          network: currentNetwork
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

const tokenLiquidityEventsTool = async (args) => {
  try {
    const events = await getTokenLiquidityAddedEvents(args.tokenAddress, args.limit || 20);
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: 'success',
          events: events,
          count: events.length,
          tokenAddress: args.tokenAddress,
          network: currentNetwork
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

// Export key functions that can be imported by other scripts
export { 
  getWalletDetails as getWalletBalance, 
  walletCreateTool as createWallet, 
  listWallets, 
  walletSendTool as sendTransaction,
  tokenBalanceTool as getTokenBalance,
  tokenTransferTool as transferToken,
  tokenApproveTool as approveToken,
  switchNetwork,
  newTokensTool,
  tokenTradesTool,
  userTradesTool,
  tokenTransfersTool,
  topBuyersTool,
  liquidityEventsTool,
  tokenLiquidityEventsTool
};

// 1. Create an MCP server instance
const server = new Server(
  {
    name: `BSC Wallet Provider (${isMainnet ? 'Mainnet' : 'Testnet'})`,
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
        description: `Get the balance of a wallet (${isMainnet ? 'BNB' : 'tBNB'})`,
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
        description: `Send ${isMainnet ? 'BNB' : 'tBNB'} from a wallet to another address`,
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
              description: `Amount of ${isMainnet ? 'BNB' : 'tBNB'} to send`
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
      },
      {
        name: "network.switch",
        description: "Switch between mainnet and testnet networks",
        inputSchema: {
          type: "object",
          properties: {
            network: {
              type: "string",
              description: "Network to switch to (mainnet or testnet)"
            }
          },
          required: ["network"]
        }
      },
      {
        name: "newTokens",
        description: "Get newly created tokens on Four Meme Exchange",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of tokens to return (default: 10)"
            }
          },
          required: []
        }
      },
      {
        name: "tokenTrades",
        description: "Get latest trades of a specific token on Four Meme Exchange",
        inputSchema: {
          type: "object",
          properties: {
            tokenAddress: {
              type: "string",
              description: "Token smart contract address"
            },
            limit: {
              type: "number",
              description: "Maximum number of trades to return (default: 10)"
            }
          },
          required: ["tokenAddress"]
        }
      },
      {
        name: "userTrades",
        description: "Track trades (buys and sells) by a specific user on Four Meme Exchange",
        inputSchema: {
          type: "object",
          properties: {
            userAddress: {
              type: "string",
              description: "User wallet address"
            }
          },
          required: ["userAddress"]
        }
      },
      {
        name: "tokenTransfers",
        description: "Get latest transfers of a specific token on Four Meme Exchange",
        inputSchema: {
          type: "object",
          properties: {
            tokenAddress: {
              type: "string",
              description: "Token smart contract address"
            },
            limit: {
              type: "number",
              description: "Maximum number of transfers to return (default: 10)"
            }
          },
          required: ["tokenAddress"]
        }
      },
      {
        name: "topBuyers",
        description: "Get top buyers for a specific token on Four Meme Exchange",
        inputSchema: {
          type: "object",
          properties: {
            tokenAddress: {
              type: "string",
              description: "Token smart contract address"
            }
          },
          required: ["tokenAddress"]
        }
      },
      {
        name: "liquidityEvents",
        description: "Track liquidity add events for all tokens on Four Meme Exchange",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of events to return (default: 20)"
            }
          },
          required: []
        }
      },
      {
        name: "tokenLiquidityEvents",
        description: "Track liquidity add events for a specific token on Four Meme Exchange",
        inputSchema: {
          type: "object",
          properties: {
            tokenAddress: {
              type: "string",
              description: "Token smart contract address"
            },
            limit: {
              type: "number",
              description: "Maximum number of events to return (default: 20)"
            }
          },
          required: ["tokenAddress"]
        }
      },
      {
        name: "topTradersGMGN",
        description: "Get top traders for a specific token from GMGN",
        inputSchema: {
          type: "object",
          properties: {
            tokenAddress: {
              type: "string",
              description: "Token smart contract address"
            },
            limit: {
              type: "number",
              description: "Maximum number of traders to return (default: 100)"
            },
            orderBy: {
              type: "string",
              description: "Field to order results by (default: 'profit'"
            },
            direction: {
              type: "string",
              description: "Sort direction (asc or desc)"
            }
          },
          required: ["tokenAddress"]
        }
      },
      {
        name: "multipleTopTradersGMGN",
        description: "Get top traders for multiple tokens in a single call",
        inputSchema: {
          type: "object",
          properties: {
            tokenAddresses: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of token smart contract addresses"
            },
            limit: {
              type: "number",
              description: "Maximum number of traders to return per token (default: 5)"
            },
            orderBy: {
              type: "string",
              description: "Field to order results by (default: 'profit'"
            },
            direction: {
              type: "string",
              description: "Sort direction (asc or desc)"
            }
          },
          required: ["tokenAddresses"]
        }
      },
      {
        name: "tokenTradesGMGN",
        description: "Get token trades from GMGN",
        inputSchema: {
          type: "object",
          properties: {
            tokenAddress: {
              type: "string",
              description: "Token smart contract address"
            },
            fromTimestamp: {
              type: "number",
              description: "Start timestamp"
            },
            toTimestamp: {
              type: "number",
              description: "End timestamp"
            },
            limit: {
              type: "number",
              description: "Maximum number of trades to return (default: 100)"
            },
            maker: {
              type: "string",
              description: "Trader wallet address"
            }
          },
          required: ["tokenAddress"]
        }
      },
      {
        name: "topTradersGMGNTron",
        description: "Get top traders for a specific token from GMGN Tron",
        inputSchema: {
          type: "object",
          properties: {
            tokenAddress: {
              type: "string",
              description: "Token smart contract address"
            },
            limit: {
              type: "number",
              description: "Maximum number of traders to return (default: 100)"
            },
            orderBy: {
              type: "string",
              description: "Field to order results by (default: 'profit'"
            },
            direction: {
              type: "string",
              description: "Sort direction (asc or desc)"
            }
          },
          required: ["tokenAddress"]
        }
      },
      {
        name: "multipleTopTradersGMGNTron",
        description: "Get top traders for multiple tokens in a single call from GMGN Tron",
        inputSchema: {
          type: "object",
          properties: {
            tokenAddresses: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Array of token smart contract addresses"
            },
            limit: {
              type: "number",
              description: "Maximum number of traders to return per token (default: 5)"
            },
            orderBy: {
              type: "string",
              description: "Field to order results by (default: 'profit'"
            },
            direction: {
              type: "string",
              description: "Sort direction (asc or desc)"
            }
          },
          required: ["tokenAddresses"]
        }
      },
      {
        name: "tokenTradesGMGNTron",
        description: "Get token trades from GMGN Tron",
        inputSchema: {
          type: "object",
          properties: {
            tokenAddress: {
              type: "string",
              description: "Token smart contract address"
            },
            fromTimestamp: {
              type: "number",
              description: "Start timestamp"
            },
            toTimestamp: {
              type: "number",
              description: "End timestamp"
            },
            limit: {
              type: "number",
              description: "Maximum number of trades to return (default: 100)"
            },
            maker: {
              type: "string",
              description: "Trader wallet address"
            }
          },
          required: ["tokenAddress"]
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
    case "network.switch": {
      const validated = NetworkSwitchSchema.parse(args);
      return await networkSwitchTool(validated);
    }
    case "newTokens": {
      const validated = NewTokensSchema.parse(args);
      return await newTokensTool(validated);
    }
    case "tokenTrades": {
      const validated = TokenTradesSchema.parse(args);
      return await tokenTradesTool(validated);
    }
    case "userTrades": {
      const validated = UserTradesSchema.parse(args);
      return await userTradesTool(validated);
    }
    case "tokenTransfers": {
      const validated = TokenTransfersSchema.parse(args);
      return await tokenTransfersTool(validated);
    }
    case "topBuyers": {
      const validated = TopBuyersSchema.parse(args);
      return await topBuyersTool(validated);
    }
    case "liquidityEvents": {
      const validated = LiquidityEventsSchema.parse(args);
      return await liquidityEventsTool(validated);
    }
    case "tokenLiquidityEvents": {
      const validated = TokenLiquidityEventsSchema.parse(args);
      return await tokenLiquidityEventsTool(validated);
    }
    case "topTradersGMGN": {
      const validated = GMGNTopTradersSchema.parse(args);
      return await topTradersGMGNTool(validated);
    }
    case "multipleTopTradersGMGN": {
      const validated = GMGNMultipleTopTradersSchema.parse(args);
      return await multipleTopTradersGMGNTool(validated);
    }
    case "tokenTradesGMGN": {
      const validated = GMGNTokenTradesSchema.parse(args);
      return await tokenTradesGMGNTool(validated);
    }
    case "topTradersGMGNTron": {
      const validated = GMGNTopTradersSchema.parse(args);
      return await topTradersGMGNTronTool(validated);
    }
    case "multipleTopTradersGMGNTron": {
      const validated = GMGNMultipleTopTradersSchema.parse(args);
      return await multipleTopTradersGMGNTronTool(validated);
    }
    case "tokenTradesGMGNTron": {
      const validated = GMGNTokenTradesSchema.parse(args);
      return await tokenTradesGMGNTronTool(validated);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// 4. Start the MCP server with a stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`BSC Wallet Provider MCP Server running on stdio (${currentNetwork} mode)`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
}); 