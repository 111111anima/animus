"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const genesis_1 = require("../constants/genesis");
dotenv_1.default.config();
async function resetDatabase() {
    const pool = new pg_1.Pool({
        connectionString: process.env.TIMESCALE_CONNECTION_STRING,
        ssl: { rejectUnauthorized: true }
    });
    try {
        console.log('Resetting database...');
        // Drop existing tables
        await pool.query(`
      DROP TABLE IF EXISTS token_snapshots CASCADE;
      DROP TABLE IF EXISTS mood_journal CASCADE;
      DROP TABLE IF EXISTS token_identity CASCADE;
    `);
        // Recreate tables
        await pool.query(`
      -- Create the token snapshots table
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

      -- Create mood journal table
      CREATE TABLE mood_journal (
        id SERIAL,
        timestamp TIMESTAMPTZ NOT NULL,
        mood TEXT NOT NULL,
        price_change_15m NUMERIC NOT NULL,
        market_context TEXT,
        embedding vector(1536)
      );

      -- Create hypertable for mood journal
      SELECT create_hypertable('mood_journal', 'timestamp');

      -- Create token identity table
      CREATE TABLE token_identity (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT NOT NULL,
        last_updated TIMESTAMPTZ DEFAULT NOW()
      );
    `);
        // Insert initial data
        await pool.query(`
      INSERT INTO token_snapshots (time, marketcap_usd, price_usd, period_volume)
      VALUES ($1, $2, $3, 0)
    `, [
            genesis_1.GENESIS.TIMESTAMP,
            genesis_1.GENESIS.MARKET_CAP,
            genesis_1.GENESIS.PRICE
        ]);
        console.log('Database reset complete!');
        console.log('Genesis values inserted:', {
            timestamp: genesis_1.GENESIS.TIMESTAMP,
            marketCap: genesis_1.GENESIS.MARKET_CAP,
            price: genesis_1.GENESIS.PRICE
        });
    }
    catch (error) {
        console.error('Error resetting database:', error);
        throw error;
    }
    finally {
        await pool.end();
    }
}
// Run if called directly
if (require.main === module) {
    resetDatabase()
        .then(() => process.exit(0))
        .catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
