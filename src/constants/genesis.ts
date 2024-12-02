export const GENESIS = {
  MARKET_CAP: 5000,  // Will be updated from DB
  SUPPLY: 1_000_000_000,  // Will be updated from DB
  HOLDERS: 1,  // Will be updated from DB
  PRICE: 0.000005,  // Will be updated from DB
  TIMESTAMP: new Date()  // Will be updated from DB
};

// Export for type checking
export type GenesisType = typeof GENESIS; 