export enum AnimusMood {
  EUPHORIA = "EUPHORIA",         // >900%
  GIGABULLISH = "GIGABULLISH",   // >100%
  BULLISH = "BULLISH",           // 50% to 100%
  COOKIN = "COOKIN",             // 20% to 50%
  OPTIMISTIC = "OPTIMISTIC",      // 0% to 20%
  THIS_IS_FINE = "THIS_IS_FINE",  // -10% to 0%
  WORRIED = "WORRIED",            // -25% to -10%
  PANIC = "PANIC",                // -50% to -25%
  MAX_COPE = "MAX_COPE",          // -80% to -50%
  ITS_OVER = "ITS_OVER"          // <-80%
}

export interface MoodState {
  mood: AnimusMood;
  priceChange: number;
  timestamp: Date;
  duration?: number;  // Time spent in this mood (minutes)
  context?: string;   // Additional market context
} 