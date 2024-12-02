import { Pool } from 'pg';
import dotenv from 'dotenv';
import { HeliusAPI } from './helius';
import { GENESIS } from '../constants/genesis';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.TIMESCALE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: true }
});

export class SupplyTrackerService {
  private helius: HeliusAPI;
  private pool: Pool;

  constructor() {
    this.helius = new HeliusAPI();
    this.pool = pool;
  }

  async getLatestData() {
    try {
      const result = await this.pool.query(`
        SELECT supply, holders, time
        FROM token_snapshots
        WHERE supply IS NOT NULL AND holders IS NOT NULL
        ORDER BY time DESC
        LIMIT 1;
      `);

      if (result?.rows?.[0]) {
        return {
          supply: parseFloat(result.rows[0].supply),
          holders: parseInt(result.rows[0].holders),
          time: result.rows[0].time
        };
      }

      return {
        supply: GENESIS.SUPPLY,
        holders: GENESIS.HOLDERS,
        time: GENESIS.TIMESTAMP
      };

    } catch (error) {
      throw error;
    }
  }

  async updateSupplyAndHolders() {
    try {
      const supply = await this.helius.getTokenSupply(process.env.TOKEN_CA!);
      const holders = await this.helius.getHolderCount(process.env.TOKEN_CA!);
      
      await this.pool.query(`
        UPDATE token_snapshots 
        SET supply = $1, holders = $2
        WHERE time = (
          SELECT time 
          FROM token_snapshots 
          WHERE time > NOW() - INTERVAL '5 minutes'
          ORDER BY time DESC 
          LIMIT 1
        )
      `, [supply, holders]);

    } catch (error) {
      throw error;
    }
  }
} 