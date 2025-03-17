import { ethers } from 'ethers';
import { TokenService } from './token.service';

// This is a sample list of test tokens on BSC Testnet
// In production, this should be fetched from a token list API or database
const BSC_TESTNET_TOKENS = [
  {
    address: ethers.getAddress('0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd'),
    name: 'Wrapped BNB',
    symbol: 'WBNB',
    decimals: 18
  }
];

export interface TokenBalance {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceInWei: string;
}

export class TokenListService {
  private static provider: ethers.Provider;

  static initialize(provider: ethers.Provider) {
    this.provider = provider;
  }

  static async getKnownTokens(): Promise<string[]> {
    return BSC_TESTNET_TOKENS.map(token => token.address);
  }

  static async getAllTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
    try {
      const tokenAddresses = await this.getKnownTokens();
      const balances: TokenBalance[] = [];

      // Fetch all token balances in parallel
      const balancePromises = tokenAddresses.map(async (tokenAddress) => {
        try {
          const tokenInfo = await TokenService.getTokenInfo(tokenAddress, walletAddress);
          
          // Include all tokens, even with zero balance, for the list
          balances.push({
            address: tokenAddress,
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
            decimals: tokenInfo.decimals,
            balance: tokenInfo.balance,
            balanceInWei: tokenInfo.balanceInWei // TokenService already returns this as string
          });
        } catch (error) {
          console.error(`Error fetching token info for ${tokenAddress}:`, error);
        }
      });

      await Promise.all(balancePromises);
      return balances;
    } catch (error) {
      console.error('Error fetching token balances:', error);
      return [];
    }
  }

  // This method is now simplified to avoid RPC node limitations
  static async searchTokenTransfers(walletAddress: string): Promise<string[]> {
    // Simply return known token addresses since we can't search transfer history
    // with the public RPC node limitations
    return this.getKnownTokens();
  }
} 