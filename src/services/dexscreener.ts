import axios from 'axios';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { datasource } from './db';

dotenv.config();

const dexscreener = axios.create({
  baseURL: process.env.DEXSCREENER_API_URL
});

async function fetchTokenData() {
  try {
    console.log('Fetching token data at:', new Date().toISOString());
    
    const response = await dexscreener.get(`/tokens/${process.env.TOKEN_CA}`);
    console.log('DexScreener response:', response.data);
    
    if (!response.data.pairs || response.data.pairs.length === 0) {
      console.error('No pairs found for token');
      return;
    }

    // Sort pairs by liquidity and get the one with highest liquidity
    const pairs = response.data.pairs.sort((a: any, b: any) => {
      const liquidityA = parseFloat(a.liquidity?.usd || '0');
      const liquidityB = parseFloat(b.liquidity?.usd || '0');
      return liquidityB - liquidityA;
    });

    const pair = pairs[0];
    console.log('Selected pair:', pair);

    // Insert data with better error handling
    try {
      const result = await datasource.query(
        `INSERT INTO token_snapshots (
          time, 
          marketcap_usd, 
          price_usd, 
          period_volume
        ) VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [
          new Date(),
          parseFloat(pair.fdv || '0'),
          parseFloat(pair.priceUsd || '0'),
          parseFloat(pair.volume?.h24 || '0')
        ]
      );

      console.log('Data snapshot recorded:', result.rows[0]);
    } catch (dbError) {
      console.error('Database error:', dbError);
    }
  } catch (error) {
    console.error('Error fetching token data:', error);
  }
}

// Start the service
console.log('Starting DexScreener service...');
fetchTokenData(); // Initial fetch
setInterval(fetchTokenData, 30000); // Every 30 seconds

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down DexScreener service...');
  await datasource.end();
  process.exit(0);
});
  