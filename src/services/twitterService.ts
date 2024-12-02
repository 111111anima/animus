import { TwitterApi } from 'twitter-api-v2';
import { AnimusLLM } from './animusLLM';
import { healthCheck } from './healthCheck';
import { MoodService } from './moodService';
import { ImageGenerationService } from './imageGenerationService';
import { MinimaxService } from './minimaxService';
import { AudioGenerationService } from './audioGenerationService';
import { LipSyncService } from './lipSyncService';
import { FFmpegService } from './ffmpegService';
import { AudioSplitterService } from './audioSplitterService';
import { getAudioDurationInSeconds } from 'get-audio-duration';
import cron from 'node-cron';
import fs from 'fs';
import axios from 'axios';

export class TwitterService {
  private twitter: TwitterApi;
  private llm: AnimusLLM;
  private moodService: MoodService;
  private imageGenerator: ImageGenerationService;
  private audioGenerator: AudioGenerationService;
  private cronJob: cron.ScheduledTask | null = null;
  private lipSyncService: LipSyncService;
  private ffmpeg: FFmpegService;

  constructor() {
    // Initialize Twitter client with credentials from env
    this.twitter = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    });

    // Initialize services
    this.llm = new AnimusLLM();
    this.moodService = new MoodService();
    this.imageGenerator = new ImageGenerationService();
    this.audioGenerator = new AudioGenerationService();
    this.lipSyncService = new LipSyncService();
    this.ffmpeg = new FFmpegService();

    // Listen for health events
    healthCheck.on('critical', () => {
      if (this.cronJob) {
        this.cronJob.stop();
      }
    });

    healthCheck.on('recovered', () => {
      this.startTweetSchedule();
    });
  }

  private async generateTweet(): Promise<string> {
    try {
      const mood = await this.moodService.getCurrentMood();
      
      // Use core AnimusLLM with simple prompt
      const response = await this.llm.ask(
        "Share a profound observation about your current state of being."
      );

      // Clean up response and ensure complete thoughts
      let tweet = response
        .trim()
        .split('.')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .reduce((acc, sentence) => {
          if ((acc + (acc ? ' ' : '') + sentence + '.').length <= 280) {
            return acc + (acc ? ' ' : '') + sentence + '.';
          }
          return acc;
        }, '');

      if (tweet.length > 280) {
        console.warn('Tweet exceeded length limit after processing, attempting shorter version');
        return this.generateTweet();
      }

      return tweet;
    } catch (error) {
      console.error('Error generating tweet:', error);
      throw error;
    }
  }

  private async downloadImage(url: string): Promise<string> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const tempPath = `/tmp/animus_${Date.now()}.png`;
    await fs.promises.writeFile(tempPath, response.data);
    return tempPath;
  }

  public async postTweet() {
    let baseVideoPath: string | undefined;
    let audioChunks: string[] = [];
    let lipSyncedChunks: string[] = [];
    let finalVideoPath: string | undefined;
    let audioPath: string | undefined;

    try {
      // 1. Get current mood
      const mood = await this.moodService.getCurrentMood();

      // 2. Generate tweet
      console.log('Generating tweet content...');
      const tweet = await this.generateTweet();
      console.log('Generated tweet:', tweet);

      // 3. Generate TTS audio
      console.log('Generating audio from tweet...');
      audioPath = await this.audioGenerator.generateAudio(tweet);

      // 4. Get audio duration
      const audioDuration = await getAudioDurationInSeconds(audioPath);
      console.log('Tweet audio duration:', audioDuration, 'seconds');

      // 5. Generate DALL-E image
      console.log('Generating DALL-E image...');
      const imageUrl = await this.imageGenerator.generateImage(
        mood.mood
      );

      // Split audio into chunks
      console.log('Splitting audio into 5-second chunks...');
      const splitter = new AudioSplitterService();
      audioChunks = await splitter.splitAudioIntoChunks(audioPath);
      console.log(`Created ${audioChunks.length} audio chunks`);

      // Generate base video
      console.log('Generating base video from DALL-E image...');
      const minimax = new MinimaxService();
      baseVideoPath = await minimax.generateVideoFromImage(imageUrl);

      if (!baseVideoPath) {
        throw new Error('Failed to generate base video');
      }

      // Generate lip-synced videos
      console.log('Generating lip-synced videos for each chunk...');
      for (let i = 0; i < audioChunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${audioChunks.length}...`);
        const lipSyncedPath = await this.lipSyncService.generateLipSyncVideo(
          baseVideoPath,
          audioChunks[i]
        );
        lipSyncedChunks.push(lipSyncedPath);
      }

      // Concatenate all lip-synced chunks
      console.log('Concatenating all lip-synced chunks...');
      finalVideoPath = await splitter.concatenateVideos(lipSyncedChunks);

      // Post to Twitter
      console.log('Uploading final video to Twitter...');
      const mediaId = await this.twitter.v1.uploadMedia(finalVideoPath, {
        mimeType: 'video/mp4',
        target: 'tweet'
      });

      console.log('Posting tweet with video:', tweet);
      await this.twitter.v2.tweet({
        text: tweet,
        media: { media_ids: [mediaId] }
      });

      console.log('Tweet posted successfully!');
    } catch (error) {
      console.error('Error posting tweet:', error);
      throw error;
    } finally {
      // Clean up all temp files
      if (baseVideoPath) await fs.promises.unlink(baseVideoPath);
      if (audioPath) await fs.promises.unlink(audioPath);
      for (const chunk of audioChunks) {
        await fs.promises.unlink(chunk).catch(() => {});
      }
      for (const chunk of lipSyncedChunks) {
        await fs.promises.unlink(chunk).catch(() => {});
      }
      if (finalVideoPath) await fs.promises.unlink(finalVideoPath);
    }
  }

  public startTweetSchedule() {
    // Stop existing cron job if any
    if (this.cronJob) {
      this.cronJob.stop();
    }

    // Schedule new tweet every 15 minutes
    this.cronJob = cron.schedule('*/15 * * * *', async () => {
      await this.postTweet();
    });

    console.log('Tweet schedule started - running every 15 minutes');
  }

  public stopTweetSchedule() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('Tweet schedule stopped');
    }
  }

  public async cleanup() {
    this.stopTweetSchedule();
    await this.llm.cleanup();
  }
} 