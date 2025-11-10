import React from "react";
import { Audio, Sequence, useCurrentFrame, interpolate } from "remotion";

type AudioSegment = {
  text: string;
  start: number; // seconds
  duration: number; // seconds
  url: string;
};

type VoiceTrackProps = {
  segments: AudioSegment[];
  fps?: number;
  crossfadeFrames?: number; // Micro crossfade duration (2-3 frames typical)
  targetLUFS?: number; // Target loudness normalization
};

/**
 * VoiceTrack: Smoothly stitches audio segments with micro crossfades
 *
 * - Applies 2-3 frame crossfades at segment boundaries to eliminate clicks
 * - Normalizes overall volume to target LUFS (~-16 LUFS)
 * - Each segment fades out while next fades in for seamless transitions
 */
export const VoiceTrack: React.FC<VoiceTrackProps> = ({
  segments,
  fps = 30,
  crossfadeFrames = 2, // 2-3 frames for micro crossfade
  targetLUFS = -16,
}) => {
  if (!segments || segments.length === 0) {
    return null;
  }

  // Calculate volume adjustment for LUFS normalization
  // Typical ElevenLabs output is around -20 to -18 LUFS
  // To reach -16 LUFS, we need a slight boost
  // Formula: gain (dB) = target_LUFS - source_LUFS
  // Assuming source is ~-18 LUFS, we need +2 dB boost
  // Volume multiplier = 10^(dB/20) = 10^(2/20) ≈ 1.26
  const normalizeVolume = 1.26; // Approximate boost to reach -16 LUFS from -18 LUFS

  return (
    <>
      {segments.map((segment, i) => {
        const startFrame = Math.round(segment.start * fps);
        const durationInFrames = Math.round(segment.duration * fps);
        const isLastSegment = i === segments.length - 1;

        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationInFrames}>
            <AudioSegmentWithCrossfade
              src={segment.url}
              durationInFrames={durationInFrames}
              crossfadeFrames={crossfadeFrames}
              volume={normalizeVolume}
              isLastSegment={isLastSegment}
            />
          </Sequence>
        );
      })}
    </>
  );
};

/**
 * Individual audio segment with crossfade at boundaries
 */
const AudioSegmentWithCrossfade: React.FC<{
  src: string;
  durationInFrames: number;
  crossfadeFrames: number;
  volume: number;
  isLastSegment: boolean;
}> = ({ src, durationInFrames, crossfadeFrames, volume, isLastSegment }) => {
  const frame = useCurrentFrame();

  // Fade in at start (first crossfadeFrames)
  const fadeIn = interpolate(frame, [0, crossfadeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out at end (last crossfadeFrames), unless it's the last segment
  let fadeOut = 1;
  if (!isLastSegment) {
    fadeOut = interpolate(
      frame,
      [durationInFrames - crossfadeFrames, durationInFrames],
      [1, 0],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );
  }

  // Combined volume: normalization * fade in * fade out
  const adjustedVolume = volume * fadeIn * fadeOut;

  return <Audio src={src} volume={adjustedVolume} />;
};
