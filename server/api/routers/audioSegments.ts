import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { parseBuffer } from 'music-metadata';
import type { Segment } from '../../../remotion/Composition';

export const audioSegmentsRouter = router({
  generateSegments: publicProcedure
    .input(z.object({
      text: z.string().min(10),
      voice: z.enum(['eleven']).default('eleven'),
      language: z.string().default('de')
    }))
    .mutation(async ({ input }) => {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const voiceId = process.env.ELEVEN_VOICE_ID || 'Rachel';

      if (!apiKey) {
        console.error('[AudioSegments] ELEVENLABS_API_KEY missing');
        throw new Error('ELEVENLABS_API_KEY missing');
      }

      console.log('[AudioSegments] Starting segmented TTS generation for', input.text.length, 'characters');

      try {
        // Split text into sentences
        const sentences = input.text
          .split(/(?<=[.!?])\s+/)
          .filter(s => s.trim().length > 0);

        console.log('[AudioSegments] Split into', sentences.length, 'sentences');

        const segments: Segment[] = [];
        let cumulativeTime = 0;
        const padding = 0.3; // 300ms pause between segments

        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i];
          console.log(`[AudioSegments] Processing segment ${i + 1}/${sentences.length}: "${sentence.substring(0, 50)}..."`);

          // Generate TTS for this sentence
          const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              text: sentence,
              model_id: 'eleven_multilingual_v2',
              voice_settings: { stability: 0.5, similarity_boost: 0.7 }
            })
          });

          if (!res.ok) {
            const errorText = await res.text();
            console.error('[AudioSegments] API error for segment', i, ':', res.status, errorText);
            throw new Error(`TTS failed for segment ${i}: ${res.status}`);
          }

          const arrayBuf = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);

          // Detect audio duration using music-metadata
          const metadata = await parseBuffer(buffer, { mimeType: 'audio/mpeg' });
          const duration = metadata.format.duration || 0;

          console.log(`[AudioSegments] Segment ${i + 1} duration:`, duration.toFixed(2), 'seconds');

          // Convert to data URL for inline embedding
          const base64 = buffer.toString('base64');
          const dataUrl = `data:audio/mpeg;base64,${base64}`;

          segments.push({
            text: sentence,
            start: cumulativeTime,
            duration,
            url: dataUrl
          });

          cumulativeTime += duration + padding;
        }

        const totalDuration = cumulativeTime - padding; // Remove last padding
        console.log('[AudioSegments] ===== SEGMENTATION COMPLETE =====');
        console.log('[AudioSegments] Total segments:', segments.length);
        console.log('[AudioSegments] Total duration:', totalDuration.toFixed(2), 'seconds');
        console.log('[AudioSegments] ===== END DEBUG =====');

        return {
          segments,
          totalDuration
        };
      } catch (error) {
        console.error('[AudioSegments] Error:', error);
        throw error;
      }
    })
});
