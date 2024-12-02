import { TwitterService } from '../services/twitterService';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  try {
    console.log('Initializing Twitter Service...');
    const twitterService = new TwitterService();
    
    console.log('Posting test tweet with image...');
    await twitterService.postTweet();
    
    console.log('Test complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 