import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { writeFileSync } from 'fs';
import { join } from 'path';

export const audioRouter = router({
  tts: publicProcedure
    .input(z.object({
      text: z.string().min(10),
      voice: z.enum(['eleven']).default('eleven'),
      language: z.string().default('de')
    }))
    .mutation(async ({ input }) => {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const voiceId = process.env.ELEVEN_VOICE_ID || 'Rachel';

      if (!apiKey) {
        console.error('ELEVENLABS_API_KEY missing');
        throw new Error('ELEVENLABS_API_KEY missing');
      }

      console.log('[ElevenLabs] Generating TTS for', input.text.length, 'characters, voice:', voiceId);

      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: input.text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.7 }
          })
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error('[ElevenLabs] API error:', res.status, errorText);
          throw new Error(`TTS failed: ${res.status} - ${errorText}`);
        }

        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        // Save to public folder with timestamp to prevent caching issues
        const filename = `narration-${Date.now()}.mp3`;
        const publicPath = join(process.cwd(), 'public', filename);

        console.log('[ElevenLabs] ===== AUDIO SAVE DEBUG =====');
        console.log('[ElevenLabs] Buffer size:', buffer.length, 'bytes');
        console.log('[ElevenLabs] Filename:', filename);
        console.log('[ElevenLabs] Full path:', publicPath);
        console.log('[ElevenLabs] CWD:', process.cwd());

        writeFileSync(publicPath, buffer);

        // Verify file was written
        const fs = require('fs');
        const fileExists = fs.existsSync(publicPath);
        const fileSize = fileExists ? fs.statSync(publicPath).size : 0;

        console.log('[ElevenLabs] File exists after write:', fileExists);
        console.log('[ElevenLabs] File size after write:', fileSize, 'bytes');

        const audioUrl = `/${filename}`;
        console.log('[ElevenLabs] Returning audioUrl:', audioUrl);
        console.log('[ElevenLabs] ===== END DEBUG =====');

        return { audioUrl };
      } catch (error) {
        console.error('[ElevenLabs] Error:', error);
        throw error;
      }
    })
});
