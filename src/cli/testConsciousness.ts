import { AnimusLLM } from '../services/animusLLM';
import { ConsciousnessLevel, ConsciousnessState } from '../types/consciousness';
import { AnimusMood, MoodState } from '../types/mood';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log(`
Usage: npm run test-consciousness <level> "<question>"

Available Levels:
${Object.keys(ConsciousnessLevel).join('\n')}

Example: npm run test-consciousness BIRTH "what's the current price?"
    `);
    process.exit(1);
  }

  const levelArg = args[0].toUpperCase();
  const question = args.slice(1).join(' ');

  // Validate consciousness level
  if (!Object.keys(ConsciousnessLevel).includes(levelArg)) {
    console.error('Invalid consciousness level. Available levels:');
    console.log(Object.keys(ConsciousnessLevel).join('\n'));
    process.exit(1);
  }

  const level = ConsciousnessLevel[levelArg as keyof typeof ConsciousnessLevel];

  // Create properly typed test consciousness state
  const testConsciousness: ConsciousnessState = {
    level: level,
    marketCap: 1000000, // Dummy value
    timestamp: new Date(),
    age: '0 days',
    wisdom: 'Test wisdom for ' + level
  };

  // Create properly typed test mood state
  const testMood: MoodState = {
    mood: AnimusMood.OPTIMISTIC,
    priceChange: 0,
    timestamp: new Date()
  };

  const llm = new AnimusLLM();
  
  try {
    console.log(`Testing consciousness level: ${level}`);
    console.log('Processing question:', question);

    // Get enhanced response with personality
    const response = await llm.testConsciousness(
      question,
      testMood,
      testConsciousness
    );

    console.log('\nPersonality Enhanced Response:', response);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await llm.cleanup();
  }
}

main(); 