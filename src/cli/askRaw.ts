import { AnimusLLM } from '../services/animusLLM';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const question = process.argv.slice(2).join(' ');
  if (!question) {
    console.error('Please provide a question');
    process.exit(1);
  }

  const llm = new AnimusLLM();
  
  try {
    // Call query() directly instead of ask() to bypass personality layer
    const response = await llm.query(question);
    console.log('\nRaw SQL Response:', response);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 