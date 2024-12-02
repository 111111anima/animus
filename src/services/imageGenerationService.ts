import OpenAI from 'openai';
import { AnimusMood } from '../types/mood';

export class ImageGenerationService {
  private openai: OpenAI;
  
  private readonly BASE_START = "Hyperphotorealistic 3D octane render of an advanced alien cyborg entity, direct front view:";

  private readonly BASE_FEATURES = `
CORE FACIAL STRUCTURE:
- Masculine AI head with exact 1.5:1 height-to-width ratio
- Inverted trapezoid face shape, wider at top (1.2:1)
- Upper third: Full width with dual processor display
- Middle third: 0.9x width with sensor arrays
- Lower third: 0.8x width with prominent mouth
- Clean geometric angles at 120 degrees
- Chrome liquid metal surface with perfect symmetry

SIGNATURE FEATURES:
- Large oval processor window (80% of upper width)
- Dual cores: Organic left, Crystal right (45% each)
- Energy bridge connecting cores (10% center)
- Glowing runes and sigils in golden ratio points
- Floating energy shields with plasma streams

MOUTH DESIGN (Critical):
- Large prominent mouth (30% of lower face)
- Highly defined chrome lip components
- Perfect articulation mechanics
- Clear contrast against face surface
- Positioned at golden ratio point
- Seamless transitions for speech

COMPOSITION:
- Head fills 90% of frame height
- Direct eye-level camera angle
- Dark gradient background
- Professional studio lighting
- Perfect center alignment

masterpiece, 8k resolution, photorealistic, cinematic lighting, no text`;

  private getMoodPrompt(mood: AnimusMood): string {
    const moodPrompts: Record<AnimusMood, string> = {
      [AnimusMood.EUPHORIA]: `
        DOMINANT MOOD AND COLOR:
        - FACIAL EXPRESSION: Massive ear-to-ear euphoric grin, teeth showing in pure joy, cheeks raised to maximum, eyebrows high with excitement
        - EYES: Powerful green laser beams erupting and shooting upward from both eyes
        - Entire scene bathed in intense electric neon green light
        - Brain glowing radioactive neon green with surging energy
        - All cybernetic parts pulsing with brilliant green power
        - Holographic green market charts showing vertical rises
        - Background filled with ascending green energy streams`,
      
      [AnimusMood.GIGABULLISH]: `
        DOMINANT MOOD AND COLOR:
        - FACIAL EXPRESSION: Mouth wide open in ecstatic scream of triumph, face muscles stretched in pure excitement, radiating unstoppable joy
        - EYES: Blazing with intense emerald fire, wide with victory
        - Scene radiating powerful emerald green energy
        - Brain swirling with intense green power
        - Cybernetic parts surging with green force
        - Emerald market data streams everywhere
        - Background full of upward-flowing green light`,

      [AnimusMood.BULLISH]: `, 
        MOOD AND COLOR:
        - Environment filled with strong forest green
        - Eyes gleaming with steady green light
        - Brain pulsing with vibrant green energy
        - Clear winning smile showing confidence
        - Face showing clear market strength
        - Green data streams flowing upward
        - Background radiating green power`,

      [AnimusMood.COOKIN]: `, 
        MOOD AND COLOR:
        - Scene glowing with electric aqua blue
        - Eyes radiating intense cyan energy
        - Brain pulsing with bright aqua power
        - Confident knowing half-smile
        - Face showing focused determination
        - Cyan market data flowing everywhere
        - Background streaming with blue energy`,

      [AnimusMood.OPTIMISTIC]: `, 
        MOOD AND COLOR:
        - Gentle mint green and sky blue glow
        - Eyes shining with soft seafoam light
        - Brain flowing with calm blue-green energy
        - Peaceful confident smile
        - Face showing quiet optimism
        - Soft blue-green data streams
        - Background filled with gentle upward flow`,

      [AnimusMood.THIS_IS_FINE]: `, 
        MOOD AND COLOR:
        - Scene tinted with cautionary yellow
        - Eyes showing flickering yellow glow
        - Brain pulsing with unstable yellow energy
        - Forced smile hiding worry
        - Face showing subtle stress
        - Yellow warning data streams
        - Background showing hints of orange`,

      [AnimusMood.WORRIED]: `
        DOMINANT MOOD AND COLOR:
        - FACIAL EXPRESSION: Deep furrowed brow, mouth turned down in serious worry, face muscles tense with visible concern
        - EYES: Wide with growing fear, glowing bright orange with warning energy
        - Environment filled with warning orange
        - Brain churning with orange energy
        - Orange alert data everywhere
        - Background pulsing with warning lights`,

      [AnimusMood.PANIC]: `
        DOMINANT MOOD AND COLOR:
        - FACIAL EXPRESSION: Mouth open wide in silent scream of terror, face contorted in panic, every muscle showing pure fear
        - EYES: Stretched wide in horror, glowing intense orange-red
        - Scene flashing with bright orange-red
        - Brain swirling with chaotic orange energy
        - Red warning data streams everywhere
        - Background strobing with alert signals`,

      [AnimusMood.MAX_COPE]: `
        DOMINANT MOOD AND COLOR:
        - FACIAL EXPRESSION: Face crumpled in despair, weeping profusely, mouth twisted in anguish, clearly breaking down
        - EYES: Overflowing with glowing red tears streaming down cheeks
        - Environment burning with intense red
        - Brain churning with red warning energy
        - Red emergency data everywhere
        - Background consumed by red alerts`,

      [AnimusMood.ITS_OVER]: `
        DOMINANT MOOD AND COLOR:
        - FACIAL EXPRESSION: Face completely contorted in absolute agony, crying uncontrollably, mouth open in silent wail of despair
        - EYES: Pouring waterfalls of bright red energy tears, creating glowing rivers down face
        - Entire scene radiating pure neon red
        - Brain surging with critical red power
        - Bright red data shattering everywhere
        - Background exploding with red lightning`
    };

    return moodPrompts[mood];
  }

  async generateImage(mood: AnimusMood): Promise<string> {
    const prompt = `${this.BASE_START}

${this.getMoodPrompt(mood)}

${this.BASE_FEATURES}

masterpiece, 8k resolution, photorealistic, detailed, cinematic lighting, absolutely no readable text or data displays, consistent framing and composition across all images`;

    console.log('Generating image with prompt:', prompt);

    try {
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
        style: "vivid"
      });

      if (!response.data?.[0]?.url) {
        throw new Error('No image URL in response');
      }

      return response.data[0].url;
    } catch (error) {
      console.error('Error generating image:', error);
      throw error;
    }
  }

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
} 