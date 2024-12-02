import { OpenAIEmbeddings } from "@langchain/openai";
import { Pool } from 'pg';
import { AnimusMood, MoodState } from '../types/mood';
import dotenv from 'dotenv';
import { healthCheck } from './healthCheck';

dotenv.config();

export class MoodService {
  private pool: Pool;
  private embeddings: OpenAIEmbeddings;
  private currentMood: MoodState | null = null;
  
  constructor() {
    this.pool = healthCheck.getPool();
    
    this.embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-small"
    });

    // Listen for health events
    healthCheck.on('critical', () => {
      this.currentMood = null; // Reset state on critical issues
    });
  }

  private determineMood(priceChange: number): AnimusMood {
    if (priceChange > 900) return AnimusMood.EUPHORIA;
    if (priceChange > 100) return AnimusMood.GIGABULLISH;
    if (priceChange > 50) return AnimusMood.BULLISH;
    if (priceChange > 20) return AnimusMood.COOKIN;
    if (priceChange > 0) return AnimusMood.OPTIMISTIC;
    if (priceChange > -10) return AnimusMood.THIS_IS_FINE;
    if (priceChange > -25) return AnimusMood.WORRIED;
    if (priceChange > -50) return AnimusMood.PANIC;
    if (priceChange > -80) return AnimusMood.MAX_COPE;
    return AnimusMood.ITS_OVER;
  }

  async getCurrentMood(): Promise<MoodState> {
    try {
      if (this.currentMood && 
          Date.now() - this.currentMood.timestamp.getTime() < 5 * 60 * 1000) {
        return this.currentMood;
      }

      // First check if we're at genesis time
      const genesisCheck = await this.pool.query(`
        SELECT 
          mj.mood,
          mj.timestamp,
          ABS(EXTRACT(EPOCH FROM (NOW() - mj.timestamp))) as seconds_since_genesis
        FROM mood_journal mj
        WHERE mj.timestamp = (
          SELECT MIN(timestamp) FROM mood_journal
        );
      `);

      // If we're within 5 minutes of genesis, use genesis mood
      if (genesisCheck.rows.length > 0 && 
          genesisCheck.rows[0].seconds_since_genesis < 300) { // 5 minutes
        return {
          mood: genesisCheck.rows[0].mood as AnimusMood,
          priceChange: 0,
          timestamp: genesisCheck.rows[0].timestamp
        };
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

      // Get 15-minute price change
      const result = await this.pool.query(`
        WITH current_snapshot AS (
          SELECT price_usd, time
          FROM token_snapshots
          WHERE price_usd IS NOT NULL
          ORDER BY time DESC
          LIMIT 1
        ),
        previous_snapshot AS (
          SELECT price_usd, time
          FROM token_snapshots
          WHERE price_usd IS NOT NULL
          AND time <= (
            SELECT time FROM current_snapshot
          ) - INTERVAL '15 minutes'
          ORDER BY time DESC
          LIMIT 1
        )
        SELECT 
          cs.price_usd as current_price,
          ps.price_usd as previous_price,
          cs.time as current_time,
          ps.time as previous_time,
          CASE 
            WHEN ps.price_usd > 0 THEN 
              ((cs.price_usd - ps.price_usd) / ps.price_usd * 100)::numeric
            ELSE 0 
          END as price_change
        FROM current_snapshot cs
        LEFT JOIN previous_snapshot ps ON true;
      `);

      const priceChange = parseFloat(result.rows[0]?.price_change || '0');
      const mood = this.determineMood(priceChange);

      this.currentMood = {
        mood,
        priceChange,
        timestamp: new Date()
      };

      return this.currentMood;
    } catch (error) {
      console.error('Error getting mood:', error);
      throw error;
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

  private async generateMarketContext(mood: MoodState): Promise<string> {
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

  async getMoodHistory(hours: number = 24): Promise<MoodState[]> {
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

  private async validateDataFreshness(): Promise<boolean> {
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