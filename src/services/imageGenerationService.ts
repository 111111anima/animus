import OpenAI from 'openai';
import { AnimusMood } from '../types/mood';

export class ImageGenerationService {
  private openai: OpenAI;
  
  private readonly BASE_START = "Hyperphotorealistic 3D octane render, cinematic shallow depth of field 80mm lens 1.4 f-stop, of an advanced alien cyborg entity with glossy obsidian metallic skin, exposed cybernetic brain, and mystical etchings, direct front view:";

  private readonly BASE_FEATURES = `
PRECISE FACIAL STRUCTURE (CRITICAL):
- Total height 1000 units, width tapering (800→640)
- MASCULINE ALIEN FEATURES (CRITICAL):
  * Strong angular jawline (240 units wide)
  * Pronounced brow ridge (180 units wide)
  * High sharp cheekbones at 610 units from chin
  * Deep-set almond eyes (220x120 units each)
  * Defined nose bridge (60 units wide, geometric)
  * Stern metallic mouth (240x89 units)

- EXPOSED BRAIN CORE (CRITICAL):
  * Upper cranium open revealing cybernetic brain (400x300 units)
  * Dual-hemisphere quantum processor core
  * Pulsing energy conduits between lobes
  * Floating crystalline neural networks
  * Visible plasma energy circulation

MATERIAL & SURFACE:
- Ultra-glossy obsidian black (95% reflectivity)
- Angular geometric plating with sharp edges
- Ancient runes following golden ratio points
- Fibonacci-spaced sigils (21,34,55,89 units)
- Refractive chrome accents on edges
- Neon circuit paths between runes

CRITICAL FEATURES:
- Exposed brain processor (400x300 crystal matrix)
- Dual cores: 288 units each side
- Energy bridge: 64 units center
- Strong articulated jaw structure
- Shield generators: 144 units diameter
- Eye glow channels: 34 units width

COMPOSITION:
- Head fills 90% frame
- Perfect center alignment
- Dark gradient background
- Studio lighting setup
- Cinematic depth

masterpiece, 8k resolution, photorealistic, cinematic lighting, no text`;

  private getMoodPrompt(mood: AnimusMood): string {
    const moodPrompts: Record<AnimusMood, string> = {
      [AnimusMood.EUPHORIA]: `
        DOMINANT MOOD AND COLOR (CRITICAL):
        - COLOR SCHEME: PURE MAXIMUM NEON GREEN, NO OTHER COLORS PERMITTED
        - FACIAL EXPRESSION: Massive ear-to-ear euphoric grin, teeth showing in pure joy, cheeks raised to maximum, eyebrows high with excitement
        - EYES: Powerful nuclear green laser beams erupting and shooting upward from both eyes
        - Entire scene completely saturated in intense electric neon green, no other tints
        - Brain core glowing with radioactive neon green plasma at maximum intensity
        - All cybernetic parts surging with brilliant green energy at peak levels
        - Holographic green market data violently ascending everywhere
        - Background consumed by pure green plasma storms and emerald lightning`,
      
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

      [AnimusMood.COOKIN]: `
        DOMINANT MOOD AND COLOR (CRITICAL):
        - COLOR SCHEME: PURE MINT GREEN, NO OTHER COLORS PERMITTED
        - FACIAL EXPRESSION: Confident knowing half-smile, eyes narrowed with determination
        - EYES: Radiating intense mint green energy beams
        - Environment completely saturated in fresh mint green light
        - Brain core pulsing with bright mint green plasma
        - All cybernetic parts glowing with mint energy
        - Holographic mint green data flowing upward
        - Background streaming with pure mint green auroras`,

      [AnimusMood.OPTIMISTIC]: `
        DOMINANT MOOD AND COLOR (CRITICAL):
        - COLOR SCHEME: PURE CYAN-TEAL BLEND, NO OTHER COLORS PERMITTED
        - FACIAL EXPRESSION: Peaceful confident smile, serene expression
        - EYES: Shining with soft cyan-teal light, gentle glow
        - Environment bathed in cool cyan-teal luminescence
        - Brain flowing with calm teal plasma energy
        - Cybernetic parts emitting soft cyan light
        - Gentle teal data streams rising smoothly
        - Background filled with serene cyan-teal auroras`,

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
        DOMINANT MOOD AND COLOR (CRITICAL):
        - COLOR SCHEME: PURE DEEP NEON RED, NO OTHER COLORS ALLOWED
        - FACIAL EXPRESSION: Face crumpled in despair, weeping profusely, mouth twisted in anguish, clearly breaking down
        - EYES: Overflowing with intense ruby-red energy tears creating glowing scarlet rivers down face
        - Environment completely saturated in pure deep red, no other tints
        - Brain surging with pulsing neon red plasma energy
        - Cybernetic parts overloading with maximum red power
        - Emergency red data fracturing and shattering everywhere
        - Background consumed by deep red plasma storms and ruby lightning`,

      [AnimusMood.ITS_OVER]: `
        DOMINANT MOOD AND COLOR (CRITICAL):
        - COLOR SCHEME: MAXIMUM INTENSE RED, NO OTHER COLORS PERMITTED
        - FACIAL EXPRESSION: Face completely contorted in absolute agony, crying uncontrollably, mouth open in silent wail of despair
        - EYES: Pouring waterfalls of blazing ruby energy tears, creating luminous scarlet rivers down face
        - Entire scene drowned in pure neon red with no other tints
        - Brain overloading with critical red plasma at maximum intensity
        - All systems flooded with pure red energy at peak levels
        - Bright red data rapidly dispersing in all directions
        - Background filled with red lightning and pure ruby energy storms`
    };

    return moodPrompts[mood];
  }

  async generateImage(mood: AnimusMood): Promise<string> {
    try {
      // Combine base prompt with mood-specific details
      const prompt = `${this.BASE_START}

${this.getMoodPrompt(mood)}

${this.BASE_FEATURES}`;

      console.log('Generating image with prompt:', prompt);

      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
        style: "vivid"
      });

      // Add type safety check
      if (!response.data[0].url) {
        throw new Error('No image URL received from OpenAI');
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