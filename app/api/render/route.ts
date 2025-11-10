import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Storyboard, Segment, BrollClip } from '../../../remotion/Composition';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { storyboard, audioUrl, brollClips, segments } = body as {
      storyboard: Storyboard;
      audioUrl?: string | null;
      brollClips?: BrollClip[] | null;
      segments?: Segment[];
    };

    if (!storyboard) {
      return NextResponse.json({ error: 'Missing storyboard data' }, { status: 400 });
    }

    console.log('[Render] Starting MP4 export...');
    console.log('[Render] Storyboard title:', storyboard.title);
    console.log('[Render] Modules:', storyboard.modules.length);
    console.log('[Render] Has audio:', !!audioUrl);
    console.log('[Render] B-roll clips:', brollClips?.length || 0);
    console.log('[Render] Has segments:', !!segments?.length);

    // Bundle the Remotion project
    const bundleLocation = await bundle({
      entryPoint: join(process.cwd(), 'remotion/index.ts'),
      webpackOverride: (config) => config,
    });

    console.log('[Render] Bundle created at:', bundleLocation);

    // Get composition details
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'GraphycsComposition',
      inputProps: { storyboard, audioUrl, brollClips, segments },
    });

    console.log('[Render] Composition selected:', composition.id);
    console.log('[Render] Duration in frames:', composition.durationInFrames);
    console.log('[Render] FPS:', composition.fps);
    console.log('[Render] Dimensions:', `${composition.width}x${composition.height}`);

    // Ensure output directory exists
    const outputDir = join(process.cwd(), 'public', 'renders');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Generate output filename
    const filename = `video-${Date.now()}.mp4`;
    const outputPath = join(outputDir, filename);

    console.log('[Render] Starting render to:', outputPath);

    // Render the video
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: { storyboard, audioUrl, brollClips, segments },
      onProgress: ({ progress, renderedFrames, encodedFrames }) => {
        console.log(
          `[Render] Progress: ${(progress * 100).toFixed(1)}% | ` +
          `Rendered: ${renderedFrames}/${composition.durationInFrames} | ` +
          `Encoded: ${encodedFrames}/${composition.durationInFrames}`
        );
      },
    });

    const videoUrl = `/renders/${filename}`;

    console.log('[Render] ===== RENDER COMPLETE =====');
    console.log('[Render] Output file:', outputPath);
    console.log('[Render] Public URL:', videoUrl);
    console.log('[Render] ===== END DEBUG =====');

    return NextResponse.json({
      success: true,
      videoUrl,
      duration: composition.durationInFrames / composition.fps,
    });
  } catch (error) {
    console.error('[Render] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Render failed' },
      { status: 500 }
    );
  }
}
