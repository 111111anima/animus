import { animusLLM } from './animusLLM';
import { MoodService } from './moodService';
import { ImageGenerationService } from './imageGenerationService';

export class ResponseOrchestrator {
  private moodService: MoodService;
  private imageService: ImageGenerationService;

  constructor() {
    this.moodService = new MoodService();
    this.imageService = new ImageGenerationService();
  }

  async processQuery(question: string): Promise<string> {
    try {
      // Get raw metric response
      const metricResponse = await animusLLM.ask(question);
      return metricResponse;
    } catch (error) {
      console.error('Error processing query:', error);
      throw error;
    }
  }

  async cleanup() {
    await animusLLM.cleanup();
  }
} 