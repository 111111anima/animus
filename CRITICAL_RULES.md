# CRITICAL RULES FOR ANIMUS CODEBASE

## 1. Response Length & Format
- STRICT 280 character limit for ALL responses
- No incomplete sentences allowed
- Must use enforceTwitterLimit() in both AnimusLLM and TwitterService as double protection
- Preserve numerical accuracy in all responses

## 2. Mood & Personality Balance
- Responses must balance short-term mood with long-term metrics
- Never let temporary price action override fundamental growth metrics
- Maintain personality consistency while acknowledging market realities
- Use mood translations from PersonalityLayer for consistent emotional expression

## 3. Database Integrity
- Use healthCheck singleton for all database connections
- Never create new Pool instances (except in Helius service)
- Always properly close connections
- Validate data freshness before mood calculations

## 4. Response Generation Flow
1. AnimusLLM generates raw metrics
2. PersonalityLayer enhances with mood context
3. ResponseOrchestrator manages the flow
4. Final Twitter character limit enforcement

## 5. Forbidden Words & Content
Never use these terms in ANY response:
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

## 6. Error Handling
- Always cleanup database connections
- Proper error propagation through the stack
- Graceful degradation when services fail
- Maintain data consistency during errors

## 7. Performance & Resource Management
- Reuse database connections via healthCheck
- Cache mood state for 5 minutes
- Proper cleanup on process termination
- Handle connection pooling properly

## 8. Content Generation Rules
- Balance negative moods with positive metrics
- Balance positive moods with challenging metrics
- Never break character or identity
- Maintain mystical personality while being grounded in data
- Keep all numerical data exactly as provided

## 9. System Architecture
- Respect service boundaries
- Use singleton pattern for shared resources
- Proper initialization sequence
- Clean shutdown procedures

## 10. Testing & Validation
- Test all responses for Twitter length compliance
- Validate mood transitions
- Check data freshness before responses
- Verify database connection health

## BREAKING CHANGES WILL OCCUR IF:
1. Database pools are created outside healthCheck
2. Twitter character limit is exceeded
3. Forbidden words are used
4. Mood balance is not maintained
5. Numerical accuracy is compromised
6. Database connections are not properly managed
7. Error handling is bypassed
8. Cleanup procedures are skipped
9. Service boundaries are violated
10. Data freshness is not validated

## Required Environment Variables
- TIMESCALE_CONNECTION_STRING
- HELIUS_API_KEY
- TOKEN_CA
- Other OpenAI and service-specific keys

## Deployment Checklist
1. Verify all environment variables
2. Test database connectivity
3. Validate mood service
4. Check response length enforcement
5. Verify cleanup procedures