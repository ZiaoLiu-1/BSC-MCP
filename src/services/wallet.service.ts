import { ethers } from 'ethers';
import { encrypt, decrypt } from '../utils/encryption';
import fs from 'fs';
import path from 'path';

const WALLETS_DIR = path.join(process.cwd(), 'wallets');

// Ensure wallets directory exists
if (!fs.existsSync(WALLETS_DIR)) {
  try {
    fs.mkdirSync(WALLETS_DIR, { recursive: true });
    console.log(`Created wallets directory at ${WALLETS_DIR}`);
  } catch (error) {
    console.error('Failed to create wallets directory:', error);
  }
}

export interface WalletInfo {
  address: string;
  publicKey: string;
  encryptedPrivateKey: string;
}

export class WalletService {
  private static wallets: Map<string, WalletInfo> = new Map();

  static async createWallet(): Promise<WalletInfo> {
    try {
      console.log('Creating new wallet...');
      // Create a new random wallet
      const wallet = ethers.Wallet.createRandom();
      console.log('Wallet created with address:', wallet.address);
      
      const walletInfo: WalletInfo = {
        address: wallet.address,
        publicKey: wallet.publicKey,
        encryptedPrivateKey: encrypt(wallet.privateKey)
      };

      // Save wallet info
      this.wallets.set(wallet.address, walletInfo);
      
      // Save to file system
      const walletPath = path.join(WALLETS_DIR, `${wallet.address}.json`);
      fs.writeFileSync(walletPath, JSON.stringify(walletInfo, null, 2));
      console.log('Wallet saved to:', walletPath);

      return walletInfo;
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw new Error('Failed to create wallet: ' + (error as Error).message);
    }
  }

  static async getWallet(address: string): Promise<WalletInfo | null> {
    try {
      // Try to get from memory
      if (this.wallets.has(address)) {
        return this.wallets.get(address)!;
      }

      // Try to get from file system
      const walletPath = path.join(WALLETS_DIR, `${address}.json`);
      if (fs.existsSync(walletPath)) {
        const walletInfo = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        this.wallets.set(address, walletInfo);
        return walletInfo;
      }

      return null;
    } catch (error) {
      console.error('Error getting wallet:', error);
      throw new Error('Failed to get wallet: ' + (error as Error).message);
    }
  }

  static async getWalletInstance(address: string): Promise<ethers.Wallet | null> {
    try {
      const walletInfo = await this.getWallet(address);
      if (!walletInfo) return null;

      const privateKey = decrypt(walletInfo.encryptedPrivateKey);
      return new ethers.Wallet(privateKey);
    } catch (error) {
      console.error('Error getting wallet instance:', error);
      throw new Error('Failed to get wallet instance: ' + (error as Error).message);
    }
  }

  static async listWallets(): Promise<string[]> {
    try {
      if (!fs.existsSync(WALLETS_DIR)) {
        console.log('Wallets directory does not exist, creating...');
        fs.mkdirSync(WALLETS_DIR, { recursive: true });
        return [];
      }
      
      const files = fs.readdirSync(WALLETS_DIR);
      return files.map(file => file.replace('.json', ''));
    } catch (error) {
      console.error('Error listing wallets:', error);
      throw new Error('Failed to list wallets: ' + (error as Error).message);
    }
  }
} 