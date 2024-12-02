import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export class AudioSplitterService {
  async splitAudioIntoChunks(audioPath: string, chunkDuration: number = 5): Promise<string[]> {
    try {
      console.log('Splitting audio into chunks...');
      const outputDir = `/tmp/animus_audio_chunks_${Date.now()}`;
      await fs.promises.mkdir(outputDir);

      // Get total duration
      const { stdout } = await execAsync(
        `ffprobe -i ${audioPath} -show_entries format=duration -v quiet -of csv="p=0"`
      );
      const totalDuration = parseFloat(stdout);
      console.log('Total audio duration:', totalDuration, 'seconds');

      // Calculate full chunks and remainder
      const numFullChunks = Math.floor(totalDuration / chunkDuration);
      const remainder = totalDuration % chunkDuration;
      
      // Only skip remainder if it's less than 1 second
      const shouldIncludeRemainder = remainder >= 1.0;
      const totalChunks = numFullChunks + (shouldIncludeRemainder ? 1 : 0);
      
      console.log(`Creating ${totalChunks} chunks (${numFullChunks} full + ${shouldIncludeRemainder ? '1 partial' : '0 partial'})`);

      const chunkPaths: string[] = [];

      // Create all chunks including partial if needed
      for (let i = 0; i < totalChunks; i++) {
        const startTime = i * chunkDuration;
        const isLastChunk = i === numFullChunks;
        const thisChunkDuration = isLastChunk ? remainder : chunkDuration;
        const outputPath = path.join(outputDir, `chunk_${i}.mp3`);
        
        await execAsync(
          `ffmpeg -i ${audioPath} -ss ${startTime} -t ${thisChunkDuration} -c copy ${outputPath}`
        );
        
        chunkPaths.push(outputPath);
      }

      console.log(`Split audio into ${chunkPaths.length} chunks`);
      return chunkPaths;
    } catch (error) {
      console.error('Error splitting audio:', error);
      throw error;
    }
  }

  async concatenateVideos(videoPaths: string[]): Promise<string> {
    try {
      console.log('Concatenating lip-synced videos...');
      
      // Create concat file
      const concatFilePath = `/tmp/concat_${Date.now()}.txt`;
      const concatContent = videoPaths.map(p => `file '${p}'`).join('\n');
      await fs.promises.writeFile(concatFilePath, concatContent);

      // Output path for final video
      const outputPath = `/tmp/animus_final_${Date.now()}.mp4`;

      // Enhanced FFmpeg command to prevent black frames and ensure consistent framerate
      await execAsync(
        `ffmpeg -f concat -safe 0 -i ${concatFilePath} \
        -vf "select='not(eq(n,0))',setpts=N/FRAME_RATE/TB" \
        -r 30 \
        -c:v libx264 \
        -preset fast \
        -crf 22 \
        -avoid_negative_ts make_zero \
        -fflags +genpts \
        -movflags +faststart \
        ${outputPath}`
      );

      // Clean up concat file
      await fs.promises.unlink(concatFilePath);

      console.log('Videos concatenated successfully');
      return outputPath;
    } catch (error) {
      console.error('Error concatenating videos:', error);
      throw error;
    }
  }
} 