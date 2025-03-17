import { Router, RequestHandler } from 'express';
import { TokenService } from '../services/token.service';
import { TokenListService, TokenBalance } from '../services/token-list.service';
import { WalletService } from '../services/wallet.service';
import { ethers } from 'ethers';

interface TokenTransferBody {
  tokenAddress: string;
  to: string;
  amount: string;
}

interface TokenApprovalBody {
  tokenAddress: string;
  spender: string;
  amount: string;
}

const router = Router();

// Initialize BSC testnet provider
const provider = new ethers.JsonRpcProvider(
  process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com',
  {
    name: 'bnbt',
    chainId: 97
  }
);

// Initialize services with provider
TokenService.initialize(provider);
TokenListService.initialize(provider);

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

// List all tokens for a wallet
const listWalletTokens: RequestHandler = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    console.log('Fetching all tokens for wallet:', walletAddress);

    // Get native token (BNB) balance
    const bnbBalance = await provider.getBalance(walletAddress);
    
    // Get all token balances
    const tokenBalances = await TokenListService.getAllTokenBalances(walletAddress);

    // Create tokenAddresses mapping from known tokens
    const tokenAddresses: Record<string, { address: string; name: string }> = {};
    tokenBalances.forEach(token => {
      tokenAddresses[token.symbol] = {
        address: token.address,
        name: token.name
      };
    });

    // Try to search for additional tokens, but don't fail if it doesn't work
    try {
      const transferredTokens = await TokenListService.searchTokenTransfers(walletAddress);
      
      // Get balances for any additional tokens found
      const additionalTokenPromises = transferredTokens
        .filter(addr => !tokenBalances.some(t => t.address.toLowerCase() === addr.toLowerCase()))
        .map(async (tokenAddress) => {
          try {
            const tokenInfo = await TokenService.getTokenInfo(tokenAddress, walletAddress);
            if (tokenInfo.balanceInWei !== '0') {
              return {
                address: tokenAddress,
                name: tokenInfo.name,
                symbol: tokenInfo.symbol,
                decimals: tokenInfo.decimals,
                balance: tokenInfo.balance,
                balanceInWei: tokenInfo.balanceInWei
              };
            }
          } catch (error) {
            console.error(`Error fetching additional token info for ${tokenAddress}:`, error);
            return null;
          }
        });

      const additionalTokens = (await Promise.all(additionalTokenPromises))
        .filter((token): token is TokenBalance => token !== null);

      // Add additional tokens to both arrays
      tokenBalances.push(...additionalTokens);
      additionalTokens.forEach(token => {
        tokenAddresses[token.symbol] = {
          address: token.address,
          name: token.name
        };
      });
    } catch (error: any) {
      console.warn('Could not search transfer history due to RPC node limitations:', error.message);
    }

    // Prepare response data and ensure all BigInt values are serialized
    const responseData = {
      nativeToken: {
        symbol: 'BNB',
        balance: ethers.formatEther(bnbBalance),
        balanceInWei: bnbBalance.toString()
      },
      tokens: tokenBalances,
      tokenAddresses,
      totalTokens: tokenBalances.length
    };

    // Serialize all BigInt values before JSON response
    res.json({
      status: 'success',
      data: serializeBigInt(responseData)
    });
  } catch (error) {
    next(error);
  }
};

// Get token balance and info
const getTokenInfo: RequestHandler = async (req, res, next) => {
  try {
    const { walletAddress, tokenAddress } = req.params;

    const tokenInfo = await TokenService.getTokenInfo(tokenAddress, walletAddress);

    res.json({
      status: 'success',
      data: serializeBigInt(tokenInfo)
    });
  } catch (error) {
    next(error);
  }
};

// Transfer tokens
const transferToken: RequestHandler = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const { tokenAddress, to, amount } = req.body as TokenTransferBody;

    // Get wallet instance
    const wallet = await WalletService.getWalletInstance(walletAddress);
    if (!wallet) {
      res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
      return;
    }

    // Send token transfer
    const tx = await TokenService.transferToken(tokenAddress, wallet, to, amount);
    console.log('Token transfer transaction sent:', tx.hash);

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    // Get updated token balance
    const tokenInfo = await TokenService.getTokenInfo(tokenAddress, walletAddress);

    res.json({
      status: 'success',
      data: serializeBigInt({
        transactionHash: tx.hash,
        blockNumber: receipt?.blockNumber,
        from: walletAddress,
        to,
        amount,
        tokenAddress,
        newBalance: tokenInfo.balance,
        gasUsed: receipt?.gasUsed
      })
    });
  } catch (error) {
    next(error);
  }
};

// Check token allowance
const checkAllowance: RequestHandler = async (req, res, next) => {
  try {
    const { walletAddress, tokenAddress, spender } = req.params;

    const allowance = await TokenService.checkAllowance(
      tokenAddress,
      walletAddress,
      spender
    );

    res.json({
      status: 'success',
      data: serializeBigInt({
        tokenAddress,
        owner: walletAddress,
        spender,
        allowance
      })
    });
  } catch (error) {
    next(error);
  }
};

// Approve token spending
const approveToken: RequestHandler = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const { tokenAddress, spender, amount } = req.body as TokenApprovalBody;

    // Get wallet instance
    const wallet = await WalletService.getWalletInstance(walletAddress);
    if (!wallet) {
      res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
      return;
    }

    // Send approval transaction
    const tx = await TokenService.approveSpender(tokenAddress, wallet, spender, amount);
    console.log('Token approval transaction sent:', tx.hash);

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    // Get updated allowance
    const newAllowance = await TokenService.checkAllowance(
      tokenAddress,
      walletAddress,
      spender
    );

    res.json({
      status: 'success',
      data: serializeBigInt({
        transactionHash: tx.hash,
        blockNumber: receipt?.blockNumber,
        tokenAddress,
        owner: walletAddress,
        spender,
        approvedAmount: amount,
        newAllowance,
        gasUsed: receipt?.gasUsed
      })
    });
  } catch (error) {
    next(error);
  }
};

// Routes
router.get('/list/:walletAddress', listWalletTokens);
router.get('/:walletAddress/:tokenAddress', getTokenInfo);
router.post('/:walletAddress/transfer', transferToken);
router.get('/:walletAddress/:tokenAddress/:spender/allowance', checkAllowance);
router.post('/:walletAddress/approve', approveToken);

export default router; 