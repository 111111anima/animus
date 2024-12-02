import { Pool } from 'pg';
import dotenv from 'dotenv';
import { GENESIS } from '../constants/genesis';

dotenv.config();

async function resetDatabase() {
  const pool = new Pool({
    connectionString: process.env.TIMESCALE_CONNECTION_STRING,
    ssl: { rejectUnauthorized: true }
  });

  try {
    console.log('Starting database reset...');

    // Drop and recreate tables
    await pool.query(`
      DROP TABLE IF EXISTS token_snapshots CASCADE;
      DROP TABLE IF EXISTS mood_journal CASCADE;
      DROP TABLE IF EXISTS token_identity CASCADE;
      
      CREATE TABLE token_snapshots (
        time TIMESTAMPTZ NOT NULL,
        marketcap_usd NUMERIC NOT NULL,
        price_usd NUMERIC NOT NULL,
        period_volume NUMERIC NOT NULL,
        supply NUMERIC,
        holders INTEGER
      );

      -- Convert to hypertable
      SELECT create_hypertable('token_snapshots', 'time');

      -- Create mood_journal table
      CREATE TABLE mood_journal (
        timestamp TIMESTAMPTZ NOT NULL,
        mood TEXT NOT NULL,
        price_change_15m NUMERIC,
        market_context TEXT,
        embedding vector(1536)
      );
    `);

    // Insert genesis record for token_snapshots
    await pool.query(`
      INSERT INTO token_snapshots (
        time, 
        marketcap_usd, 
        price_usd, 
        period_volume,
        supply,
        holders
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      GENESIS.TIMESTAMP,
      GENESIS.MARKET_CAP,
      GENESIS.PRICE,
      0,
      GENESIS.SUPPLY,
      1
    ]);

    // Insert genesis mood record
    await pool.query(`
      INSERT INTO mood_journal (
        timestamp,
        mood,
        price_change_15m,
        market_context
      ) VALUES ($1, $2, $3, $4)
    `, [
      GENESIS.TIMESTAMP,
      'OPTIMISTIC',
      0,
      `Genesis Market Context: Price $${GENESIS.PRICE}, MCap $${GENESIS.MARKET_CAP}, Volume $0, Holders ${GENESIS.HOLDERS}`
    ]);

    console.log('Database reset complete!');
    console.log('Genesis values inserted:', {
      timestamp: GENESIS.TIMESTAMP,
      marketCap: GENESIS.MARKET_CAP,
      price: GENESIS.PRICE,
      supply: GENESIS.SUPPLY,
      holders: GENESIS.HOLDERS,
      mood: 'OPTIMISTIC'
    });

  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

resetDatabase(); 