import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import path from 'path';

export class MinimaxService {
  private readonly API_URL = 'https://api.minimaxi.chat/v1';
  private readonly API_KEY = process.env.MINIMAX_API_KEY!;
  private readonly GROUP_ID = process.env.MINIMAX_GROUP_ID!;

  async generateVideoFromImage(imageUrl: string): Promise<string> {
    try {
      console.log('Creating video generation task...');

      // Create request body for img2video
      const requestBody = {
        model: 'video-01',
        first_frame_image: imageUrl,  // Use DALL-E image URL directly
        prompt: `
          Create a talking head video with these strict requirements:
          - PRESERVE ALL VISUAL DETAILS FROM INPUT IMAGE EXACTLY
          - Subject MUST speak naturally with clear mouth movements
          - Head MUST stay completely still and forward-facing
          - Face position must remain LOCKED in center frame
          - NO camera movement whatsoever
          - Add subtle floating/drifting motion to surrounding elements
          - Maintain perfect eye contact with camera
          - Keep all cybernetic features and brain details exactly as shown
          - Maintain exact lighting and composition from input image
          - Gentle particle effects and energy flows in background only
          - NO movement or changes to facial structure
          - ONLY animate the mouth for speech
        `,
        prompt_optimizer: false  // Follow our prompt strictly
      };

      // Create task
      const createResponse = await axios.post(
        `${this.API_URL}/video_generation`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.API_KEY}`
          }
        }
      );

      const taskId = createResponse.data.task_id;
      console.log('Task created with ID:', taskId);

      // Poll for completion
      let status = '';
      let fileId = '';

      while (status.toLowerCase() !== 'success') {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const statusResponse = await axios.get(
          `${this.API_URL}/query/video_generation?task_id=${taskId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.API_KEY}`
            }
          }
        );

        console.log('Status:', statusResponse.data);
        status = statusResponse.data.status;
        fileId = statusResponse.data.file_id;

        if (status === 'FAILURE' || status === 'REVOKED') {
          throw new Error(`Task failed with status: ${status}`);
        }
      }

      // Get download URL
      const downloadResponse = await axios.get(
        `${this.API_URL}/files/retrieve`,
        {
          params: {
            GroupId: this.GROUP_ID,
            file_id: fileId
          },
          headers: {
            'Authorization': `Bearer ${this.API_KEY}`
          }
        }
      );

      // Download the video
      console.log('Downloading video...');
      const videoResponse = await axios.get(downloadResponse.data.file.download_url, { 
        responseType: 'arraybuffer' 
      });
      const videoPath = `/tmp/animus_video_${Date.now()}.mp4`;
      await fs.promises.writeFile(videoPath, videoResponse.data);
      console.log('Video saved to:', videoPath);

      return videoPath;

    } catch (error) {
      console.error('Error in video generation:', error);
      throw error;
    }
  }
} 