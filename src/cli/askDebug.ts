import { animusLLM } from '../services/animusLLM';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const question = process.argv[2];
  if (!question) {
    console.error('Please provide a question as an argument');
    process.exit(1);
  }

  try {
    console.log('Initializing Animus...');
    console.log('Processing question:', question);
    const answer = await animusLLM.ask(question);
    console.log('\nAnimus:', answer);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    console.log('Cleaning up...');
    await animusLLM.cleanup();
  }
}

process.on('SIGINT', async () => {
  console.log('\nCleaning up...');
  await animusLLM.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nCleaning up...');
  await animusLLM.cleanup();
  process.exit(0);
});

main(); 