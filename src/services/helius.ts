import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface HeliusTokenSupplyResponse {
  jsonrpc: string;
  result: {
    context: {
      apiVersion: string;
      slot: number;
    };
    value: {
      amount: string;
      decimals: number;
      uiAmount: number;
      uiAmountString: string;
    };
  };
  id: number;
}

interface TokenAccountResponse {
  jsonrpc: string;
  result: {
    total: number;
    limit: number;
    token_accounts: Array<{
      address: string;
      mint: string;
      owner: string;
      amount: string;
      delegated_amount: number;
      frozen: boolean;
    }>;
    cursor?: string;
  };
}

export class HeliusAPI {
  private readonly API_KEY: string;
  private readonly RPC_URL: string;

  constructor() {
    if (!process.env.HELIUS_API_KEY) {
      throw new Error('HELIUS_API_KEY environment variable is not set');
    }
    this.API_KEY = process.env.HELIUS_API_KEY;
    this.RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${this.API_KEY}`;
  }

  async getTokenSupply(mintAddress: string): Promise<number> {
    try {
      const response = await axios.post(this.RPC_URL, {
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenSupply",
        params: [mintAddress]
      });

      const data = response.data as HeliusTokenSupplyResponse;
      if (!data?.result?.value) {
        throw new Error('Invalid response from Helius API');
      }

      return data.result.value.uiAmount;
    } catch (error) {
      console.error('Failed to fetch token supply from Helius:', error);
      throw error;
    }
  }

  async getHolderCount(mintAddress: string): Promise<number> {
    try {
      const holders = new Set<string>();
      let cursor: string | undefined;

      while (true) {
        const params: any = {
          limit: 1000,
          mint: mintAddress,
          displayOptions: { showZeroBalance: false }
        };
        if (cursor) params.cursor = cursor;

        const response = await axios.post(this.RPC_URL, {
          jsonrpc: "2.0",
          id: "holder-count",
          method: "getTokenAccounts",
          params
        });

        const data = response.data as TokenAccountResponse;
        
        if (!data.result?.token_accounts || data.result.token_accounts.length === 0) break;
        
        data.result.token_accounts.forEach(account => {
          if (BigInt(account.amount) > BigInt(0)) {
            holders.add(account.owner);
          }
        });

        cursor = data.result.cursor;
        if (!cursor) break;
      }

      return holders.size;
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ Helius API Error:', error.message);
      } else {
        console.error('❌ Unknown Helius API Error');
      }
      throw error;
    }
  }
} 