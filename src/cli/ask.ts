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
    const answer = await animusLLM.ask(question);
    console.log('\nAnimus:', answer);
  } catch (error) {
    process.exit(1);
  } finally {
    await animusLLM.cleanup();
  }
}

// Handle process termination silently
process.on('SIGINT', async () => {
  await animusLLM.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await animusLLM.cleanup();
  process.exit(0);
});

main(); 