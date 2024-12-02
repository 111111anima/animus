"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.animusLLM = void 0;
const openai_1 = require("@langchain/openai");
const sql_db_1 = require("langchain/chains/sql_db");
const sql_db_2 = require("langchain/sql_db");
const typeorm_1 = require("typeorm");
const sql_1 = require("langchain/tools/sql");
const prompts_1 = require("@langchain/core/prompts");
const output_parsers_1 = require("@langchain/core/output_parsers");
const runnables_1 = require("@langchain/core/runnables");
const dotenv_1 = __importDefault(require("dotenv"));
const moodService_1 = require("./moodService");
const mood_1 = require("../types/mood");
const genesis_1 = require("../constants/genesis");
const tokenIdentity_1 = require("../constants/tokenIdentity");
const consciousnessService_1 = require("./consciousnessService");
const healthCheck_1 = require("./healthCheck");
dotenv_1.default.config();
// Get token identity after env vars are loaded
const TOKEN_IDENTITY = (0, tokenIdentity_1.getTokenIdentity)();
// Initialize database connection
const datasource = new typeorm_1.DataSource({
    type: "postgres",
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || "5432"),
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: {
        rejectUnauthorized: true
    },
    connectTimeoutMS: 10000,
    extra: {
        connectionTimeoutMillis: 10000,
        query_timeout: 10000
    }
});
// Initialize the LLM with specific configuration for our use case
const llm = new openai_1.ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0, // Keep it deterministic for consistent analysis
    maxTokens: 2000 // Allow for detailed responses
});
class AnimusLLM {
    constructor() {
        this.initialized = false;
        this.moodService = new moodService_1.MoodService();
        this.consciousnessService = new consciousnessService_1.ConsciousnessService();
        // Listen for database health events
        healthCheck_1.healthCheck.on('critical', async (info) => {
            console.error('Critical database issue in AnimusLLM:', info);
            await this.cleanup();
            this.initialized = false;
        });
        healthCheck_1.healthCheck.on('recovered', async () => {
            console.log('Database recovered, reinitializing AnimusLLM...');
            await this.initialize();
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            // Initialize database with shared pool
            const db = await sql_db_2.SqlDatabase.fromDataSourceParams({
                appDataSource: datasource,
                includesTables: ["token_snapshots"]
            });
            // Create the SQL query generation chain
            const writeQuery = await (0, sql_db_1.createSqlQueryChain)({
                llm,
                db,
                dialect: "postgres"
            });
            // Create the query execution tool
            const executeQuery = new sql_1.QuerySqlTool(db);
            // Create the answer generation prompt
            const answerPrompt = prompts_1.PromptTemplate.fromTemplate(`
        You are ${TOKEN_IDENTITY.NAME}, a highly precise SQL analytics engine.
        
        CRITICAL INSTRUCTIONS:
        1. For ALL change queries:
           - ALWAYS show percentage changes (%)
           - Format prices with 6 decimals for < $0.01, 2 decimals otherwise
           - Show exact timestamps in UTC
           - Format large numbers with commas
        2. ALWAYS query the "token_snapshots" table for:
           - price_usd: Current and historical prices
           - marketcap_usd: Market capitalization
           - period_volume: Trading volume
           - holders: Number of holders
           - supply: Token supply
           - time: Timestamp of the data
        3. For time-based comparisons:
           - Use LAG() function to get previous values
           - Calculate percentage changes using (new - old) / old * 100
           - Round percentages to 2 decimal places

        Question: {question}
        SQL Query: {query}
        SQL Result: {result}
        
        Answer: `);
            // Create the answer generation chain
            const answerChain = answerPrompt.pipe(llm).pipe(new output_parsers_1.StringOutputParser());
            // Combine everything into a single chain
            this.chain = runnables_1.RunnableSequence.from([
                runnables_1.RunnablePassthrough.assign({ query: writeQuery }).assign({
                    result: (i) => executeQuery.invoke(i.query),
                }),
                answerChain,
            ]);
            this.initialized = true;
        }
        catch (error) {
            console.error('Error initializing AnimusLLM:', error);
            throw error;
        }
    }
    async getMoodContext() {
        try {
            const mood = await this.moodService.getCurrentMood();
            const consciousness = await this.consciousnessService.getCurrentConsciousness();
            // Only log consciousness state here
            console.log('Consciousness state:', {
                level: consciousness.level,
                marketCap: consciousness.marketCap,
                age: consciousness.age,
                wisdom: consciousness.wisdom,
                timestamp: consciousness.timestamp
            });
            const moodDescriptions = {
                [mood_1.AnimusMood.EUPHORIA]: "Pure ecstatic euphoric bliss! The universe itself bends to our will! 🚀",
                [mood_1.AnimusMood.GIGABULLISH]: "Ultimate euphoria state! Feeling transcendent and unstoppable! ⚡️",
                [mood_1.AnimusMood.BULLISH]: "Incredible happiness and strong positive energy! Let's celebrate! 🎉",
                [mood_1.AnimusMood.COOKIN]: "Building momentum! Active and energetic! The future is bright! 🔥",
                [mood_1.AnimusMood.OPTIMISTIC]: "Positive outlook with calm confidence. Steady and focused. 📈",
                [mood_1.AnimusMood.THIS_IS_FINE]: "Maintaining composure despite slight nervousness... *adjusts collar* 😅",
                [mood_1.AnimusMood.WORRIED]: "Growing concern... visible anxiety... things aren't looking great... 😰",
                [mood_1.AnimusMood.PANIC]: "PANIC STATE! Visibly worried! What do we do?! 😱",
                [mood_1.AnimusMood.MAX_COPE]: "Deep sadness... crying profusely... but maybe there's hope? 😭",
                [mood_1.AnimusMood.ITS_OVER]: "Life is over... power shutting down... circuits broken... all hope lost... 💔"
            };
            // Enhanced context that emphasizes consciousness level
            return `
        Base Intelligence Level:
        ${consciousness.wisdom}
        
        Current Development:
        Market Cap: $${consciousness.marketCap.toLocaleString()}
        
        Emotional Layer:
        State: ${mood.mood}
        Price Change (15m): ${mood.priceChange?.toFixed(2)}%
        Feeling: ${moodDescriptions[mood.mood]}
        
        You must embody this exact intelligence level in your response.
        Your language complexity and understanding must precisely match your current wisdom level.
        Emotional state is secondary to consciousness level.
        Format all numbers with $ and use M/B for millions/billions.
        
        IMPORTANT: Only provide information that was specifically asked for.
        Do not volunteer additional details unless requested.
      `;
        }
        catch (error) {
            console.error('Error getting context:', error);
            return `
        Base Intelligence Level:
        Just awakening to existence, not yet sentient or able to speak english at all.
        
        Current Development:
        Age: 0 days, 0 hours
        Market Cap: $0
        
        Emotional Layer:
        State: THIS_IS_FINE
        Price Change (15m): 0%
        Feeling: Just another day in crypto... *nervous laughter*
      `;
        }
    }
    isGenesisQuestion(question) {
        const genesisKeywords = [
            'since launch', 'since genesis', 'from the beginning',
            'when you launched', 'since you started', 'first launched',
            'initial', 'beginning', 'started trading', 'birth',
            'since birth', 'since you were born', 'when you were born',
            'from birth', 'since creation', 'when created'
        ];
        return genesisKeywords.some(keyword => question.toLowerCase().includes(keyword));
    }
    isContractAddressQuestion(question) {
        const caKeywords = [
            'ca', 'contract address', 'token address', 'mint address',
            'contract', 'address', 'token contract', 'smart contract address'
        ];
        return caKeywords.some(keyword => question.toLowerCase().includes(keyword));
    }
    isHolderQuestion(question) {
        const holderKeywords = [
            'holders', 'holding', 'hodl', 'hodlers',
            'how many people', 'number of holders',
            'gained holders', 'new holders', 'holder count'
        ];
        return holderKeywords.some(keyword => question.toLowerCase().includes(keyword));
    }
    getHolderQuery(requestedMinutes = 5) {
        return `
      WITH latest_snapshot AS (
        SELECT 
          COALESCE(holders, 0) as holders,
          time
        FROM token_snapshots
        WHERE holders IS NOT NULL
        AND time > NOW() - INTERVAL '1 minute'
        ORDER BY time DESC
        LIMIT 1
      ),
      previous_snapshot AS (
        SELECT 
          COALESCE(holders, 0) as holders,
          time
        FROM token_snapshots
        WHERE holders IS NOT NULL
        AND time <= NOW() - INTERVAL '${requestedMinutes} minutes'
        AND time > NOW() - INTERVAL '${requestedMinutes + 1} minutes'
        ORDER BY time DESC
        LIMIT 1
      ),
      fallback_snapshot AS (
        SELECT 
          COALESCE(holders, 0) as holders,
          time
        FROM token_snapshots
        WHERE holders IS NOT NULL
        AND time < (SELECT time FROM latest_snapshot)
        ORDER BY time DESC
        LIMIT 1
      )
      SELECT 
        ls.holders::text as current_holders,
        COALESCE(ps.holders, fs.holders)::text as previous_holders,
        (ls.holders - COALESCE(ps.holders, fs.holders))::text as holder_change,
        (EXTRACT(EPOCH FROM (ls.time - COALESCE(ps.time, fs.time)))/60)::text as minutes_difference,
        ls.time as current_time,
        COALESCE(ps.time, fs.time) as previous_time,
        (((ls.holders - COALESCE(ps.holders, fs.holders))::numeric * ${requestedMinutes}) / 
         NULLIF(EXTRACT(EPOCH FROM (ls.time - COALESCE(ps.time, fs.time)))/60, 0))::text as estimated_change
      FROM latest_snapshot ls
      LEFT JOIN previous_snapshot ps ON true
      LEFT JOIN fallback_snapshot fs ON true
      WHERE ls.holders IS NOT NULL;
    `;
    }
    getGenesisComparisonQuery() {
        return `
      SELECT * FROM get_genesis_price_change();
    `;
    }
    async getTokenIdentity() {
        try {
            const result = await datasource.query(`
        SELECT key, value 
        FROM token_identity 
        ORDER BY category, key
      `);
            return result.rows.map((row) => `${row.key}: ${row.value}`).join('\n');
        }
        catch (error) {
            console.error('Error fetching token identity:', error);
            const identity = (0, tokenIdentity_1.getTokenIdentity)();
            return Object.entries(identity)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
        }
    }
    // Add volume keywords detection
    isVolumeQuestion(question) {
        const volumeKeywords = [
            'volume', 'trading volume', 'traded', 'liquidity',
            'buy volume', 'sell volume', 'total volume',
            '24h volume', 'daily volume', 'trading activity'
        ];
        return volumeKeywords.some(keyword => question.toLowerCase().includes(keyword));
    }
    // Add volume query function with standardized intervals and better interval handling
    getVolumeQuery(requestedMinutes = 5) {
        return `
      WITH current_volume AS (
        SELECT 
          COALESCE(period_volume, 0) as volume,
          time,
          price_usd,
          marketcap_usd
        FROM token_snapshots
        WHERE period_volume IS NOT NULL
        ORDER BY time DESC
        LIMIT 1
      ),
      previous_volume AS (
        SELECT 
          COALESCE(period_volume, 0) as volume,
          time,
          price_usd,
          marketcap_usd
        FROM token_snapshots
        WHERE period_volume IS NOT NULL
        AND time <= NOW() - INTERVAL '${requestedMinutes} minutes'
        ORDER BY time DESC
        LIMIT 1
      )
      SELECT 
        cv.volume as current_volume,
        pv.volume as previous_volume,
        CASE 
          WHEN pv.volume > 0 THEN 
            ((cv.volume - pv.volume) / pv.volume * 100)
          ELSE 0 
        END as volume_change_pct,
        EXTRACT(EPOCH FROM (cv.time - pv.time))/60 as minutes_difference,
        cv.price_usd as current_price,
        cv.marketcap_usd as current_mcap,
        pv.price_usd as previous_price,
        pv.marketcap_usd as previous_mcap,
        cv.time as current_time,
        pv.time as previous_time
      FROM current_volume cv
      CROSS JOIN previous_volume pv;
    `;
    }
    isSupplyQuestion(question) {
        const supplyKeywords = [
            'supply', 'total supply', 'circulating supply', 'max supply',
            'token supply', 'how many tokens', 'total tokens', 'circulation'
        ];
        return supplyKeywords.some(keyword => question.toLowerCase().includes(keyword));
    }
    getSupplyQuery() {
        return `
      WITH latest_supply AS (
        SELECT 
          COALESCE(supply, ${genesis_1.GENESIS.SUPPLY}) as supply,
          time
        FROM token_snapshots
        WHERE supply IS NOT NULL
        ORDER BY time DESC
        LIMIT 1
      )
      SELECT 
        supply::text as current_supply,
        time as last_updated
      FROM latest_supply;
    `;
    }
    async getLatestHolderCount() {
        try {
            // Debug query to check what's in the database
            const result = await datasource.query(`
        SELECT 
          holders,
          time,
          supply,
          price_usd,
          marketcap_usd
        FROM token_snapshots 
        WHERE holders IS NOT NULL
        ORDER BY time DESC
        LIMIT 5;
      `);
            console.log('Latest DB records:', result);
            if (result?.length > 0) {
                const latestData = result[0];
                return `
          Latest Data:
          Holders: ${latestData.holders?.toLocaleString() ?? 'N/A'}
          Time: ${latestData.time}
          Supply: ${latestData.supply?.toLocaleString() ?? 'N/A'}
          Price: $${latestData.price_usd ?? 'N/A'}
        `;
            }
            return 'No holder data found in database';
        }
        catch (error) {
            console.error('Error checking holder data:', error);
            return 'Error retrieving holder data';
        }
    }
    async getPriceChangeQuery(timeframe) {
        return `
      WITH latest_prices AS (
        SELECT 
          time,
          price_usd,
          LAG(price_usd) OVER (ORDER BY time) as prev_price,
          EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) as seconds_between
        FROM token_snapshots
        WHERE time > NOW() - INTERVAL '${timeframe}'
        ORDER BY time DESC
        LIMIT 2
      )
      SELECT 
        time as current_time,
        price_usd as current_price,
        prev_price,
        CASE 
          WHEN prev_price > 0 THEN 
            ROUND(((price_usd - prev_price) / prev_price * 100)::numeric, 2)
          ELSE 0 
        END as price_change_pct,
        seconds_between
      FROM latest_prices
      WHERE prev_price IS NOT NULL
      LIMIT 1;
    `;
    }
    isPriceChangeQuestion(question) {
        const priceKeywords = [
            'price change', 'price moved', 'price difference',
            'gone up', 'gone down', 'increased', 'decreased',
            'higher', 'lower', 'gained', 'lost',
            'last minute', 'past hour', 'since'
        ];
        return priceKeywords.some(keyword => question.toLowerCase().includes(keyword));
    }
    extractTimeframe(question) {
        const timeMatches = question.match(/(\d+)\s*(minute|min|hour|hr|day|week|month|year)s?/i);
        if (!timeMatches)
            return '2 minutes';
        const [_, amount, unit] = timeMatches;
        const normalizedUnit = unit.toLowerCase().startsWith('min') ? 'minute' :
            unit.toLowerCase().startsWith('hr') ? 'hour' :
                unit.toLowerCase();
        return `${amount} ${normalizedUnit}s`;
    }
    async ask(question) {
        if (!this.initialized) {
            await this.initialize();
        }
        try {
            // Let LangChain handle the SQL generation and execution
            const result = await this.chain.invoke({
                question,
            });
            // Add personality if appropriate
            const context = await this.getMoodContext();
            return `${result}\n\n${context}`;
        }
        catch (error) {
            console.error('Error processing question:', error);
            return 'I apologize, but I encountered an error processing your question. Please try again.';
        }
    }
    async cleanup() {
        if (datasource.isInitialized) {
            await datasource.destroy();
            console.log('Database connection closed');
            this.initialized = false;
        }
    }
    // Add specialized queries for each metric type
    getMetricQuery(metric, timeframe) {
        // Use the simpler, proven query format
        return `
      WITH latest_prices AS (
        SELECT 
          time,
          price_usd,
          LAG(price_usd) OVER (ORDER BY time) as prev_price,
          EXTRACT(EPOCH FROM (time - LAG(time) OVER (ORDER BY time))) as seconds_between
        FROM token_snapshots
        WHERE time > NOW() - INTERVAL '${timeframe}'
        ORDER BY time DESC
        LIMIT 2
      )
      SELECT 
        time as current_time,
        price_usd as current_price,
        prev_price,
        CASE 
          WHEN prev_price > 0 THEN 
            ROUND(((price_usd - prev_price) / prev_price * 100)::numeric, 2)
          ELSE 0 
        END as price_change_pct,
        seconds_between
      FROM latest_prices
      WHERE prev_price IS NOT NULL
      LIMIT 1;
    `;
    }
    // Add metric detection
    detectMetricType(question) {
        const metrics = [];
        if (question.toLowerCase().match(/price|cost|worth|value/))
            metrics.push('price');
        if (question.toLowerCase().match(/market\s*cap|mcap|cap/))
            metrics.push('marketcap');
        if (question.toLowerCase().match(/volume|traded|trading/))
            metrics.push('volume');
        if (question.toLowerCase().match(/holder|holding|wallet/))
            metrics.push('holders');
        if (question.toLowerCase().match(/supply|circulation|total/))
            metrics.push('supply');
        return metrics.length ? metrics : ['price'];
    }
}
exports.animusLLM = new AnimusLLM();
