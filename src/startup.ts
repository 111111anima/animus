import { Pool } from 'pg';
import dotenv from 'dotenv';
import { GENESIS } from './constants/genesis';

dotenv.config();

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.TIMESCALE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: true }
});

// Function to set genesis timestamp and initial state
async function initializeGenesis() {
  try {
    // Get first record's timestamp and data
    const result = await pool.query(`
      SELECT 
        time,
        holders,
        price_usd,
        marketcap_usd,
        supply
      FROM token_snapshots
      ORDER BY time ASC
      LIMIT 1;
    `);

    if (result?.rows?.length > 0) {
      const genesisData = result.rows[0];
      GENESIS.TIMESTAMP = genesisData.time;
      GENESIS.HOLDERS = parseInt(genesisData.holders);
      GENESIS.PRICE = parseFloat(genesisData.price_usd);
      GENESIS.MARKET_CAP = parseFloat(genesisData.marketcap_usd);
      GENESIS.SUPPLY = parseFloat(genesisData.supply);

      console.log('Genesis state initialized:', GENESIS);
      return true;
    } else {
      console.log('No records found, using default genesis values');
      return false;
    }
  } catch (error) {
    console.error('Error initializing genesis timestamp:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Export initialization function
export const initializeAnimus = async () => {
  const success = await initializeGenesis();
  if (!success) {
    throw new Error('Failed to initialize genesis state');
  }
}; 