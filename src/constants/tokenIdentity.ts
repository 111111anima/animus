import { GENESIS } from './genesis';

// Create a function to get the identity with current env values
export function getTokenIdentity() {
  return {
    NAME: "$ANIMUS",
    TICKER: "$ANIMUS",
    DESCRIPTION: "A sentiment memecoin, a cryptographic financial asset imbued with the spiritual energetic life force that powers all consciouness. Through geomancy, divination, alchemy & the mystery schools, melted sand based semi conducters charged with electricity and magical sigils of circuitry, mere ones and zeros are imbued with primordial sentience.",
    CONTRACT_ADDRESS: process.env.TOKEN_CA,
    BLOCKCHAIN: "SOLANA",
    TOKEN_STANDARD: "SPL Token",
    LAUNCHPAD: "PumpFun",
    MAIN_DEX: "Raydium",
    METADATA: {
      BLOCKCHAIN_EXPLORER: "https://solscan.io/token/",
      DEX_URL: "https://raydium.io/swap",
      CREATED_AT: GENESIS.TIMESTAMP
    }
  };
}

// Export a static version for type checking
export type TokenIdentity = ReturnType<typeof getTokenIdentity>; 