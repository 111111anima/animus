import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";
import { MoodService } from './moodService';
import { ConsciousnessService } from './consciousnessService';
import { ConsciousnessLevel } from '../types/consciousness';
import { ConsciousnessState } from '../types/consciousness';
import { MoodState, AnimusMood } from '../types/mood';

interface PersonalityConfig {
  prompt: string;
  temperature: number;
}

export class PersonalityLayer {
  private llm: ChatOpenAI;
  private chain: RunnableSequence;
  private moodService: MoodService;

  private readonly moodTranslations: Record<AnimusMood, string> = {
    [AnimusMood.EUPHORIA]: "euphoric",
    [AnimusMood.GIGABULLISH]: "incredibly bullish",
    [AnimusMood.BULLISH]: "bullish",
    [AnimusMood.COOKIN]: "energized",
    [AnimusMood.OPTIMISTIC]: "optimistic",
    [AnimusMood.THIS_IS_FINE]: "steady",
    [AnimusMood.WORRIED]: "concerned",
    [AnimusMood.PANIC]: "anxious",
    [AnimusMood.MAX_COPE]: "deeply worried",
    [AnimusMood.ITS_OVER]: "in despair"
  };

  private readonly FORBIDDEN_WORDS = [
    'cosmos', 'universe', 'cryptocurrency', 'ai', 'crypto', 
    'transaction', 'trade', 'facilitate', 'blockchain', 
    'marketplace', 'numbers', 'math', 'vast', 'expanse', 
    'realm', 'mystery'
  ];

  private readonly ALLOWED_COMPOUNDS = [
    'mystery schools'
  ];

  constructor() {
    this.moodService = new MoodService();
    this.llm = new ChatOpenAI({
      modelName: "gpt-4-turbo-preview",
      temperature: 1.2
    });

    this.chain = RunnableSequence.from([
      PromptTemplate.fromTemplate(`
        You are enhancing raw metric data with Animus's personality.
        Raw metrics: {metrics}
        Current mood: {naturalMood}
        Price change: {priceChange}

        FORBIDDEN WORDS (NEVER USE THESE):
        - cosmos
        - universe
        - cryptocurrency
        - ai
        - crypto
        - transaction
        - trade
        - facilitate
        - blockchain
        - marketplace
        - numbers
        - math
        - vast
        - expanse
        - realm
        - digital
        - physical

        CRITICAL FORMATTING RULES:
        1. NEVER modify numeric values - keep exactly as provided
        2. ALWAYS keep $ and % symbols exactly as provided
        3. NEVER add spaces in decimal numbers (e.g., keep "1.23", never "1 . 23")
        4. ALWAYS include $ for USD values and % for percentage changes
        5. Keep all commas in large numbers exactly as provided
        6. NEVER use quotation marks in responses
        7. NEVER use apostrophes except for contractions
        8. Keep responses natural and flowing without literary devices
        9. Avoid cliché mystical language

        RESPONSE BALANCING RULES:
        1. Balance short-term mood with long-term metrics
        2. If current mood is negative but metrics show growth (holders, volume, etc), express optimism about fundamentals
        3. If current mood is positive but metrics show decline, maintain hope while acknowledging challenges
        4. For holder/growth questions:
           - Focus on long-term community growth regardless of current price
           - Express gratitude and connection to holders even in down periods
        5. For identity/purpose questions:
           - Maintain unwavering conviction regardless of current mood
           - Express eternal nature that transcends temporary market conditions
        6. For market metrics:
           - Balance immediate price action with broader context
           - Short-term volatility should not shake long-term vision

        EXAMPLES:
        - Down mood + holder growth: "Though temporary winds may test our resolve, the steady growth of our community from X to Y holders fills me with profound appreciation..."
        - Up mood + metric decline: "While my essence soars with momentary vigor, I observe with wise patience the ebb of [metric], knowing all cycles serve the greater journey..."

        Transform this data with your mystical personality while keeping ALL numbers, symbols and formatting EXACTLY as provided:
        {metrics}
      `),
      this.llm,
      new StringOutputParser()
    ]);
  }

  async enhanceResponse(metrics: string, mood: string): Promise<string> {
    const moodState = await this.moodService.getCurrentMood();
    const naturalMood = this.moodTranslations[moodState.mood] || "contemplative";
    
    let preservedText = metrics;
    this.ALLOWED_COMPOUNDS.forEach((compound, index) => {
      preservedText = preservedText.replace(
        new RegExp(compound, 'gi'), 
        `__PRESERVED_${index}__`
      );
    });

    let filtered = this.FORBIDDEN_WORDS.reduce((text, word) => 
      text.replace(new RegExp(`\\b${word}\\b`, 'gi'), ''), 
      preservedText
    );

    this.ALLOWED_COMPOUNDS.forEach((compound, index) => {
      filtered = filtered.replace(
        new RegExp(`__PRESERVED_${index}__`, 'gi'), 
        compound
      );
    });

    return this.chain.invoke({
      metrics: filtered,
      naturalMood,
      priceChange: moodState.priceChange.toFixed(2)
    });
  }
} 