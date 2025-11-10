import { router } from './trpc';
import { structureRouter } from './routers/structure';
import { audioRouter } from './routers/audio';
import { audioSegmentsRouter } from './routers/audioSegments';
import { videoRouter } from './routers/video';

export const appRouter = router({
  structure: structureRouter,
  audio: audioRouter,
  audioSegments: audioSegmentsRouter,
  video: videoRouter
});

export type AppRouter = typeof appRouter;
