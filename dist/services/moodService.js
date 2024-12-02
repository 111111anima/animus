"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoodService = void 0;
const openai_1 = require("@langchain/openai");
const mood_1 = require("../types/mood");
const dotenv_1 = __importDefault(require("dotenv"));
const healthCheck_1 = require("./healthCheck");
dotenv_1.default.config();
class MoodService {
    constructor() {
        this.currentMood = null;
        this.pool = healthCheck_1.healthCheck.getPool();
        this.embeddings = new openai_1.OpenAIEmbeddings({
            modelName: "text-embedding-3-small"
        });
        // Listen for health events
        healthCheck_1.healthCheck.on('critical', () => {
            this.currentMood = null; // Reset state on critical issues
        });
    }
    determineMood(priceChange) {
        if (priceChange > 900)
            return mood_1.AnimusMood.EUPHORIA;
        if (priceChange > 100)
            return mood_1.AnimusMood.GIGABULLISH;
        if (priceChange > 50)
            return mood_1.AnimusMood.BULLISH;
        if (priceChange > 20)
            return mood_1.AnimusMood.COOKIN;
        if (priceChange > 0)
            return mood_1.AnimusMood.OPTIMISTIC;
        if (priceChange > -10)
            return mood_1.AnimusMood.THIS_IS_FINE;
        if (priceChange > -25)
            return mood_1.AnimusMood.WORRIED;
        if (priceChange > -50)
            return mood_1.AnimusMood.PANIC;
        if (priceChange > -80)
            return mood_1.AnimusMood.MAX_COPE;
        return mood_1.AnimusMood.ITS_OVER;
    }
    async getCurrentMood() {
        try {
            if (this.currentMood &&
                Date.now() - this.currentMood.timestamp.getTime() < 5 * 60 * 1000) {
                return this.currentMood;
            }
            // Debug: Check recent price data first
            const debugResult = await this.pool.query(`
        WITH price_data AS (
          SELECT 
            time,
            price_usd,
            LAG(price_usd) OVER (ORDER BY time) as prev_price,
            marketcap_usd,
            period_volume
          FROM token_snapshots
          WHERE time > NOW() - INTERVAL '30 minutes'
          ORDER BY time DESC
        )
        SELECT 
          time,
          price_usd,
          prev_price,
          CASE 
            WHEN prev_price > 0 THEN 
              ((price_usd - prev_price) / prev_price * 100)::numeric(10,2)
            ELSE 0 
          END as price_change_pct,
          marketcap_usd,
          period_volume
        FROM price_data
        LIMIT 5;
      `);
            console.log('Recent price data:', {
                rows: debugResult.rows,
                count: debugResult.rowCount,
                timestamp: new Date()
            });
            // Get 15-minute price change
            const result = await this.pool.query(`
        WITH latest_price AS (
          SELECT price_usd, time
          FROM token_snapshots 
          ORDER BY time DESC 
          LIMIT 1
        ),
        price_15m_ago AS (
          SELECT price_usd, time
          FROM token_snapshots 
          WHERE time <= NOW() - INTERVAL '15 minutes'
          ORDER BY time DESC 
          LIMIT 1
        )
        SELECT 
          CASE 
            WHEN price_15m_ago.price_usd > 0 THEN
              ((latest_price.price_usd - price_15m_ago.price_usd) / price_15m_ago.price_usd * 100)
            ELSE 0
          END as price_change,
          latest_price.time as current_time,
          price_15m_ago.time as previous_time
        FROM latest_price 
        CROSS JOIN price_15m_ago;
      `);
            console.log('Price change calculation:', {
                result: result.rows[0],
                timestamp: new Date()
            });
            const priceChange = parseFloat(result.rows[0]?.price_change || '0');
            const mood = this.determineMood(priceChange);
            this.currentMood = {
                mood,
                priceChange,
                timestamp: new Date()
            };
            return this.currentMood;
        }
        catch (error) {
            console.error('Error in mood service:', error);
            return {
                mood: mood_1.AnimusMood.THIS_IS_FINE,
                priceChange: 0,
                timestamp: new Date()
            };
        }
    }
    async recordMoodJournal() {
        const mood = await this.getCurrentMood();
        const context = await this.generateMarketContext(mood);
        const [embedding] = await this.embeddings.embedDocuments([
            `${mood.mood} ${context}`
        ]);
        await this.pool.query(`
      INSERT INTO mood_journal 
      (timestamp, mood, price_change_15m, market_context, embedding)
      VALUES ($1, $2, $3, $4, $5)
    `, [
            mood.timestamp,
            mood.mood,
            mood.priceChange,
            context,
            embedding
        ]);
    }
    async generateMarketContext(mood) {
        // Get relevant market metrics for context
        const result = await this.pool.query(`
      SELECT 
        price_usd,
        marketcap_usd,
        period_volume,
        holders
      FROM token_snapshots
      ORDER BY time DESC
      LIMIT 1;
    `);
        return `Market Context: Price $${result.rows[0].price_usd}, ` +
            `MCap $${result.rows[0].marketcap_usd}, ` +
            `Volume $${result.rows[0].period_volume}, ` +
            `Holders ${result.rows[0].holders}`;
    }
    async getMoodHistory(hours = 24) {
        const result = await this.pool.query(`
      SELECT 
        timestamp,
        mood,
        price_change_15m as "priceChange",
        market_context as context
      FROM mood_journal
      WHERE timestamp > NOW() - INTERVAL '${hours} hours'
      ORDER BY timestamp DESC;
    `);
        return result.rows;
    }
    async validateDataFreshness() {
        const result = await this.pool.query(`
      SELECT 
        NOW() - MAX(time) as data_age,
        COUNT(*) as records_last_hour
      FROM token_snapshots
      WHERE time > NOW() - INTERVAL '1 hour'
    `);
        const dataAge = result.rows[0].data_age;
        const recordsLastHour = parseInt(result.rows[0].records_last_hour);
        if (dataAge > '5 minutes' || recordsLastHour < 10) {
            console.error('Stale data detected:', {
                dataAge,
                recordsLastHour,
                timestamp: new Date()
            });
            return false;
        }
        return true;
    }
}
exports.MoodService = MoodService;
