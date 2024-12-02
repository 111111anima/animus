import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create a singleton datasource instance
export const datasource = new Pool({
  connectionString: process.env.TIMESCALE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: true },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Add query logging middleware
datasource.on('query', (e: any) => {
  console.log('Executing query:', e.text);
  console.log('Query parameters:', e.values);
});

// Add error handling
datasource.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Add connection validation with better error reporting
export async function validateConnection() {
  try {
    console.log('Attempting database connection...');
    const client = await datasource.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log('Database connected successfully:', result.rows[0].current_time);
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
} 