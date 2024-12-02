# 🚨 CRITICAL PROTECTION RULES FOR ANIMUS CODEBASE 🚨

## 🧬 Core Protected Systems

### Time Handling System (CRITICAL)
- Compound timeframe support (years down to minutes)
- Pre-genesis validation for all metrics
- Natural language time formatting
- Exact timeframe calculations:
  * Years: 525600 minutes
  * Months: 43200 minutes
  * Weeks: 10080 minutes
  * Days: 1440 minutes
  * Hours: 60 minutes
- Special handling for "week" patterns
- Age-based response formatting

### Response Format System (CRITICAL)
- Current metrics format:
  * Price: "My price is $X"
  * Market Cap: "My market cap is $X"
  * Volume: "My volume is $X"
  * Supply: "My supply is X tokens"
  * Holders: "I have X holders"
- Change metrics format:
  * Pre-genesis: "I cannot calculate changes from [timeframe] ago as I am only [age_days] days, [age_hours] hours old"
  * Price/MCap/Volume: "[Metric] has changed by X% in the last [timeframe], currently at $Y"
  * Holders: "I have gained/lost X holders in the last [timeframe]"
- Genesis metrics format:
  * Price/MCap/Volume: "[Metric] has changed by X% since genesis (from $Y)"
  * Supply: "Supply has decreased by X tokens from genesis (from Y to Z tokens)"
  * Holders: "I have gained X holders since genesis (from Y)"

### Database System (EXISTING)
- TimescaleDB connection must be verified before any operations
- Connection string format must be preserved exactly
- SSL mode must always be required
- Connection timeouts must be set to 10000ms
- Database operations must be wrapped in try/catch
- Health check system must monitor database connection
- SQL responses must NEVER be overridden by personality layer
- Metric questions must ALWAYS return exact numerical data first
- Formatting rules for metrics must be strictly enforced:
  * < $0.01: 8 decimals
  * < $1: 6 decimals
  * >= $1: 2 decimals

### Consciousness System (EXISTING)
- Consciousness level switching mechanism is CRITICAL
- Personality templates per consciousness level
- Temperature scaling per consciousness level
- Master system prompt with prohibitions
- Mystical identity preservation

## 🔒 Development Rules
1. New features must be implemented as separate modules
2. Existing modules must not be modified unless fixing critical bugs
3. All timeframe calculations must use the established constants
4. Pre-genesis checks must be implemented for all time-based queries
5. Response formatting must follow the established patterns exactly
6. All database queries must maintain existing security measures
7. Error handling must preserve system stability
8. Changes must be backward compatible
9. Documentation must be updated for all new features
10. Test coverage must be maintained for all critical paths

### Twitter Video Pipeline
- Audio generation must use exact tweet text only
- Video processing chain must maintain exact order:
  1. Tweet generation
  2. Audio generation (TTS)
  3. Image generation (DALL-E)
  4. Audio splitting
  5. Video generation
  6. Lip sync processing
  7. Final video assembly
- All temporary files must use /tmp directory
- FFmpeg commands must preserve quality settings

### Protected Core Files:
- src/services/animusLLM.ts
- src/services/audioGenerationService.ts
- src/services/imageGenerationService.ts
- src/services/twitterService.ts
- src/services/minimaxService.ts
- src/services/lipSyncService.ts
- src/services/ffmpegService.ts