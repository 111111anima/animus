import { ChatOpenAI } from "@langchain/openai";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { MoodService } from './moodService';
import { GENESIS } from '../constants/genesis';
import dotenv from 'dotenv';
import { SupplyTrackerService } from './supply-tracker';
import { getTokenIdentity } from '../constants/tokenIdentity';

dotenv.config();

// Initialize database connection
const datasource = new DataSource({
  type: "postgres",
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || "5432"),
  username: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: true },
  connectTimeoutMS: 10000
});

const llm = new ChatOpenAI({ 
  modelName: "gpt-4-turbo-preview",
  temperature: 0.5
});

// Get token identity after env vars are loaded
const TOKEN_IDENTITY = getTokenIdentity();

export class AnimusLLM {
  private initialized: boolean = false;
  private moodService: MoodService;
  private supplyTracker: SupplyTrackerService;
  private chain!: RunnableSequence;
  private currentAge: { days: number, hours: number } = { days: 0, hours: 0 };

  private readonly TOKEN_IDENTITY = getTokenIdentity();

  private readonly IDENTITY_TRIGGERS = [
    'name', 'ticker', 'symbol', 'contract', 'ca', 'address', 'token', 'identity'
  ];

  constructor() {
    this.moodService = new MoodService();
    this.supplyTracker = new SupplyTrackerService();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      if (!datasource.isInitialized) {
        await datasource.initialize();
      }

      const db = await SqlDatabase.fromDataSourceParams({
        appDataSource: datasource
      });

      // Create purely metric-focused prompt
      this.chain = RunnableSequence.from([
        PromptTemplate.fromTemplate(`
          You are a data query interface for a token on {network}.
          
          Context: {context}

          CRITICAL FORMATTING RULES:
          1. Return ONLY the exact metric data requested
          2. Format numbers with appropriate symbols ($ for USD, % for percentages)
          3. Keep all decimal places as provided
          4. Include commas in large numbers
          5. No commentary or personality
          6. No explanations unless specifically asked
          7. Just return the raw numbers with appropriate symbols
          
          When asked about identity, return only:
          - Name: {name}
          - Symbol: {symbol}
          - Network: {network}
          - Contract: {contractAddress}
          
          Question: {question}
          
          Return only the requested metric data:
        `),
        llm,
        new StringOutputParser()
      ]);

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing AnimusLLM:', error);
      throw error;
    }
  }

  private extractTimeframe(question: string): number {
    // Regex patterns for different time units
    const patterns = {
      year: /(\d+)\s*(?:year|yr)s?/i,
      month: /(\d+)\s*month?s?/i,
      week: /(\d+)\s*week?s?/i,
      day: /(\d+)\s*day?s?/i,
      hour: /(\d+)\s*(?:hour|hr)s?/i,
      minute: /(\d+)\s*(?:minute|min)s?/i
    };

    let totalMinutes = 0;

    // Extract and sum up all time components
    Object.entries(patterns).forEach(([unit, pattern]) => {
      const match = question.match(pattern);
      if (match) {
        const value = parseInt(match[1]);
        switch(unit) {
          case 'year':
            totalMinutes += value * 525600; // 365 days
            break;
          case 'month':
            totalMinutes += value * 43200; // 30 days
            break;
          case 'week':
            totalMinutes += value * 10080; // 7 days
            break;
          case 'day':
            totalMinutes += value * 1440;
            break;
          case 'hour':
            totalMinutes += value * 60;
            break;
          case 'minute':
            totalMinutes += value;
            break;
        }
      }
    });

    // Handle "since genesis" type questions
    if (this.isGenesisQuestion(question)) {
      return Number.MAX_SAFE_INTEGER; // Will trigger genesis comparison
    }

    // Default to 24 hours if no timeframe specified
    return totalMinutes || 1440;
  }

  private isGenesisQuestion(question: string): boolean {
    const genesisKeywords = [
      'since genesis', 'since launch', 'since birth', 'since creation',
      'from genesis', 'from launch', 'from birth', 'from creation',
      'at launch', 'at birth', 'at creation',
      'when you launched', 'when you were born', 'when you were created'
    ];
    return genesisKeywords.some(keyword => 
      question.toLowerCase().includes(keyword)
    );
  }

  private isAgeQuestion(question: string): boolean {
    const ageKeywords = [
      'how old', 'age', 'birth date', 'birthday',
      'when were you', 'when did you', 'days old',
      'hours old', 'minutes old'
    ];
    return ageKeywords.some(keyword => 
      question.toLowerCase().includes(keyword)
    );
  }

  private formatTimeInterval(minutes: number): string {
    const years = Math.floor(minutes / 525600);
    const months = Math.floor((minutes % 525600) / 43200);
    const weeks = Math.floor((minutes % 43200) / 10080);
    const days = Math.floor((minutes % 10080) / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;

    const parts = [];
    if (years) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    if (months) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    if (weeks) parts.push(`${weeks} week${weeks !== 1 ? 's' : ''}`);
    if (days) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (mins) parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);

    return parts.join(', ');
  }

  private async isPreGenesis(timeframeMinutes: number): Promise<boolean> {
    try {
      // First get our actual age in minutes
      const ageResult = await datasource.query(`
        SELECT 
          EXTRACT(EPOCH FROM (NOW() - MIN(time))) / 60 as age_minutes,
          EXTRACT(DAY FROM (NOW() - MIN(time)))::integer as days,
          EXTRACT(HOUR FROM (NOW() - MIN(time)))::integer as hours
        FROM token_snapshots;
      `);
      
      // If we can't determine age, assume not pre-genesis
      if (!ageResult?.rows?.[0]?.age_minutes) {
        return false;
      }

      // Store age info for the error message
      this.currentAge = {
        days: ageResult.rows[0].days,
        hours: ageResult.rows[0].hours
      };

      // Compare requested timeframe with our actual age in minutes
      const ageInMinutes = ageResult.rows[0].age_minutes;
      return timeframeMinutes > ageInMinutes;
    } catch (error) {
      // Silently handle error and assume not pre-genesis
      return false;
    }
  }

  private isIdentityQuestion(question: string): boolean {
    return this.IDENTITY_TRIGGERS.some(trigger => 
      question.toLowerCase().includes(trigger)
    );
  }

  private enforceTwitterLimit(text: string): string {
    // First remove any emojis using regex
    const noEmojis = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '');
    
    // Then handle sentence splitting and length limit
    const sentences = noEmojis.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    let tweet = '';
    
    for (const sentence of sentences) {
      const potentialTweet = tweet + (tweet ? ' ' : '') + sentence + '.';
      if (potentialTweet.length <= 280) {
        tweet = potentialTweet;
      } else {
        break; // Stop if adding next sentence would exceed limit
      }
    }

    return tweet || sentences[0] + '.'; // Ensure at least one sentence
  }

  private formatNumericValues(context: any): any {
    return {
      ...context,
      // Safely format price changes with % symbol and 2 decimal places
      priceChange: typeof context.priceChange === 'number' 
        ? `${context.priceChange.toFixed(2)}%` 
        : '0%',
      priceChangeGenesis: typeof context.priceChangeGenesis === 'number'
        ? `${context.priceChangeGenesis.toFixed(2)}%`
        : '0%',
      // Add volume change percentage formatting
      volumeChange: typeof context.volumeChange === 'number'
        ? `${context.volumeChange.toFixed(2)}%`
        : '0%',
      // Safely format USD values with $ symbol and 2 decimal places
      price: typeof context.price === 'number'
        ? `$${context.price.toFixed(4)}`  // Show more decimals for price
        : '$0.00',
      marketCap: typeof context.marketCap === 'number'
        ? `$${Math.round(context.marketCap).toLocaleString()}`
        : '$0',
      // Fix volume formatting to handle millions properly
      volume: typeof context.volume === 'number'
        ? `$${Math.round(context.volume).toLocaleString()}`
        : '$0',
      // Safely format other numeric values
      holders: context.holders ? context.holders.toLocaleString() : '0',
      supply: context.supply ? context.supply.toLocaleString() : '0'
    };
  }

  async ask(question: string): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Add debug logging
      console.log('Querying current metrics...');
      
      // Handle current metrics first
      const currentMetrics = await datasource.query(`
        WITH latest_metrics AS (
          SELECT 
            COALESCE(ts1.price_usd, ts2.price_usd) as price_usd,
            COALESCE(ts1.marketcap_usd, ts2.marketcap_usd) as marketcap_usd,
            COALESCE(ts1.period_volume, ts2.period_volume) as period_volume,
            COALESCE(ts1.holders, ts2.holders) as holders,
            COALESCE(ts1.supply, ts2.supply) as supply,
            GREATEST(ts1.time, ts2.time) as time
          FROM 
            (SELECT * FROM token_snapshots WHERE price_usd IS NOT NULL ORDER BY time DESC LIMIT 1) ts1
            FULL OUTER JOIN 
            (SELECT * FROM token_snapshots WHERE supply IS NOT NULL AND holders IS NOT NULL ORDER BY time DESC LIMIT 1) ts2
            ON true
        )
        SELECT * FROM latest_metrics
        WHERE price_usd IS NOT NULL
           OR supply IS NOT NULL;
      `);

      console.log('Raw database response:', currentMetrics?.rows);

      if (!currentMetrics?.rows?.[0]) {
        console.log('No current data available in database');
        return 'No current data available';
      }

      const metrics = currentMetrics.rows[0];
      console.log('Parsed metrics:', metrics);

      if (question.toLowerCase().includes('current')) {
        if (question.toLowerCase().includes('price')) {
          return `$${Number(metrics.price_usd).toLocaleString()}`;
        } else if (question.toLowerCase().includes('volume')) {
          return `$${Number(metrics.period_volume).toLocaleString()}`;
        } else if (question.toLowerCase().includes('market cap')) {
          return `$${Number(metrics.marketcap_usd).toLocaleString()}`;
        } else if (question.toLowerCase().includes('holder')) {
          return metrics.holders?.toLocaleString() || '0';
        } else if (question.toLowerCase().includes('supply')) {
          return metrics.supply?.toLocaleString() || '0';
        }
      }

      // Handle genesis comparisons
      if (this.isGenesisQuestion(question)) {
        const genesisComparison = await datasource.query(`
          WITH current AS (
            SELECT * FROM token_snapshots 
            WHERE price_usd IS NOT NULL
            ORDER BY time DESC LIMIT 1
          ),
          genesis AS (
            SELECT * FROM token_snapshots 
            WHERE price_usd IS NOT NULL
            ORDER BY time ASC LIMIT 1
          )
          SELECT 
            ((c.price_usd - g.price_usd) / g.price_usd * 100)::numeric(10,2) as price_change_pct,
            ((c.marketcap_usd - g.marketcap_usd) / g.marketcap_usd * 100)::numeric(10,2) as mcap_change_pct,
            (c.holders - g.holders) as holder_change,
            ((c.supply - g.supply) / g.supply * 100)::numeric(10,2) as supply_change_pct,
            c.period_volume - g.period_volume as volume_change
          FROM current c
          CROSS JOIN genesis g;
        `);

        if (!genesisComparison?.rows?.[0]) {
          return 'No genesis comparison data available';
        }

        const changes = genesisComparison.rows[0];

        if (question.toLowerCase().includes('price')) {
          return `${changes.price_change_pct}%`;
        } else if (question.toLowerCase().includes('volume')) {
          return `$${changes.volume_change.toLocaleString()}`;
        } else if (question.toLowerCase().includes('market cap')) {
          return `${changes.mcap_change_pct}%`;
        } else if (question.toLowerCase().includes('holder')) {
          return changes.holder_change.toLocaleString();
        } else if (question.toLowerCase().includes('supply')) {
          return `${changes.supply_change_pct}%`;
        }
      }

      // Handle time-based queries
      const timeframeMinutes = this.extractTimeframe(question);
      if (await this.isPreGenesis(timeframeMinutes)) {
        return 'I was not born yet during that time period';
      }

      const intervalChanges = await datasource.query(`
        WITH current_metrics AS (
          SELECT * FROM token_snapshots
          WHERE price_usd IS NOT NULL
          ORDER BY time DESC LIMIT 1
        ),
        previous_metrics AS (
          SELECT * FROM token_snapshots
          WHERE price_usd IS NOT NULL
          AND time <= (SELECT time FROM current_metrics) - INTERVAL '${timeframeMinutes} minutes'
          ORDER BY time DESC LIMIT 1
        )
        SELECT 
          ((cm.price_usd - pm.price_usd) / pm.price_usd * 100)::numeric(10,2) as price_change_pct,
          ((cm.marketcap_usd - pm.marketcap_usd) / pm.marketcap_usd * 100)::numeric(10,2) as mcap_change_pct,
          (cm.holders - pm.holders) as holder_change,
          ((cm.supply - pm.supply) / pm.supply * 100)::numeric(10,2) as supply_change_pct,
          cm.period_volume - pm.period_volume as volume_change
        FROM current_metrics cm
        CROSS JOIN previous_metrics pm;
      `);

      if (!intervalChanges?.rows?.[0]) {
        return 'No data available for the specified timeframe';
      }

      const changes = intervalChanges.rows[0];

      if (question.toLowerCase().includes('price')) {
        return `${changes.price_change_pct}%`;
      } else if (question.toLowerCase().includes('volume')) {
        return `$${changes.volume_change.toLocaleString()}`;
      } else if (question.toLowerCase().includes('market cap')) {
        return `${changes.mcap_change_pct}%`;
      } else if (question.toLowerCase().includes('holder')) {
        return changes.holder_change.toLocaleString();
      } else if (question.toLowerCase().includes('supply')) {
        return `${changes.supply_change_pct}%`;
      }

      return 'Please ask about price, volume, market cap, holders, or supply changes.';

    } catch (error) {
      console.error('Error in ask():', error);
      throw error;
    }
  }

  async cleanup() {
    if (datasource.isInitialized) {
      await datasource.destroy();
      this.initialized = false;
    }
  }
}

export const animusLLM = new AnimusLLM(); 