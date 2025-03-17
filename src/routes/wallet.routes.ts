import { Router, Request, Response, RequestHandler } from 'express';
import { WalletService } from '../services/wallet.service';
import { ethers } from 'ethers';

interface AddressParams {
  address: string;
}

interface SendTransactionBody {
  to: string;
  amount: string; // in BNB
  data?: string;
}

interface WalletDetails {
  address: string;
  balance: string;
  transactionCount: number;
  isContract: boolean;
}

const router = Router();

// Initialize BSC testnet provider with network configuration
const provider = new ethers.JsonRpcProvider(
  process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com',
  {
    name: 'bnbt',
    chainId: 97
  }
);

// Get all wallets with details
const getWallets: RequestHandler = async (_req, res, next) => {
  try {
    console.log('Fetching all wallets with details...');
    const walletAddresses = await WalletService.listWallets();
    const walletDetails: WalletDetails[] = [];

    // Fetch details for each wallet in parallel
    const detailPromises = walletAddresses.map(async (address) => {
      try {
        const [balance, code, transactionCount] = await Promise.all([
          provider.getBalance(address),
          provider.getCode(address),
          provider.getTransactionCount(address)
        ]);

        return {
          address,
          balance: ethers.formatEther(balance),
          transactionCount,
          isContract: code !== '0x'
        };
      } catch (error) {
        console.error(`Error fetching details for wallet ${address}:`, error);
        return {
          address,
          balance: '0',
          transactionCount: 0,
          isContract: false,
          error: (error as Error).message
        };
      }
    });

    const details = await Promise.all(detailPromises);

    res.json({
      status: 'success',
      data: {
        totalWallets: walletAddresses.length,
        wallets: details.map(detail => ({
          ...detail,
          balanceInBNB: detail.balance,
          balanceInWei: ethers.parseEther(detail.balance).toString()
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create new wallet
const createWallet: RequestHandler = async (_req, res, next) => {
  try {
    console.log('Received request to create new wallet');
    const walletInfo = await WalletService.createWallet();
    console.log('Successfully created wallet:', walletInfo.address);
    
    // Get initial balance and transaction count
    const [balance, transactionCount] = await Promise.all([
      provider.getBalance(walletInfo.address),
      provider.getTransactionCount(walletInfo.address)
    ]);

    res.json({
      status: 'success',
      data: {
        address: walletInfo.address,
        publicKey: walletInfo.publicKey,
        balance: ethers.formatEther(balance),
        transactionCount,
        currency: 'tBNB'
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get wallet details with balance
const getWalletDetails: RequestHandler<AddressParams> = async (req, res, next) => {
  try {
    const { address } = req.params;
    console.log('Received request to get wallet details for:', address);
    const walletInfo = await WalletService.getWallet(address);
    
    if (!walletInfo) {
      console.log('Wallet not found:', address);
      res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
      return;
    }

    // Get wallet details from blockchain
    const [balance, code, transactionCount] = await Promise.all([
      provider.getBalance(address),
      provider.getCode(address),
      provider.getTransactionCount(address)
    ]);

    console.log('Found wallet details for:', address);
    res.json({
      status: 'success',
      data: {
        address: walletInfo.address,
        publicKey: walletInfo.publicKey,
        balance: ethers.formatEther(balance),
        balanceInWei: balance.toString(),
        transactionCount,
        isContract: code !== '0x',
        currency: 'tBNB'
      }
    });
  } catch (error) {
    next(error);
  }
};

// Send transaction
const sendTransaction: RequestHandler<AddressParams, any, SendTransactionBody> = async (req, res, next) => {
  try {
    const { address } = req.params;
    const { to, amount, data } = req.body;

    // Get wallet instance
    const wallet = await WalletService.getWalletInstance(address);
    if (!wallet) {
      res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
      return;
    }

    // Connect wallet to provider
    const connectedWallet = wallet.connect(provider);

    // Create transaction
    const tx = await connectedWallet.sendTransaction({
      to,
      value: ethers.parseEther(amount),
      data: data || '0x',
    });

    console.log('Transaction sent:', tx.hash);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    res.json({
      status: 'success',
      data: {
        transactionHash: tx.hash,
        blockNumber: receipt?.blockNumber,
        from: address,
        to,
        amount,
        gasUsed: receipt?.gasUsed.toString()
      }
    });
  } catch (error) {
    next(error);
  }
};

router.get('/list', getWallets);
router.post('/create', createWallet);
router.get('/:address', getWalletDetails);
router.post('/:address/send', sendTransaction);

export default router; 