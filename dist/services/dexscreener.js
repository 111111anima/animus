"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDexScreener = startDexScreener;
const axios_1 = __importDefault(require("axios"));
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Initialize PostgreSQL connection pool with connection string
const pool = new pg_1.Pool({
    connectionString: process.env.TIMESCALE_CONNECTION_STRING,
    ssl: {
        rejectUnauthorized: true
    }
});
// Add connection error handling
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});
// Add connection test
pool.connect((err, client, done) => {
    if (err) {
        console.error('Error connecting to the database', err);
    }
    else {
        console.log('Successfully connected to database');
        done();
    }
});
// DexScreener API client
const dexscreener = axios_1.default.create({
    baseURL: 'https://api.dexscreener.com/latest/dex',
    timeout: 5000
});
async function fetchTokenData() {
    try {
        console.log('Fetching token data at:', new Date().toISOString());
        const response = await dexscreener.get(`/tokens/${process.env.TOKEN_CA}`);
        if (!response.data.pairs || response.data.pairs.length === 0) {
            console.error('No pairs found for token');
            return;
        }
        // Sort pairs by liquidity and get the one with highest liquidity
        const pairs = response.data.pairs.sort((a, b) => {
            const liquidityA = parseFloat(a.liquidity?.usd || '0');
            const liquidityB = parseFloat(b.liquidity?.usd || '0');
            return liquidityB - liquidityA;
        });
        const pair = pairs[0];
        // Insert data with better error handling
        try {
            await pool.query(`INSERT INTO token_snapshots (
          time, 
          marketcap_usd, 
          price_usd, 
          period_volume
        ) VALUES ($1, $2, $3, $4)`, [
                new Date(),
                parseFloat(pair.fdv || '0'),
                parseFloat(pair.priceUsd || '0'),
                parseFloat(pair.volume?.h24 || '0')
            ]);
            console.log('Data snapshot recorded:', {
                timestamp: new Date(),
                price: pair.priceUsd,
                marketcap: pair.fdv,
                volume24h: pair.volume?.h24
            });
        }
        catch (dbError) {
            console.error('Database error:', dbError);
        }
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            console.error('DexScreener API error:', {
                status: error.response?.status,
                message: error.message,
                url: error.config?.url,
                timestamp: new Date().toISOString()
            });
        }
        else {
            console.error('Unknown error:', error);
        }
    }
}
// Add heartbeat logging
setInterval(() => {
    console.log('DexScreener service heartbeat:', new Date().toISOString());
}, 30 * 1000);
// Add health monitoring
let lastSuccessfulFetch = null;
let consecutiveFailures = 0;
const MAX_FAILURES = 3;
// Add retry mechanism
async function fetchWithRetry(retries = 3, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            await fetchTokenData();
            consecutiveFailures = 0;
            lastSuccessfulFetch = new Date();
            return;
        }
        catch (error) {
            consecutiveFailures++;
            console.error(`Fetch attempt ${i + 1} failed:`, {
                error,
                consecutiveFailures,
                lastSuccessfulFetch,
                timestamp: new Date()
            });
            if (consecutiveFailures >= MAX_FAILURES) {
                // Alert through monitoring system
                console.error('CRITICAL: Multiple consecutive failures', {
                    consecutiveFailures,
                    lastSuccessfulFetch
                });
                // In production, this would trigger alerts
            }
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error('All retry attempts failed');
}
// Add health check endpoint
async function checkHealth() {
    if (!lastSuccessfulFetch)
        return false;
    const timeSinceLastFetch = Date.now() - lastSuccessfulFetch.getTime();
    const isHealthy = timeSinceLastFetch < 5 * 60 * 1000; // 5 minutes
    if (!isHealthy) {
        console.error('Service unhealthy:', {
            lastSuccessfulFetch,
            timeSinceLastFetch: `${Math.round(timeSinceLastFetch / 1000)}s`,
            consecutiveFailures
        });
    }
    return isHealthy;
}
// Modify the interval to use retry mechanism
setInterval(() => {
    fetchWithRetry()
        .catch(error => {
        console.error('Critical: Fetch with retry failed:', error);
        // In production, this would trigger immediate alerts
    });
}, 60 * 1000);
// Add process monitoring
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Log error and attempt recovery
    fetchWithRetry()
        .catch(() => {
        console.error('CRITICAL: Recovery failed after uncaught exception');
        process.exit(1); // Force restart in production environment
    });
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Attempt recovery
    fetchWithRetry()
        .catch(() => {
        console.error('CRITICAL: Recovery failed after unhandled rejection');
    });
});
// Add database connection monitoring
pool.on('error', async (err) => {
    console.error('Database pool error:', err);
    // Attempt to reconnect
    try {
        await pool.end();
        await pool.connect();
        console.log('Database connection recovered');
    }
    catch (error) {
        console.error('CRITICAL: Database recovery failed:', error);
        process.exit(1); // Force restart in production environment
    }
});
// Update validation query to match new schema
async function validateDataCollection() {
    try {
        const result = await pool.query(`
      WITH metrics AS (
        SELECT 
          COUNT(*) as record_count,
          MAX(time) as latest_record,
          NOW() - MAX(time) as time_since_last_record,
          AVG(EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time)))) as avg_interval
        FROM token_snapshots
        WHERE time > NOW() - INTERVAL '10 minutes'
      )
      SELECT 
        record_count,
        latest_record,
        time_since_last_record,
        ROUND(avg_interval::numeric, 2) as avg_interval_seconds
      FROM metrics
    `);
        const { record_count, latest_record, time_since_last_record, avg_interval_seconds } = result.rows[0];
        console.log('Data Collection Status:', {
            totalRecords: record_count,
            latestRecord: latest_record,
            timeSinceLastRecord: time_since_last_record,
            averageInterval: `${avg_interval_seconds} seconds`
        });
        // Alert if we're missing data points
        if (time_since_last_record > '2 minutes') {
            console.error('Warning: No data collected in the last 2 minutes');
        }
    }
    catch (error) {
        console.error('Error validating data collection:', error);
    }
}
// Run validation every 2 minutes
setInterval(validateDataCollection, 2 * 60 * 1000);
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
async function startDexScreener() {
    console.log('Initializing DexScreener service...');
    // Initial fetch
    await fetchWithRetry().catch(error => {
        console.error('Error in initial fetchTokenData:', error);
    });
    // Run every 1 minute with error handling
    setInterval(() => {
        fetchWithRetry()
            .catch(error => {
            console.error('Critical: Fetch with retry failed:', error);
        });
    }, 60 * 1000);
    // Add heartbeat logging
    setInterval(() => {
        console.log('DexScreener service heartbeat:', new Date().toISOString());
    }, 30 * 1000);
    console.log('DexScreener service initialized');
}
