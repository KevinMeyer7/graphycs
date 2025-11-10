import { Composition } from 'remotion';
import { GraphycsComposition, Storyboard, Segment } from './Composition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GraphycsComposition"
        component={GraphycsComposition}
        durationInFrames={300} // Default 10 seconds @ 30fps, will be overridden by inputProps
        fps={30}
        width={1280}
        height={720}
        defaultProps={{
          storyboard: {
            title: 'Default Title',
            language: 'en',
            intro: 'Introduction',
            overview: ['Point 1', 'Point 2', 'Point 3'],
            modules: [
              { title: 'Module 1', points: ['A', 'B', 'C'] },
              { title: 'Module 2', points: ['D', 'E', 'F'] },
              { title: 'Module 3', points: ['G', 'H', 'I'] },
            ],
            summary: 'Summary',
            quiz: [
              { q: 'Q1', a: ['A', 'B', 'C'], correct: 0 },
              { q: 'Q2', a: ['A', 'B', 'C'], correct: 1 },
              { q: 'Q3', a: ['A', 'B', 'C'], correct: 2 },
            ],
          },
        }}
        calculateMetadata={({ props }) => {
          const fps = 30;
          let durationInFrames: number;

          if (props.segments && props.segments.length > 0) {
            // Calculate total duration from segments
            const totalDuration = props.segments.reduce((acc: number, seg: Segment) => {
              return Math.max(acc, seg.start + seg.duration);
            }, 0);
            durationInFrames = Math.ceil(totalDuration * fps) + 30; // Add 1 second buffer
            console.log(`[Remotion] Duration from segments: ${totalDuration}s = ${durationInFrames} frames`);
          } else {
            const modules = props.storyboard?.modules ?? [];
            const handle = 12;
            const baseDurations = [
              fps * 4, // intro
              fps * 4, // overview
              ...modules.map(() => fps * 4.5),
              fps * 5, // summary
            ];
            const runtimeDurations = baseDurations.map((duration, idx) =>
              idx === baseDurations.length - 1 ? duration : duration - handle
            );
            durationInFrames = runtimeDurations.reduce((acc, val) => acc + val, 0);
            console.log(`[Remotion] Duration from fallback: ${runtimeDurations.length} scenes = ${durationInFrames} frames`);
          }

          return {
            durationInFrames,
            fps,
          };
        }}
      />
    </>
  );
};
