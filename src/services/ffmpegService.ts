import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export class FFmpegService {
  async extendVideo(inputPath: string, targetDuration: number): Promise<string> {
    try {
      console.log('Extending video duration...');
      const outputPath = `/tmp/animus_extended_${Date.now()}.mp4`;

      // Calculate loop count needed to reach target duration
      // Add small buffer to ensure we meet minimum length
      const loopCount = Math.ceil(targetDuration / 6) + 0.1;

      // Command to loop video with high quality settings
      const command = `ffmpeg -i ${inputPath} \
        -filter_complex "[0:v]loop=${loopCount}:1:0[v]" -map "[v]" \
        -c:v libx264 -preset veryslow -crf 0 \
        -pix_fmt yuv420p \
        -movflags +faststart \
        -an \
        ${outputPath}`;

      console.log('Running FFmpeg command:', command);
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.log('FFmpeg stderr:', stderr);
      }

      console.log('Video extended successfully');
      return outputPath;
    } catch (error) {
      console.error('Error extending video:', error);
      throw error;
    }
  }
} 