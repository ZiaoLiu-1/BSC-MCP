import { ethers } from 'ethers';

// Standard ERC20 ABI for the functions we need
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceInWei: string;
  tokenAddress: string;
}

export class TokenService {
  private static provider: ethers.Provider;

  static initialize(provider: ethers.Provider) {
    this.provider = provider;
  }

  static async getTokenInfo(tokenAddress: string, walletAddress: string): Promise<TokenInfo> {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

      // Fetch token details in parallel
      const [name, symbol, decimals, balance] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.balanceOf(walletAddress)
      ]);

      return {
        name,
        symbol,
        decimals,
        balance: ethers.formatUnits(balance, decimals),
        balanceInWei: balance.toString(),
        tokenAddress
      };
    } catch (error) {
      console.error('Error getting token info:', error);
      throw new Error(`Failed to get token info: ${(error as Error).message}`);
    }
  }

  static async transferToken(
    tokenAddress: string,
    fromWallet: ethers.Wallet,
    toAddress: string,
    amount: string
  ): Promise<ethers.TransactionResponse> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        fromWallet.connect(this.provider)
      );

      // Get token decimals
      const decimals = await tokenContract.decimals();
      
      // Convert amount to token units
      const tokenAmount = ethers.parseUnits(amount, decimals);

      // Send transfer transaction
      const tx = await tokenContract.transfer(toAddress, tokenAmount);
      
      return tx;
    } catch (error) {
      console.error('Error transferring token:', error);
      throw new Error(`Failed to transfer token: ${(error as Error).message}`);
    }
  }

  static async checkAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<string> {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const decimals = await tokenContract.decimals();
      const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
      
      return ethers.formatUnits(allowance, decimals);
    } catch (error) {
      console.error('Error checking allowance:', error);
      throw new Error(`Failed to check allowance: ${(error as Error).message}`);
    }
  }

  static async approveSpender(
    tokenAddress: string,
    wallet: ethers.Wallet,
    spenderAddress: string,
    amount: string
  ): Promise<ethers.TransactionResponse> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ERC20_ABI,
        wallet.connect(this.provider)
      );

      const decimals = await tokenContract.decimals();
      const tokenAmount = ethers.parseUnits(amount, decimals);

      const tx = await tokenContract.approve(spenderAddress, tokenAmount);
      return tx;
    } catch (error) {
      console.error('Error approving spender:', error);
      throw new Error(`Failed to approve spender: ${(error as Error).message}`);
    }
  }
} 