"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = exports.HealthCheckService = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const events_1 = require("events");
dotenv_1.default.config();
class HealthCheckService extends events_1.EventEmitter {
    constructor() {
        super();
        this.lastSuccessfulCheck = null;
        this.lastSuccessfulFetch = null;
        this.consecutiveFailures = 0;
        this.MAX_FAILURES = 3;
        this.CHECK_INTERVAL = 30 * 1000; // 30 seconds
        this.RECOVERY_DELAY = 5000; // 5 seconds
        this.pool = new pg_1.Pool({
            connectionString: process.env.TIMESCALE_CONNECTION_STRING,
            ssl: { rejectUnauthorized: true },
            // Add connection pool settings
            max: 20, // maximum connections
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            maxUses: 7500 // close connections after this many uses
        });
        this.setupHealthCheck();
        this.setupEventHandlers();
    }
    async checkDatabaseHealth() {
        try {
            const client = await this.pool.connect();
            const result = await client.query(`
        WITH metrics AS (
          SELECT 
            NOW() - MAX(time) as data_age,
            COUNT(*) as recent_records,
            MAX(time) as latest_record
          FROM token_snapshots
          WHERE time > NOW() - INTERVAL '3 minutes'
        )
        SELECT 
          data_age,
          recent_records,
          EXTRACT(EPOCH FROM (NOW() - latest_record)) as seconds_since_last_record
        FROM metrics
      `);
            client.release();
            const { data_age: dataAge, recent_records: recentRecords, seconds_since_last_record: secondsSinceLastRecord } = result.rows[0];
            // Log health status
            console.log('Database health check:', {
                dataAge,
                recentRecords,
                secondsSinceLastRecord,
                consecutiveFailures: this.consecutiveFailures,
                lastSuccessfulCheck: this.lastSuccessfulCheck,
                timestamp: new Date()
            });
            // More lenient health check criteria
            const isHealthy = (
            // Either no data yet (first run) or recent data exists
            (dataAge === null || secondsSinceLastRecord < 180) &&
                // Allow for initial startup
                (this.lastSuccessfulCheck === null ||
                    Date.now() - this.lastSuccessfulCheck.getTime() < 3 * 60 * 1000));
            if (isHealthy) {
                this.lastSuccessfulCheck = new Date();
                this.consecutiveFailures = 0;
            }
            return isHealthy;
        }
        catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }
    async attemptRecovery() {
        try {
            console.log('Attempting database recovery...');
            // Don't immediately close pool, give time for pending queries
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Create new pool
            const newPool = new pg_1.Pool({
                connectionString: process.env.TIMESCALE_CONNECTION_STRING,
                ssl: { rejectUnauthorized: true },
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000
            });
            // Test new connection
            const client = await newPool.connect();
            await client.query('SELECT NOW()');
            client.release();
            // Old pool cleanup
            await this.pool.end();
            this.pool = newPool;
            // Verify health with new pool
            const healthy = await this.checkDatabaseHealth();
            if (healthy) {
                console.log('Database recovery successful');
                this.consecutiveFailures = 0;
                this.lastSuccessfulCheck = new Date();
                this.emit('recovered');
            }
            else {
                throw new Error('Recovery verification failed');
            }
        }
        catch (error) {
            console.error('Database recovery failed:', error);
            this.emit('recoveryFailed', error);
            throw error;
        }
    }
    setupHealthCheck() {
        setInterval(async () => {
            try {
                const isHealthy = await this.checkDatabaseHealth();
                if (isHealthy) {
                    this.consecutiveFailures = 0;
                    this.lastSuccessfulCheck = new Date();
                    this.emit('healthy');
                }
                else {
                    this.consecutiveFailures++;
                    this.emit('unhealthy', this.consecutiveFailures);
                    if (this.consecutiveFailures >= this.MAX_FAILURES) {
                        this.emit('critical', {
                            failures: this.consecutiveFailures,
                            lastSuccess: this.lastSuccessfulCheck
                        });
                        // Attempt recovery
                        await this.attemptRecovery();
                    }
                }
            }
            catch (error) {
                console.error('Health check failed:', error);
                this.emit('error', error);
            }
        }, this.CHECK_INTERVAL);
    }
    setupEventHandlers() {
        this.on('unhealthy', (failures) => {
            console.warn(`Database unhealthy. Consecutive failures: ${failures}`);
        });
        this.on('critical', (info) => {
            console.error('CRITICAL: Database health check failed multiple times:', info);
        });
        this.on('recovered', () => {
            console.log('Database service recovered successfully');
        });
        this.on('recoveryFailed', (error) => {
            console.error('CRITICAL: Database recovery failed:', error);
            // In production, this would trigger alerts
        });
    }
    getPool() {
        return this.pool;
    }
}
exports.HealthCheckService = HealthCheckService;
// Export singleton instance
exports.healthCheck = new HealthCheckService();
