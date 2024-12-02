import { TwitterService } from './twitterService';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Initializing Twitter Service...');
  const twitterService = new TwitterService();
  
  try {
    // Post initial tweet immediately
    console.log('Posting initial tweet...');
    await twitterService.postTweet();
    
    // Then start the schedule
    console.log('Starting tweet schedule...');
    twitterService.startTweetSchedule();
    
    console.log('Twitter bot is now running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Error during startup:', error);
    process.exit(1);
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down Twitter service...');
    await twitterService.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down Twitter service...');
    await twitterService.cleanup();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Error in Twitter bot:', error);
  process.exit(1);
}); 