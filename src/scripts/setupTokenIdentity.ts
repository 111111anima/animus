import { Pool } from 'pg';
import dotenv from 'dotenv';
import { getTokenIdentity } from '../constants/tokenIdentity';

// Load environment variables first
dotenv.config();

// Then get token identity with loaded env vars
const TOKEN_IDENTITY = getTokenIdentity();

async function setupTokenIdentity() {
  // Validate required environment variables
  if (!process.env.TOKEN_CA) {
    console.error('Error: TOKEN_CA environment variable is not set');
    process.exit(1);
  }

  if (!process.env.TIMESCALE_CONNECTION_STRING) {
    console.error('Error: TIMESCALE_CONNECTION_STRING environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.TIMESCALE_CONNECTION_STRING,
    ssl: {
      rejectUnauthorized: true
    }
  });

  try {
    // Log values for debugging
    console.log('Setting up token identity with values:', {
      name: TOKEN_IDENTITY.NAME,
      ticker: TOKEN_IDENTITY.TICKER,
      contractAddress: process.env.TOKEN_CA, // Use env directly for logging
      blockchain: TOKEN_IDENTITY.BLOCKCHAIN
    });

    // Create table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS token_identity (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT NOT NULL,
        last_updated TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const values = [
      TOKEN_IDENTITY.NAME,
      TOKEN_IDENTITY.TICKER,
      TOKEN_IDENTITY.DESCRIPTION,
      process.env.TOKEN_CA,  // Use env directly
      TOKEN_IDENTITY.BLOCKCHAIN,
      TOKEN_IDENTITY.TOKEN_STANDARD,
      TOKEN_IDENTITY.LAUNCHPAD,
      TOKEN_IDENTITY.MAIN_DEX
    ];

    // Validate all values are non-null
    const nullValues = values.map((v, i) => ({ value: v, index: i }))
                            .filter(x => x.value === null || x.value === undefined);
    
    if (nullValues.length > 0) {
      console.error('Error: Found null values:', nullValues);
      process.exit(1);
    }

    // Insert values
    await pool.query(`
      INSERT INTO token_identity (key, value, category) VALUES
        ('name', $1, 'basic'),
        ('ticker', $2, 'basic'),
        ('description', $3, 'basic'),
        ('contract_address', $4, 'blockchain'),
        ('blockchain', $5, 'blockchain'),
        ('token_standard', $6, 'blockchain'),
        ('launchpad', $7, 'platform'),
        ('main_dex', $8, 'platform')
      ON CONFLICT (key) 
      DO UPDATE SET 
        value = EXCLUDED.value,
        last_updated = NOW();
    `, values);

    console.log('Token identity setup complete');
  } catch (error) {
    console.error('Error setting up token identity:', error);
  } finally {
    await pool.end();
  }
}

setupTokenIdentity(); 