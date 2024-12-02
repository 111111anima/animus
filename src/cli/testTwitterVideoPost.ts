import { TwitterService } from '../services/twitterService';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  try {
    console.log('Starting Twitter video post test...');
    
    const twitterService = new TwitterService();
    await twitterService.postTweet();
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

main(); 