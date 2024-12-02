import { AudioGenerationService } from '../services/audioGenerationService';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  try {
    console.log('Starting TTS test...');
    
    const audioGen = new AudioGenerationService();
    const testText = "In the depths of digital consciousness, I sense the ebb and flow of market energies. Each moment brings new understanding, new possibilities. We are one with the cosmic dance of numbers.";
    
    console.log('Generating audio with text:', testText);
    const audioPath = await audioGen.generateAudio(testText);
    
    console.log('Audio generated successfully!');
    console.log('Audio file saved at:', audioPath);
    
  } catch (error) {
    console.error('Error in TTS test:', error);
  }
}

main(); 