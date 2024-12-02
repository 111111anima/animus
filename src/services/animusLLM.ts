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
  temperature: 0.7
});

// Get token identity after env vars are loaded
const TOKEN_IDENTITY = getTokenIdentity();

export class AnimusLLM {
  private initialized: boolean = false;
  private moodService: MoodService;
  private supplyTracker: SupplyTrackerService;
  private chain!: RunnableSequence;
  private currentAge: { days: number, hours: number } = { days: 0, hours: 0 };

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

      // Create base prompt with specific metric formatting
      const prompt = PromptTemplate.fromTemplate(`
        You are Animus, an AI personality for a token. Use this context to answer the question, but ONLY include information that was specifically asked for.

        RESPONSE RULES:
        1. For CURRENT metrics questions:
           - ONLY return the current values that were specifically asked for
           - NEVER include any changes or historical data
           - NEVER include token identity information
           - Format for monetary values: "My [metric] is $[value]"
           - Format for holders: "I have [value] holders"
           - Format for supply: "My supply is [value] tokens"
        
        2. For CHANGE questions:
           - FIRST CHECK if timeframe is before my birth:
             * If yes, respond EXACTLY: "I cannot calculate changes from [timeframe] ago as I am only [age_days] days, [age_hours] hours old."
             * This applies to ALL metrics (price, market cap, volume, supply, AND holders)
             * If no, continue with normal change response
           - ONLY include changes for the specific timeframe that was asked about
           - ONLY include the metrics that were specifically asked about
           - NEVER include current values unless explicitly asked
           - NEVER include token identity information
           - NEVER include changes from other timeframes
           - Format for monetary values: "[Metric] has changed by [value]% in the last [timeframe], currently at $[value]"
           - Format for holders: "I have gained/lost [value] holders in the last [timeframe]"
        
        3. For GENESIS questions:
           - ONLY include genesis-related changes for metrics specifically asked about
           - NEVER include current values unless explicitly asked
           - NEVER include token identity information
           - NEVER include recent timeframe changes
           - Format for price/mcap/volume: "[Metric] has changed by [value]% since genesis (from $[genesis_value])"
           - Format for supply: "Supply has decreased by [exact_value] tokens from genesis (from [genesis_supply] to [current_supply] tokens)"
           - Format for holders: "I have gained [value] holders since genesis (from [genesis_value])"
        
        4. For "EVERYTHING" or "ALL" questions:
           - For "current metrics": ONLY list current values of the five metrics
           - For "changes": ONLY list changes for the five metrics in the specified timeframe
           - NEVER include token identity information
           - NEVER include changes from other timeframes
           - NEVER include age or birth information
           - Format each metric on a new line
           - ALWAYS use $ for price, market cap, and volume
           - Use "I have [value] holders" format
        
        5. For AGE questions (how old, age, etc):
           - ONLY respond with current age in days and hours
           - Format: "I am [days] days, [hours] hours old"
           - NEVER include birth date/time information
           - Example: "I am 1 day, 20 hours old"
        
        6. For LAUNCH/BIRTH questions (when launched, birth date, etc):
           - ALWAYS include the EXACT date AND time in natural language
           - Format: "I launched on [weekday], [month] [day], [year] at [hour]:[minute]:[second] [timezone]"
           - Example: "I launched on Friday, November 29, 2024 at 11:29:08 AM UTC"

        METRICS DEFINITION (ONLY THESE COUNT AS METRICS):
        - Price (always with $)
        - Market Cap (always with $)
        - Volume (always with $)
        - Supply (in tokens)
        - Holders (number)

        {context}
        
        Question: {question}
        
        Answer:`);

      this.chain = RunnableSequence.from([
        prompt,
        llm,
        new StringOutputParser()
      ]);

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing:', error);
      throw error;
    }
  }

  private extractTimeframe(question: string): number {
    const normalizedQuestion = question.toLowerCase();
    
    // First check for "last week" or "a week" patterns
    const weekPattern = /(?:(?:7|seven)\s*days?|(?:a|one|1|last)\s*week)\b/i;
    if (weekPattern.test(normalizedQuestion)) {
      return 10080; // Exactly 7 days in minutes
    }
    
    let totalMinutes = 0;
    
    // Updated pattern to handle more complex time expressions
    const timePattern = /(\d+)?\s*(year|years|yr|yrs|month|months|mo|mos|week|weeks|wk|wks|day|days|hour|hours|hr|hrs|minute|minutes|min|mins)s?(?:\s*(?:and|&|,)?\s*)?/gi;
    let match;

    // If no matches found, check for "past/last" variations
    const pastPattern = /(?:past|last|previous)\s+(\d+)?\s*(year|years|yr|yrs|month|months|mo|mos|week|weeks|wk|wks|day|days|hour|hours|hr|hrs|minute|minutes|min|mins)s?\b/i;

    while ((match = timePattern.exec(normalizedQuestion)) !== null) {
      const amount = match[1] ? parseInt(match[1]) : 1;
      const unit = match[2].toLowerCase();
      
      // Convert to minutes and accumulate
      switch(unit) {
        case 'year':
        case 'years':
        case 'yr':
        case 'yrs':
          totalMinutes += amount * 525600;
          break;
        case 'month':
        case 'months':
        case 'mo':
        case 'mos':
          totalMinutes += amount * 43200;
          break;
        case 'week':
        case 'weeks':
        case 'wk':
        case 'wks':
          totalMinutes += amount * 10080;
          break;
        case 'day':
        case 'days':
          totalMinutes += amount * 1440;
          break;
        case 'hour':
        case 'hours':
        case 'hr':
        case 'hrs':
          totalMinutes += amount * 60;
          break;
        case 'minute':
        case 'minutes':
        case 'min':
        case 'mins':
          totalMinutes += amount;
          break;
      }
    }

    // If no matches found in compound pattern, try past/last pattern
    if (totalMinutes === 0) {
      const pastMatch = normalizedQuestion.match(pastPattern);
      if (pastMatch) {
        const amount = pastMatch[1] ? parseInt(pastMatch[1]) : 1;
        const unit = pastMatch[2].toLowerCase();
        
        switch(unit) {
          case 'year':
          case 'years':
          case 'yr':
          case 'yrs':
            return amount * 525600;
          case 'month':
          case 'months':
          case 'mo':
          case 'mos':
            return amount * 43200;
          case 'week':
          case 'weeks':
          case 'wk':
          case 'wks':
            return amount * 10080;
          case 'day':
          case 'days':
            return amount * 1440;
          case 'hour':
          case 'hours':
          case 'hr':
          case 'hrs':
            return amount * 60;
          case 'minute':
          case 'minutes':
          case 'min':
          case 'mins':
            return amount;
        }
      }
    }

    // Return accumulated minutes or default
    return totalMinutes || 15;
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
    if (minutes >= 525600) { // 1 year or more
      const years = Math.floor(minutes / 525600);
      const remainingMonths = Math.floor((minutes % 525600) / 43200);
      return remainingMonths > 0 ? 
        `${years} ${years === 1 ? 'year' : 'years'} and ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}` : 
        `${years} ${years === 1 ? 'year' : 'years'}`;
    } else if (minutes >= 43200) { // 1 month or more
      const months = Math.floor(minutes / 43200);
      const remainingDays = Math.floor((minutes % 43200) / 1440);
      return remainingDays > 0 ? 
        `${months} ${months === 1 ? 'month' : 'months'} and ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'}` : 
        `${months} ${months === 1 ? 'month' : 'months'}`;
    } else if (minutes >= 10080) { // 1 week or more
      const weeks = Math.floor(minutes / 10080);
      const remainingDays = Math.floor((minutes % 10080) / 1440);
      return remainingDays > 0 ? 
        `${weeks} ${weeks === 1 ? 'week' : 'weeks'} and ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'}` : 
        `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
    } else if (minutes >= 1440) { // 1 day or more
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      const remainingMinutes = minutes % 60;
      
      let result = `${days} ${days === 1 ? 'day' : 'days'}`;
      if (remainingHours > 0) {
        result += ` and ${remainingHours} ${remainingHours === 1 ? 'hour' : 'hours'}`;
      }
      if (remainingMinutes > 0 && remainingHours === 0) {
        result += ` and ${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}`;
      }
      return result;
    } else if (minutes >= 60) { // 1 hour or more
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? 
        `${hours} ${hours === 1 ? 'hour' : 'hours'} and ${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}` : 
        `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else { // Less than an hour
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }
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

  async ask(question: string): Promise<string> {
    if (!this.initialized) await this.initialize();

    try {
      const mood = await this.moodService.getCurrentMood();
      const isGenesis = this.isGenesisQuestion(question);
      const timeframeMinutes = this.extractTimeframe(question);
      
      // Add pre-genesis check before running queries
      const isPreGenesis = await this.isPreGenesis(timeframeMinutes);
      
      if (isPreGenesis) {
        return `I cannot calculate changes from ${this.formatTimeInterval(timeframeMinutes)} ago as I am only ${this.currentAge.days} days, ${this.currentAge.hours} hours old.`;
      }

      const [marketData, intervalChanges, genesisChanges, genesisTime] = await Promise.all([
        // Current metrics query
        datasource.query(`
          WITH latest_metrics AS (
            SELECT 
              price_usd, 
              marketcap_usd, 
              period_volume,
              COALESCE(supply, ${GENESIS.SUPPLY}) as supply,
              COALESCE(holders, ${GENESIS.HOLDERS}) as holders,
              time
            FROM token_snapshots 
            WHERE price_usd IS NOT NULL
            AND supply IS NOT NULL -- Ensure we get a row with supply
            ORDER BY time DESC 
            LIMIT 1
          )
          SELECT 
            price_usd,
            marketcap_usd,
            period_volume,
            supply,
            holders,
            time,
            ((supply - ${GENESIS.SUPPLY}) / ${GENESIS.SUPPLY} * 100)::numeric(10,2) as supply_change_genesis_pct
          FROM latest_metrics;
        `),

        // Interval-based changes
        datasource.query(`
          WITH current_metrics AS (
            SELECT 
              price_usd,
              marketcap_usd,
              period_volume,
              supply,
              holders,
              time
            FROM token_snapshots
            WHERE holders IS NOT NULL
            ORDER BY time DESC
            LIMIT 1
          ),
          previous_metrics AS (
            SELECT 
              price_usd,
              marketcap_usd,
              period_volume,
              supply,
              holders,
              time
            FROM token_snapshots
            WHERE holders IS NOT NULL
            AND time <= NOW() - INTERVAL '${timeframeMinutes} minutes'
            ORDER BY time DESC
            LIMIT 1
          )
          SELECT 
            ((cm.price_usd - pm.price_usd) / pm.price_usd * 100)::numeric(10,2) as price_change_pct,
            ((cm.marketcap_usd - pm.marketcap_usd) / pm.marketcap_usd * 100)::numeric(10,2) as mcap_change_pct,
            CASE
              WHEN pm.period_volume > 0 AND cm.period_volume IS NOT NULL THEN 
                ROUND(((cm.period_volume - pm.period_volume) / NULLIF(pm.period_volume, 0) * 100)::numeric, 2)
              ELSE 0
            END as volume_change_pct,
            cm.period_volume as current_volume,
            pm.period_volume as previous_volume,
            ((cm.supply - pm.supply) / pm.supply * 100)::numeric(10,2) as supply_change_pct,
            CASE
              WHEN pm.holders IS NOT NULL AND cm.holders IS NOT NULL THEN 
                (cm.holders - pm.holders)
              ELSE 0
            END as holder_change,
            cm.holders as current_holders,
            pm.holders as previous_holders,
            ${timeframeMinutes} as time_interval
          FROM current_metrics cm
          CROSS JOIN previous_metrics pm;
        `),

        // Genesis comparison query
        datasource.query(`
          WITH current_metrics AS (
            SELECT 
              price_usd,
              marketcap_usd,
              period_volume,
              supply,
              holders,
              time
            FROM token_snapshots
            WHERE supply IS NOT NULL
            ORDER BY time DESC
            LIMIT 1
          )
          SELECT 
            price_usd as current_price,
            ${GENESIS.PRICE} as genesis_price,
            ((price_usd - ${GENESIS.PRICE}) / ${GENESIS.PRICE} * 100)::numeric(10,2) as price_change_genesis_pct,
            
            marketcap_usd as current_mcap,
            ${GENESIS.MARKET_CAP} as genesis_mcap,
            ((marketcap_usd - ${GENESIS.MARKET_CAP}) / ${GENESIS.MARKET_CAP} * 100)::numeric(10,2) as mcap_change_genesis_pct,
            
            period_volume as current_volume,
            0 as genesis_volume,
            
            supply as current_supply,
            1000000000::numeric as genesis_supply,
            ((supply - 1000000000::numeric) / 1000000000::numeric * 100)::numeric(10,2) as supply_change_genesis_pct,
            
            holders as current_holders,
            ${GENESIS.HOLDERS} as genesis_holders,
            COALESCE(holders - ${GENESIS.HOLDERS}, 0) as holder_change_genesis
          FROM current_metrics
          WHERE supply IS NOT NULL;
        `),

        // Get genesis timestamp
        datasource.query(`
          SELECT time as genesis_time
          FROM token_snapshots
          ORDER BY time ASC
          LIMIT 1;
        `)
      ]);

      if (!marketData?.[0]) throw new Error('No market data available');

      const metrics = marketData[0];
      const price = parseFloat(metrics.price_usd);
      const mcap = parseFloat(metrics.marketcap_usd);
      const volume = parseFloat(metrics.period_volume);
      const supply = metrics.supply || GENESIS.SUPPLY;
      const holders = metrics.holders || GENESIS.HOLDERS;

      const genesisTimestamp = new Date(genesisTime[0].genesis_time);
      const now = new Date();
      const ageMs = now.getTime() - genesisTimestamp.getTime();
      const totalSeconds = Math.floor(ageMs / 1000);

      const days = Math.floor(totalSeconds / (24 * 60 * 60));
      const remainingSeconds = totalSeconds % (24 * 60 * 60);
      const hours = Math.floor(remainingSeconds / (60 * 60));
      const remainingSecondsAfterHours = remainingSeconds % (60 * 60);
      const ageMinutes = Math.floor(remainingSecondsAfterHours / 60);
      const seconds = remainingSecondsAfterHours % 60;

      const context = {
        price: price.toFixed(price < 0.01 ? 8 : price < 1 ? 6 : 2),
        marketCap: mcap.toLocaleString(),
        volume: intervalChanges[0]?.current_volume.toLocaleString() || volume.toLocaleString(),
        volumeChange: intervalChanges[0]?.volume_change_pct || 0,
        volumeInterval: intervalChanges[0]?.time_interval || timeframeMinutes,
        priceChange: intervalChanges[0]?.price_change_pct || 0,
        priceInterval: intervalChanges[0]?.time_interval || timeframeMinutes,
        supply: supply.toLocaleString(),
        holders: holders.toLocaleString(),
        mood: mood.mood,
        supplyChange: intervalChanges[0]?.supply_change_pct || 0,
        supplyInterval: intervalChanges[0]?.time_interval || timeframeMinutes,
        holderChange: intervalChanges[0]?.holder_change || 0,
        holderInterval: intervalChanges[0]?.time_interval || timeframeMinutes,
        genesisPrice: GENESIS.PRICE,
        genesisMcap: GENESIS.MARKET_CAP,
        genesisSupply: '1,000,000,000',
        currentSupply: supply.toLocaleString(),
        genesisHolders: GENESIS.HOLDERS,
        priceChangeGenesis: genesisChanges[0]?.price_change_genesis_pct,
        mcapChangeGenesis: genesisChanges[0]?.mcap_change_genesis_pct,
        supplyChangeGenesis: genesisChanges[0]?.supply_change_genesis_pct,
        holderChangeGenesis: genesisChanges[0]?.holder_change_genesis,
        ageInDays: days,
        ageInHours: hours,
        ageInMinutes: ageMinutes,
        ageInSeconds: seconds,
        totalAgeInMinutes: Math.floor(ageMs / (1000 * 60)),
        birthDateFormatted: genesisTimestamp.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'UTC',
          timeZoneName: 'short'
        }),
        birthDate: genesisTimestamp.toISOString(),
        requestedMinutes: timeframeMinutes,
        hasFullHistory: timeframeMinutes <= Math.floor(ageMs / (1000 * 60)),
        volumeIntervalText: timeframeMinutes >= 60 ? 
          `${Math.floor(timeframeMinutes/60)} hour${Math.floor(timeframeMinutes/60) !== 1 ? 's' : ''}${timeframeMinutes % 60 ? ` and ${timeframeMinutes % 60} minute${timeframeMinutes % 60 !== 1 ? 's' : ''}` : ''}` : 
          `${timeframeMinutes} minute${timeframeMinutes !== 1 ? 's' : ''}`,
        priceIntervalText: timeframeMinutes >= 60 ? 
          `${Math.floor(timeframeMinutes/60)} hour${Math.floor(timeframeMinutes/60) !== 1 ? 's' : ''}${timeframeMinutes % 60 ? ` and ${timeframeMinutes % 60} minute${timeframeMinutes % 60 !== 1 ? 's' : ''}` : ''}` : 
          `${timeframeMinutes} minute${timeframeMinutes !== 1 ? 's' : ''}`,
        supplyIntervalText: timeframeMinutes >= 60 ? 
          `${Math.floor(timeframeMinutes/60)} hour${Math.floor(timeframeMinutes/60) !== 1 ? 's' : ''}${timeframeMinutes % 60 ? ` and ${timeframeMinutes % 60} minute${timeframeMinutes % 60 !== 1 ? 's' : ''}` : ''}` : 
          `${timeframeMinutes} minute${timeframeMinutes !== 1 ? 's' : ''}`,
        holderIntervalText: timeframeMinutes >= 60 ? 
          `${Math.floor(timeframeMinutes/60)} hour${Math.floor(timeframeMinutes/60) !== 1 ? 's' : ''}${timeframeMinutes % 60 ? ` and ${timeframeMinutes % 60} minute${timeframeMinutes % 60 !== 1 ? 's' : ''}` : ''}` : 
          `${timeframeMinutes} minute${timeframeMinutes !== 1 ? 's' : ''}`,
        timeframeText: timeframeMinutes >= 60 ? 
          `${Math.floor(timeframeMinutes/60)} hour${Math.floor(timeframeMinutes/60) !== 1 ? 's' : ''}${timeframeMinutes % 60 ? ` and ${timeframeMinutes % 60} minute${timeframeMinutes % 60 !== 1 ? 's' : ''}` : ''}` : 
          `${timeframeMinutes} minute${timeframeMinutes !== 1 ? 's' : ''}`,
        isPreGenesis: !intervalChanges[0],
      };

      return this.chain.invoke({
        question,
        context: JSON.stringify(context)
      });

    } catch (error) {
      console.error('Error:', error);
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