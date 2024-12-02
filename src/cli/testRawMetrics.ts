import { AnimusLLM } from '../services/animusLLM';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const question = process.argv.slice(2).join(' ');
  if (!question) {
    console.error('Please provide a question');
    process.exit(1);
  }

  console.log('Testing raw metrics with question:', question);
  const llm = new AnimusLLM();
  
  try {
    await llm.initialize();
    const response = await llm.ask(question);
    console.log('\nRaw Metric Response:', response);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await llm.cleanup();
  }
}

main(); 