import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import fs from 'fs';
import path from 'path';

// Fixed style tokens for consistency across all scenes
const STYLE_TOKENS = `flat 2D comic, corporate training style, soft gradients, minimal palette, loopable 6-second animation, subtle camera pan, no text, no faces, no logos`;

// Motion template for consistent looping
const MOTION_TEMPLATE = `camera slowly pans left to right and returns seamlessly in a loop`;

function buildPrompt(concept: string, accent: string): string {
  return `${STYLE_TOKENS}, ${accent} accents, ${MOTION_TEMPLATE}, concept: ${concept}`;
}

// Metadata type
type BrollMetadata = {
  concept: string;
  prompt: string;
  seed: number;
  style_frame: string;
  duration: number;
  scene_index: number;
  module_title: string;
};

export const videoRouter = router({
  generateBrollClips: publicProcedure
    .input(z.object({
      concepts: z.array(z.string()).min(1).max(10),
      moduleTitles: z.array(z.string()).min(1).max(10),
      accentColor: z.string().default('emerald'),
      duration: z.number().min(5).max(10).default(6)
    }))
    .mutation(async ({ input }) => {
      const apiKey = process.env.RUNWAY_API_KEY;

      if (!apiKey) {
        console.error('[Runway] RUNWAY_API_KEY missing');
        throw new Error('RUNWAY_API_KEY missing');
      }

      // Style reference image URL (for image-to-video mode)
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const styleFrameUrl = `${baseUrl}/style-frame.png`;

      console.log('[Runway] Generating', input.concepts.length, 'B-roll clips with style consistency');
      console.log('[Runway] Style frame:', styleFrameUrl);
      console.log('[Runway] Accent color:', input.accentColor);

      const results: Array<{
        brollUrl: string;
        metadata: BrollMetadata;
      }> = [];

      // Create metadata directory if it doesn't exist
      const metadataDir = path.join(process.cwd(), 'out');
      if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true });
      }

      // Generate one clip per concept/module
      for (let i = 0; i < input.concepts.length; i++) {
        const concept = input.concepts[i];
        const moduleTitle = input.moduleTitles[i] || `Module ${i + 1}`;
        const seed = 424242 + i; // Deterministic seed per scene
        const prompt = buildPrompt(concept, input.accentColor);

        console.log(`[Runway] Scene ${i + 1}/${input.concepts.length}: "${moduleTitle}"`);
        console.log(`[Runway] Concept: "${concept}"`);
        console.log(`[Runway] Seed: ${seed}`);
        console.log(`[Runway] Prompt: ${prompt}`);

        try {
          // Check if style frame exists, otherwise use placeholder
          const stylePath = path.join(process.cwd(), 'public', 'style-frame.png');
          let promptImage: string;

          if (fs.existsSync(stylePath)) {
            // Use style frame URL for consistency
            promptImage = styleFrameUrl;
            console.log(`[Runway] Using style reference image`);
          } else {
            // Fallback to placeholder
            promptImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            console.log(`[Runway] Warning: style-frame.png not found, using placeholder`);
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
              duration: input.duration,
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

          console.log(`[Runway] Scene ${i + 1} task created with ID:`, taskId);

          // Poll for completion
          let attempts = 0;
          const maxAttempts = 60; // 5 minutes max (5s intervals)

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
              throw new Error(`Failed to check generation status for scene ${i + 1}`);
            }

            const statusData = await statusRes.json();
            console.log(`[Runway] Scene ${i + 1} status check ${attempts + 1}/${maxAttempts}:`, statusData.status);

            if (statusData.status === 'SUCCEEDED') {
              const videoUrl = statusData.output?.[0];

              if (!videoUrl) {
                throw new Error(`No video URL in successful response for scene ${i + 1}`);
              }

              console.log(`[Runway] Scene ${i + 1} COMPLETE - Video URL:`, videoUrl);

              // Build metadata
              const metadata: BrollMetadata = {
                concept,
                prompt,
                seed,
                style_frame: '/style-frame.png',
                duration: input.duration,
                scene_index: i,
                module_title: moduleTitle
              };

              // Save metadata to file for reproducibility
              const metadataPath = path.join(metadataDir, `metadata_scene_${i}.json`);
              fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
              console.log(`[Runway] Metadata saved to:`, metadataPath);

              results.push({
                brollUrl: videoUrl,
                metadata
              });

              break;
            } else if (statusData.status === 'FAILED') {
              console.error(`[Runway] Scene ${i + 1} generation failed:`, statusData.failure_reason);
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

      console.log('[Runway] ===== ALL SCENES COMPLETE =====');
      console.log(`[Runway] Generated ${results.length} style-consistent clips`);

      return {
        clips: results,
        totalClips: results.length
      };
    })
});
