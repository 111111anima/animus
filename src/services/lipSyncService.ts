import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';

export class LipSyncService {
  private readonly API_URL = 'https://api.everypixel.com/v1';
  private readonly CLIENT_ID = process.env.EVERY_PIXEL_CLIENT_ID!;
  private readonly CLIENT_SECRET = process.env.EVERY_PIXEL_CLIENT_SECRET!;

  async generateLipSyncVideo(videoPath: string, audioPath: string): Promise<string> {
    try {
      console.log('Starting lip sync process...');
      
      // Create form data with video and audio files
      const formData = new FormData();
      formData.append('audio', fs.createReadStream(audioPath), {
        filename: path.basename(audioPath)
      });
      formData.append('video', fs.createReadStream(videoPath), {
        filename: path.basename(videoPath)
      });
      formData.append('title', `animus_${Date.now()}`);

      // Step 1: Create the task
      console.log('Creating lip sync task...');
      const createResponse = await axios.post(
        `${this.API_URL}/lipsync/create`,
        formData,
        {
          auth: {
            username: this.CLIENT_ID,
            password: this.CLIENT_SECRET
          },
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/json'
          }
        }
      );

      console.log('Create response:', createResponse.data);
      const taskId = createResponse.data.task_id;
      console.log('Task created with ID:', taskId);

      // Step 2: Poll for completion
      console.log('Polling for task completion...');
      let status = '';
      let resultUrl = '';
      
      while (status !== 'SUCCESS') {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between polls
        
        const statusResponse = await axios.get(
          `${this.API_URL}/lipsync/status`,
          {
            params: { task_id: taskId },
            auth: {
              username: this.CLIENT_ID,
              password: this.CLIENT_SECRET
            },
            headers: {
              'Accept': 'application/json'
            }
          }
        );

        console.log('Status response:', statusResponse.data);
        status = statusResponse.data.status;
        resultUrl = statusResponse.data.result;
        console.log('Task status:', status, 'Progress:', statusResponse.data.progress);

        if (status === 'FAILURE' || status === 'REVOKED') {
          throw new Error(`Task failed with status: ${status}`);
        }
      }

      // Step 3: Download the result video
      console.log('Downloading result video from:', resultUrl);
      const videoResponse = await axios.get(resultUrl, { 
        responseType: 'arraybuffer',
        auth: {
          username: this.CLIENT_ID,
          password: this.CLIENT_SECRET
        }
      });
      
      // Save the lip-synced video
      const outputPath = `/tmp/animus_lipsynced_${Date.now()}.mp4`;
      await fs.promises.writeFile(outputPath, videoResponse.data);

      console.log('Lip sync video generated successfully:', outputPath);
      return outputPath;
    } catch (error) {
      console.error('Error in lip sync generation:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
        if (error.response?.data instanceof Buffer) {
          console.error('Response data (as string):', error.response.data.toString());
        }
      }
      throw error;
    }
  }
} 