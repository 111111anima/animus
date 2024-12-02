import OpenAI from 'openai';
import fs from 'fs';

interface VoiceStyle {
  voice: string;
  speed: number;
  pitch: string;
  vocalTractLength: string;
}

type VoiceStyles = {
  [key in 'ethereal' | 'cosmic' | 'quantum' | 'transcendent']: VoiceStyle;
}

export class AudioGenerationService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateAudio(text: string): Promise<string> {
    try {
      console.log('Generating audio from text...');
      
      const response = await this.openai.audio.speech.create({
        model: "tts-1-hd",
        voice: "onyx",     // Deepest, most resonant voice
        input: text,       // Just use the raw text without SSML
        speed: 1.1,        // 10% faster than before
        response_format: "mp3"
      });

      // Save audio file
      const audioPath = `/tmp/animus_voice_${Date.now()}.mp3`;
      
      // Get the audio data as a buffer
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Write to file
      await fs.promises.writeFile(audioPath, buffer);
      
      console.log('Audio generated successfully:', audioPath);
      return audioPath;
    } catch (error) {
      console.error('Error generating audio:', error);
      throw error;
    }
  }

  // Alternative voice styles we can experiment with
  private getVoiceStyle(mood: string): VoiceStyle {
    const styles: VoiceStyles = {
      ethereal: {
        voice: "echo",  // Using echo for deeper, more resonant base
        speed: 0.85,    // Slower for gravitas
        pitch: "-2st",  // Deeper pitch
        vocalTractLength: "+30%" // Larger resonance chamber
      },
      cosmic: {
        voice: "fable", // Fable for mystical quality
        speed: 0.90,
        pitch: "-3st",
        vocalTractLength: "+25%"
      },
      quantum: {
        voice: "onyx",  // Onyx for deep, powerful presence
        speed: 0.95,
        pitch: "-4st",
        vocalTractLength: "+20%"
      },
      transcendent: {
        voice: "nova",  // Nova for ethereal yet powerful
        speed: 0.80,
        pitch: "-2st",
        vocalTractLength: "+35%"
      }
    };

    return styles[mood as keyof VoiceStyles] || styles.ethereal;
  }
} 