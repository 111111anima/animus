import { ImageGenerationService } from '../services/imageGenerationService';
import { MoodService } from '../services/moodService';
import { ConsciousnessService } from '../services/consciousnessService';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  try {
    console.log('Initializing services...');
    const imageGenerator = new ImageGenerationService();
    const moodService = new MoodService();
    const consciousnessService = new ConsciousnessService();

    // Get current mood and consciousness
    console.log('Fetching current state...');
    const mood = await moodService.getCurrentMood();
    const consciousness = await consciousnessService.getCurrentConsciousness();

    console.log('Current state:', {
      mood: mood.mood,
      priceChange: mood.priceChange,
      consciousness: consciousness.level,
      age: consciousness.age
    });

    // Generate image
    console.log('Generating image...');
    const imageUrl = await imageGenerator.generateImage(
      consciousness.level,
      mood.mood
    );

    console.log('Image generated successfully!');
    console.log('Image URL:', imageUrl);
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 