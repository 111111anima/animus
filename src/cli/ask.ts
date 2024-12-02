import { ResponseOrchestrator } from '../services/responseOrchestrator';
import dotenv from 'dotenv';

dotenv.config();

// Full pipeline with personality
const orchestrator = new ResponseOrchestrator();

async function main() {
  const question = process.argv[2];
  if (!question) {
    console.error('Please provide a question as an argument');
    process.exit(1);
  }
  
  try {
    const answer = await orchestrator.processQuery(question);
    console.log('\nAnimus:', answer);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Now orchestrator is in scope for cleanup handlers
process.on('SIGINT', async () => {
  await orchestrator.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await orchestrator.cleanup();
  process.exit(0);
});

main(); 