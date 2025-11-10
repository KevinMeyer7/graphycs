import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import fs from 'fs';
import path from 'path';

// Fixed style tokens for consistency across all scenes
const STYLE = "flat 2D comic, corporate training, soft gradients, minimal palette, loopable 5-second animation, subtle camera pan, no text, no faces, no logos";

// Accent color type
type AccentColor = "emerald" | "sky" | "amber";

// Build prompt with fixed style + variable concept
function buildPrompt(concept: string, accent: AccentColor = "emerald"): string {
  return `${STYLE}, ${accent} accents, concept: ${concept}`;
}

// Metadata type for reproducibility
type BrollMetadata = {
  prompt: string;
  seed: number;
  duration: number;
  style_frame: string;
  scene_index: number;
  concept: string;
};

export const videoRouter = router({
  runwayBatch: publicProcedure
    .input(z.object({
      prompts: z.array(z.string()).min(1).max(10),
      seconds: z.union([z.literal(5), z.literal(10)]).default(5),
      accent: z.enum(['emerald', 'sky', 'amber']).default('emerald'),
    }))
    .mutation(async ({ input }) => {
      const apiKey = process.env.RUNWAY_API_KEY;
      const baseSeed = parseInt(process.env.BASE_SEED || '424242', 10);
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

      if (!apiKey) {
        console.error('[Runway] RUNWAY_API_KEY missing');
        throw new Error('RUNWAY_API_KEY is required. Set it in .env.local');
      }

      // Style reference image URL
      const styleFrameUrl = `${baseUrl}/style-frame.png`;
      const stylePath = path.join(process.cwd(), 'public', 'style-frame.png');

      // Check if style frame exists
      if (!fs.existsSync(stylePath)) {
        console.warn('[Runway] style-frame.png not found at public/style-frame.png');
        console.warn('[Runway] Generation will use placeholder (may reduce style consistency)');
      }

      console.log('[Runway] ===== BATCH GENERATION START =====');
      console.log('[Runway] Prompts:', input.prompts.length);
      console.log('[Runway] Duration:', input.seconds, 'seconds');
      console.log('[Runway] Accent:', input.accent);
      console.log('[Runway] Base seed:', baseSeed);
      console.log('[Runway] Style frame:', styleFrameUrl);

      const urls: string[] = [];
      const metadata: BrollMetadata[] = [];

      // Create metadata directory
      const metadataDir = path.join(process.cwd(), 'out');
      if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true });
      }

      // Generate one clip per prompt
      for (let i = 0; i < input.prompts.length; i++) {
        const concept = input.prompts[i];
        const seed = baseSeed + i;
        const prompt = buildPrompt(concept, input.accent);

        console.log(`[Runway] Scene ${i + 1}/${input.prompts.length}`);
        console.log(`[Runway]   Concept: "${concept}"`);
        console.log(`[Runway]   Seed: ${seed}`);
        console.log(`[Runway]   Prompt: ${prompt}`);

        try {
          // Prepare image URL or fallback to placeholder
          let promptImage: string;
          if (fs.existsSync(stylePath)) {
            promptImage = styleFrameUrl;
          } else {
            // Placeholder blue pixel
            promptImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
          }

          // Start video generation task
          const createRes = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'X-Runway-Version': '2024-11-06'
            },
            body: JSON.stringify({
              model: 'gen4_turbo',
              promptImage: promptImage,
              promptText: prompt,
              duration: input.seconds,
              ratio: '1280:720',
              seed
            })
          });

          if (!createRes.ok) {
            const errorText = await createRes.text();
            console.error(`[Runway] Scene ${i + 1} API error:`, createRes.status, errorText);
            throw new Error(`Runway generation failed for scene ${i + 1}: ${createRes.status} - ${errorText}`);
          }

          const createData = await createRes.json();
          const taskId = createData.id;

          console.log(`[Runway] Scene ${i + 1} task created: ${taskId}`);

          // Poll for completion
          let attempts = 0;
          const maxAttempts = 60; // 5 minutes max

          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

            const statusRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'X-Runway-Version': '2024-11-06'
              }
            });

            if (!statusRes.ok) {
              console.error(`[Runway] Scene ${i + 1} status check failed:`, statusRes.status);
              throw new Error(`Failed to check status for scene ${i + 1}`);
            }

            const statusData = await statusRes.json();
            console.log(`[Runway] Scene ${i + 1} status [${attempts + 1}/${maxAttempts}]:`, statusData.status);

            if (statusData.status === 'SUCCEEDED') {
              const videoUrl = statusData.output?.[0];

              if (!videoUrl) {
                throw new Error(`No video URL in response for scene ${i + 1}`);
              }

              console.log(`[Runway] Scene ${i + 1} COMPLETE:`, videoUrl);

              urls.push(videoUrl);

              const meta: BrollMetadata = {
                prompt,
                seed,
                duration: input.seconds,
                style_frame: '/style-frame.png',
                scene_index: i,
                concept
              };

              metadata.push(meta);

              // Save metadata to file
              const metaPath = path.join(metadataDir, `metadata_scene_${i}.json`);
              fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
              console.log(`[Runway] Metadata saved: ${metaPath}`);

              break;
            } else if (statusData.status === 'FAILED') {
              console.error(`[Runway] Scene ${i + 1} FAILED:`, statusData.failure_reason);
              throw new Error(`Runway generation failed for scene ${i + 1}: ${statusData.failure_reason}`);
            }

            attempts++;
          }

          if (attempts >= maxAttempts) {
            throw new Error(`Runway generation timed out for scene ${i + 1} after 5 minutes`);
          }
        } catch (error) {
          console.error(`[Runway] Error generating scene ${i + 1}:`, error);
          throw error;
        }
      }

      console.log('[Runway] ===== BATCH GENERATION COMPLETE =====');
      console.log(`[Runway] Generated ${urls.length} clips`);

      // Save manifest
      const manifest = {
        scenes: metadata,
        style_frame: '/style-frame.png',
        generated_at: new Date().toISOString()
      };
      const manifestPath = path.join(metadataDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('[Runway] Manifest saved:', manifestPath);

      return {
        urls,
        metadata
      };
    })
});
