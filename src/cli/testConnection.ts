import { validateConnection } from '../services/db';
import { HeliusAPI } from '../services/helius';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  try {
    // Test database connection
    console.log('Testing database connection...');
    const dbConnected = await validateConnection();
    console.log('Database connection:', dbConnected ? 'OK' : 'FAILED');

    // Test Helius API
    console.log('\nTesting Helius API...');
    const helius = new HeliusAPI();
    const mintAddress = process.env.TOKEN_CA;
    if (!mintAddress) {
      throw new Error('TOKEN_CA not set');
    }
    console.log('Using mint address:', mintAddress);

    let supply = 0;
    let holders = 0;

    try {
      supply = await helius.getTokenSupply(mintAddress);
      console.log('Supply response:', supply);
    } catch (error) {
      console.error('Supply error:', error);
    }

    try {
      holders = await helius.getHolderCount(mintAddress);
      console.log('Holders response:', holders);
    } catch (error) {
      console.error('Holders error:', error);
    }

    console.log('Helius API:', { supply, holders });

  } catch (error) {
    console.error('Test failed:', error);
  }
}

main(); 