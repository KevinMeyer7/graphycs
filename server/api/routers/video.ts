import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import fs from 'fs';
import path from 'path';

// Simple, clean prompts for reliable generation
const BASE_STYLE = "Professional corporate training visual, clean modern design, smooth camera movement";

// Accent color type
type AccentColor = "emerald" | "sky" | "amber";

// Simple color descriptions
const ACCENT_COLORS = {
  emerald: "green and teal color scheme",
  sky: "blue color scheme",
  amber: "warm orange color scheme"
};

// Build simple, reliable prompt
function buildPrompt(concept: string, accent: AccentColor = "emerald"): string {
  const color = ACCENT_COLORS[accent];
  // Keep prompts under 200 chars for reliability
  const simpleConcept = concept.substring(0, 100);
  return `${BASE_STYLE}, ${color}, ${simpleConcept}`;
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

      // Style reference image - use data URI (Runway supports https://, runway://, or data:image/)
      const stylePath = path.join(process.cwd(), 'public', 'style-frame.png');

      let promptImage: string;

      if (fs.existsSync(stylePath)) {
        // Read existing style frame and convert to data URI
        const imageBuffer = fs.readFileSync(stylePath);
        promptImage = `data:image/png;base64,${imageBuffer.toString('base64')}`;
        console.log('[Runway] Using style-frame.png as data URI');
      } else {
        // Create minimal 1x1 neutral gray PNG as data URI
        // This is a valid PNG with neutral gray color that won't interfere with prompt
        const minimalPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        promptImage = `data:image/png;base64,${minimalPngBase64}`;
        console.log('[Runway] Using minimal placeholder data URI');
      }

      console.log('[Runway] ===== BATCH GENERATION START =====');
      console.log('[Runway] Prompts:', input.prompts.length);
      console.log('[Runway] Duration:', input.seconds, 'seconds');
      console.log('[Runway] Accent:', input.accent);
      console.log('[Runway] Base seed:', baseSeed);

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

        // Try with original prompt first, then fallback to ultra-simple generic prompt on failure
        let prompt = buildPrompt(concept, input.accent);
        let retryAttempt = 0;
        const maxRetries = 1; // Try original + 1 fallback

        while (retryAttempt <= maxRetries) {
          if (retryAttempt > 0) {
            // Fallback to ultra-generic prompt
            const genericPrompts = [
              "office desk with laptop",
              "modern workspace with computer",
              "corporate office interior",
              "business meeting room",
              "professional office space"
            ];
            const fallbackConcept = genericPrompts[i % genericPrompts.length];
            prompt = buildPrompt(fallbackConcept, input.accent);
            console.log(`[Runway] Scene ${i + 1} RETRY ${retryAttempt} with fallback: "${prompt}"`);
          }

          console.log(`\n[Runway] ===== Scene ${i + 1}/${input.prompts.length} ${retryAttempt > 0 ? `(Retry ${retryAttempt})` : ''} =====`);
          console.log(`[Runway]   Concept: "${concept}"`);
          console.log(`[Runway]   Concept length: ${concept.length} chars`);
          console.log(`[Runway]   Seed: ${seed}`);
          console.log(`[Runway]   Generated prompt: "${prompt}"`);
          console.log(`[Runway]   Prompt length: ${prompt.length} chars`);

        try {
          // Prepare request body - promptImage is always required by Runway API (data URI format)
          const requestBody = {
            model: 'gen4_turbo',
            promptImage: promptImage,
            promptText: prompt,
            duration: input.seconds,
            ratio: '1280:720',
            seed
          };

          console.log(`[Runway]   Request body:`);
          console.log(`[Runway]     - model: ${requestBody.model}`);
          console.log(`[Runway]     - promptImage: ${requestBody.promptImage.substring(0, 50)}... (${requestBody.promptImage.length} chars)`);
          console.log(`[Runway]     - promptText: "${requestBody.promptText}"`);
          console.log(`[Runway]     - duration: ${requestBody.duration}`);
          console.log(`[Runway]     - ratio: ${requestBody.ratio}`);
          console.log(`[Runway]     - seed: ${requestBody.seed}`);

          // Start video generation task
          const createRes = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'X-Runway-Version': '2024-11-06'
            },
            body: JSON.stringify(requestBody)
          });

          if (!createRes.ok) {
            const errorText = await createRes.text();
            console.error(`[Runway] Scene ${i + 1} CREATE API error:`, createRes.status, errorText);
            throw new Error(`Runway generation failed for scene ${i + 1}: ${createRes.status} - ${errorText}`);
          }

          const createData = await createRes.json();
          console.log(`[Runway] Scene ${i + 1} create response:`, JSON.stringify(createData, null, 2));

          const taskId = createData.id;
          if (!taskId) {
            console.error(`[Runway] Scene ${i + 1} no task ID in response:`, createData);
            throw new Error(`Runway generation failed for scene ${i + 1}: No task ID returned`);
          }

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
                console.error(`[Runway] Scene ${i + 1} no video URL in response:`, JSON.stringify(statusData, null, 2));
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

              break; // Success! Exit retry loop and polling loop
            } else if (statusData.status === 'FAILED') {
              console.error(`[Runway] Scene ${i + 1} FAILED - Full response:`, JSON.stringify(statusData, null, 2));
              const failureReason = statusData.failure || statusData.failure_reason || statusData.failureReason || statusData.error || 'Unknown error';
              const failureCode = statusData.failureCode || '';

              // Check if this is a BAD_OUTPUT error and we have retries left
              if (failureCode === 'INTERNAL.BAD_OUTPUT.CODE01' && retryAttempt < maxRetries) {
                console.warn(`[Runway] Scene ${i + 1} BAD_OUTPUT error, will retry with simpler prompt`);
                break; // Exit polling loop to retry with fallback prompt
              }

              throw new Error(`Runway generation failed for scene ${i + 1}: ${failureReason} (${failureCode})`);
            }

            attempts++;
          }

          if (attempts >= maxAttempts) {
            throw new Error(`Runway generation timed out for scene ${i + 1} after 5 minutes`);
          }

          // If we successfully completed the video, break out of retry loop
          if (urls.length === i + 1) {
            break; // Success! Exit retry loop
          }
        } catch (error) {
          console.error(`[Runway] Error generating scene ${i + 1}:`, error);
          // If we have retries left and it's a retriable error, continue to next retry
          if (retryAttempt < maxRetries) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg.includes('INTERNAL.BAD_OUTPUT.CODE01')) {
              retryAttempt++;
              continue; // Retry with fallback prompt
            }
          }
          throw error; // Non-retriable error or out of retries
        }

          retryAttempt++; // Increment for next iteration if needed
        } // End retry while loop
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
