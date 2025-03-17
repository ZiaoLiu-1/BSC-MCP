import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import walletRoutes from './routes/wallet.routes';
import tokenRoutes from './routes/token.routes';
import { errorHandler } from './middleware/error.handler';

// Load environment variables
dotenv.config();

// Helper function to serialize BigInt values
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = serializeBigInt(obj[key]);
    }
    return result;
  }
  
  return obj;
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Initialize BSC provider with network configuration
const provider = new ethers.JsonRpcProvider(
  process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com',
  {
    name: 'bnbt',
    chainId: 97
  }
);

// Mount routes
app.use('/api/wallet', walletRoutes);
app.use('/api/tokens', tokenRoutes);

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', network: 'bsc-testnet' });
});

// Get network information
app.get('/network', async (req, res, next) => {
  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const gasPrice = await provider.getFeeData();

    res.json(serializeBigInt({
      chainId: network.chainId,
      name: network.name,
      blockNumber,
      gasPrice: {
        maxFeePerGas: gasPrice.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
        gasPrice: gasPrice.gasPrice
      }
    }));
  } catch (error) {
    next(error);
  }
});

// Get account balance
app.get('/balance/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    const balance = await provider.getBalance(address);
    
    res.json(serializeBigInt({
      address,
      balance: ethers.formatEther(balance),
      balanceInWei: balance,
      currency: 'tBNB'
    }));
  } catch (error) {
    next(error);
  }
});

// MCP Protocol endpoints
app.post('/mcp/v1/provider', (req, res) => {
  // Return information about the provider capabilities
  res.json({
    provider: {
      name: 'BSC Wallet Provider',
      version: '1.0.0',
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
  });
});

// MCP execution endpoint
app.post('/mcp/v1/execute', async (req, res, next) => {
  try {
    const { action, params } = req.body;
    
    // Route the action to the appropriate handler
    switch (action) {
      // Wallet actions
      case 'wallet.create':
        // Forward to our wallet creation endpoint
        req.url = '/api/wallet/create';
        req.method = 'POST';
        return app._router.handle(req, res, next);
        
      case 'wallet.import':
        req.url = '/api/wallet/import';
        req.method = 'POST';
        return app._router.handle(req, res, next);
        
      case 'wallet.list':
        req.url = '/api/wallet/list';
        req.method = 'GET';
        return app._router.handle(req, res, next);
        
      case 'wallet.balance':
        if (!params.address) {
          return res.status(400).json({ 
            status: 'error', 
            message: 'Wallet address is required' 
          });
        }
        req.url = `/api/wallet/${params.address}`;
        req.method = 'GET';
        return app._router.handle(req, res, next);
        
      case 'wallet.send':
        if (!params.address || !params.to || !params.amount) {
          return res.status(400).json({ 
            status: 'error', 
            message: 'Missing required parameters: address, to, amount' 
          });
        }
        req.url = `/api/wallet/${params.address}/send`;
        req.method = 'POST';
        req.body = { to: params.to, amount: params.amount };
        return app._router.handle(req, res, next);
        
      // Token actions  
      case 'token.list':
        if (!params.address) {
          return res.status(400).json({ 
            status: 'error', 
            message: 'Wallet address is required' 
          });
        }
        req.url = `/api/tokens/list/${params.address}`;
        req.method = 'GET';
        return app._router.handle(req, res, next);
        
      case 'token.balance':
        if (!params.address || !params.tokenAddress) {
          return res.status(400).json({ 
            status: 'error', 
            message: 'Wallet address and token address are required' 
          });
        }
        req.url = `/api/tokens/${params.address}/${params.tokenAddress}`;
        req.method = 'GET';
        return app._router.handle(req, res, next);
        
      case 'token.transfer':
        if (!params.address || !params.tokenAddress || !params.to || !params.amount) {
          return res.status(400).json({ 
            status: 'error', 
            message: 'Missing required parameters: address, tokenAddress, to, amount' 
          });
        }
        req.url = `/api/tokens/${params.address}/transfer`;
        req.method = 'POST';
        req.body = { 
          tokenAddress: params.tokenAddress, 
          to: params.to, 
          amount: params.amount 
        };
        return app._router.handle(req, res, next);
        
      case 'token.approve':
        if (!params.address || !params.tokenAddress || !params.spender || !params.amount) {
          return res.status(400).json({ 
            status: 'error', 
            message: 'Missing required parameters: address, tokenAddress, spender, amount' 
          });
        }
        req.url = `/api/tokens/${params.address}/approve`;
        req.method = 'POST';
        req.body = { 
          tokenAddress: params.tokenAddress, 
          spender: params.spender, 
          amount: params.amount 
        };
        return app._router.handle(req, res, next);
        
      default:
        return res.status(400).json({ 
          status: 'error', 
          message: `Unsupported action: ${action}` 
        });
    }
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Connected to BSC Testnet at ${process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com'}`);
}); 