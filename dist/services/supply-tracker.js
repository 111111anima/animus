"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const helius_1 = require("./helius");
dotenv_1.default.config();
const pool = new pg_1.Pool({
    connectionString: process.env.TIMESCALE_CONNECTION_STRING,
    ssl: {
        rejectUnauthorized: true
    }
});
const helius = new helius_1.HeliusAPI();
async function updateSupplyAndHolders() {
    try {
        console.log('Fetching supply and holder data...');
        const supply = await helius.getTokenSupply(process.env.TOKEN_CA);
        console.log('Current supply:', supply);
        const holders = await helius.getHolderCount(process.env.TOKEN_CA);
        console.log('Current holder count:', holders);
        // Update the most recent record within the last 5 minutes
        const result = await pool.query(`
      UPDATE token_snapshots 
      SET 
        supply = $1,
        holders = $2
      WHERE time = (
        SELECT time 
        FROM token_snapshots 
        WHERE time > NOW() - INTERVAL '5 minutes'
        ORDER BY time DESC 
        LIMIT 1
      )
      RETURNING time;
    `, [supply, holders]);
        if (result?.rowCount && result.rowCount > 0) {
            console.log('Supply and holders updated:', {
                timestamp: result.rows[0].time,
                supply,
                holders,
                interval: '5 minutes'
            });
        }
        else {
            console.log('No recent records found to update');
            // Insert a new record if update fails
            await pool.query(`
        INSERT INTO token_snapshots (
          time, 
          marketcap_usd, 
          price_usd, 
          period_volume, 
          supply, 
          holders
        )
        SELECT 
          NOW(),
          marketcap_usd,
          price_usd,
          period_volume,
          $1,
          $2
        FROM token_snapshots
        ORDER BY time DESC
        LIMIT 1;
      `, [supply, holders]);
            console.log('Inserted new record with supply and holders');
        }
    }
    catch (error) {
        if (error instanceof Error) {
            console.error('Error updating supply and holders:', error.message);
        }
        else {
            console.error('Unknown error updating supply and holders');
        }
    }
}
// Run every 5 minutes
setInterval(updateSupplyAndHolders, 5 * 60 * 1000);
// Initial update
updateSupplyAndHolders();
// Handle process termination
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await pool.end();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await pool.end();
    process.exit(0);
});
