import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create a singleton pool instance
export const pool = new Pool({
  connectionString: process.env.TIMESCALE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: true }
});

// Add error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Add connection validation
export async function validateConnection() {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
} 