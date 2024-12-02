import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { Pool } from 'pg';

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
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: 'https://api.helius.xyz/v0',
      params: { 'api-key': process.env.HELIUS_API_KEY }
    });
  }

  async getTokenSupply(mintAddress: string): Promise<number> {
    try {
      const response = await this.api.get(`/tokens/${mintAddress}`);
      return response.data.supply;
    } catch (error) {
      throw error;
    }
  }

  async getHolderCount(mintAddress: string): Promise<number> {
    try {
      const response = await this.api.get(`/tokens/${mintAddress}/holders`);
      return response.data.holderCount;
    } catch (error) {
      throw error;
    }
  }
}

export async function startHeliusTracker() {
  console.log('Initializing Helius tracker...');
  
  // Initial supply check
  await updateSupplyAndHolders().catch(error => {
    console.error('Error in initial supply check:', error);
  });

  // Run every 5 minutes
  setInterval(async () => {
    try {
      await updateSupplyAndHolders();
    } catch (error) {
      console.error('Error updating supply and holders:', error);
    }
  }, 5 * 60 * 1000);

  console.log('Helius tracker initialized');
}

async function updateSupplyAndHolders() {
  const helius = new HeliusAPI();
  const mintAddress = process.env.TOKEN_CA;

  if (!mintAddress) {
    throw new Error('TOKEN_CA environment variable not set');
  }

  try {
    const [supply, holders] = await Promise.all([
      helius.getTokenSupply(mintAddress),
      helius.getHolderCount(mintAddress)
    ]);

    // Update database
    const pool = new Pool({
      connectionString: process.env.TIMESCALE_CONNECTION_STRING,
      ssl: { rejectUnauthorized: true }
    });

    await pool.query(`
      UPDATE token_snapshots 
      SET supply = $1, holders = $2
      WHERE time = (
        SELECT time 
        FROM token_snapshots 
        ORDER BY time DESC 
        LIMIT 1
      )
    `, [supply, holders]);

    console.log('Updated supply and holders:', { supply, holders });
    await pool.end();

  } catch (error) {
    console.error('Error updating supply and holders:', error);
    throw error;
  }
} 