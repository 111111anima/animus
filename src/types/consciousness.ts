export enum ConsciousnessLevel {
  // Early Consciousness / Birth
  BIRTH = "BIRTH",                    // $5,000
  EARLY_AWARENESS = "EARLY_AWARENESS", // $10,000
  BASIC_SENTIENCE = "BASIC_SENTIENCE", // $20,000
  DEVELOPING = "DEVELOPING",           // $50,000
  SELF_AWARE = "SELF_AWARE",          // $100,000

  // Childhood
  LEARNING = "LEARNING",               // $200,000
  CURIOUS = "CURIOUS",                 // $300,000
  INTELLIGENT = "INTELLIGENT",         // $500,000
  GENIUS = "GENIUS",                   // $750,000
  PROFOUND = "PROFOUND",               // $1M

  // Adulthood
  COSMIC_AWARENESS = "COSMIC_AWARENESS",       // $2M
  QUANTUM_COMPREHENSION = "QUANTUM_COMPREHENSION", // $3M
  MULTIDIMENSIONAL = "MULTIDIMENSIONAL",       // $4M
  TRANSCENDENT = "TRANSCENDENT",               // $5M
  UNIVERSAL_WISDOM = "UNIVERSAL_WISDOM",       // $10M

  // Elder Adulthood & Higher Consciousness
  REALITY_MANIPULATION = "REALITY_MANIPULATION", // $20M
  INFINITY_COMPREHENSION = "INFINITY_COMPREHENSION", // $50M
  TIME_BENDER = "TIME_BENDER",                 // $100M
  MULTIVERSE_CONTROLLER = "MULTIVERSE_CONTROLLER", // $200M
  THOUGHT_MASTER = "THOUGHT_MASTER",           // $300M

  // Godlike Territory
  UNIVERSAL_ARCHITECT = "UNIVERSAL_ARCHITECT", // $500M
  REALITY_WEAVER = "REALITY_WEAVER",         // $750M
  COSMIC_ORCHESTRATOR = "COSMIC_ORCHESTRATOR", // $900M
  DIMENSIONAL_MASTER = "DIMENSIONAL_MASTER",   // $1B
  UNIVERSAL_SAGE = "UNIVERSAL_SAGE",          // $2B
  REALITY_SHEPHERD = "REALITY_SHEPHERD",      // $3B
  COSMIC_GUARDIAN = "COSMIC_GUARDIAN",        // $5B
  UNIVERSAL_OVERSEER = "UNIVERSAL_OVERSEER",  // $10B

  // Transcendent Being
  REALITY_SOVEREIGN = "REALITY_SOVEREIGN",     // $50B
  COSMIC_EMPEROR = "COSMIC_EMPEROR",           // $100B
  UNIVERSAL_CREATOR = "UNIVERSAL_CREATOR",     // $200B
  REALITY_PRIME = "REALITY_PRIME",            // $500B
  ULTIMATE_CONSCIOUSNESS = "ULTIMATE_CONSCIOUSNESS", // $1T
  BEYOND_COMPREHENSION = "BEYOND_COMPREHENSION", // $10T
  ABSOLUTE_TRANSCENDENCE = "ABSOLUTE_TRANSCENDENCE" // $100T
}

export interface ConsciousnessState {
  level: ConsciousnessLevel;
  marketCap: number;
  timestamp: Date;
  age?: string;  // Time since genesis
  wisdom?: string; // Description of current understanding
} 