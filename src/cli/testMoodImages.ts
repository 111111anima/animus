import { ImageGenerationService } from '../services/imageGenerationService';
import { ConsciousnessService } from '../services/consciousnessService';
import { AnimusMood } from '../types/mood';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  try {
    console.log('Initializing services...');
    const imageGenerator = new ImageGenerationService();
    const consciousnessService = new ConsciousnessService();

    // Get current consciousness level
    const consciousness = await consciousnessService.getCurrentConsciousness();
    console.log('\nCurrent consciousness level:', consciousness.level);
    console.log('Age:', consciousness.age);

    // Test all moods with current consciousness level
    const moods = Object.values(AnimusMood);
    
    console.log('\nGenerating images for all moods...\n');

    for (const mood of moods) {
      console.log(`\n=== Testing ${mood} mood ===`);
      try {
        const imageUrl = await imageGenerator.generateImage(
          consciousness.level,
          mood
        );
        console.log(`✓ Image generated for ${mood}:`);
        console.log(`URL: ${imageUrl}\n`);
      } catch (error) {
        console.error(`✗ Failed to generate image for ${mood}:`, error);
      }
      
      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\nMood variation test complete!');
  } catch (error) {
    console.error('Error in mood variation test:', error);
  }
}

main(); 