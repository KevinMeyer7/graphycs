import React from "react";
import { AbsoluteFill, Video, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

type LoopedBrollProps = {
  src: string;
  opacity?: number;
  blur?: number;
  blendMode?: React.CSSProperties["mixBlendMode"];
  crossfadeFrames?: number;
  desaturate?: number; // 0-1, how much to desaturate
  luminanceClamp?: [number, number]; // [min, max] brightness clamp
};

/**
 * LoopedBroll: Self-crossfading video background with color normalization
 *
 * - Crossfades last ~12 frames with first frames for seamless looping
 * - Applies color normalization (desaturation, luminance clamp)
 * - Supports opacity, blur, and blendMode props
 */
export const LoopedBroll: React.FC<LoopedBrollProps> = ({
  src,
  opacity = 0.22,
  blur = 0,
  blendMode = "multiply",
  crossfadeFrames = 12,
  desaturate = 0.05, // 5% desaturation by default
  luminanceClamp = [0.95, 1.05], // Slight brightness normalization
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Calculate crossfade opacity for seamless loop
  // The video loops naturally, but we crossfade the end with the beginning
  const isInCrossfadeZone = frame >= durationInFrames - crossfadeFrames;

  let crossfadeOpacity = 1;
  if (isInCrossfadeZone) {
    // Fade out the current loop iteration
    crossfadeOpacity = interpolate(
      frame,
      [durationInFrames - crossfadeFrames, durationInFrames],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  }

  // Build color normalization filter
  const saturation = 1 - desaturate; // 0.95 = 5% desaturation
  const [minBrightness, maxBrightness] = luminanceClamp;
  const brightness = (minBrightness + maxBrightness) / 2; // Average for now

  const colorFilter = `brightness(${brightness}) saturate(${saturation})`;
  const blurFilter = blur > 0 ? `blur(${blur}px)` : "";
  const combinedFilter = [colorFilter, blurFilter].filter(Boolean).join(" ");

  return (
    <>
      {/* Main looped video layer */}
      <AbsoluteFill
        style={{
          opacity: opacity * crossfadeOpacity,
          mixBlendMode: blendMode,
          filter: combinedFilter,
        }}
      >
        <Video
          src={src}
          loop
          volume={0}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {/* Crossfade overlay: shows beginning of video during end crossfade */}
      {isInCrossfadeZone && (
        <AbsoluteFill
          style={{
            opacity: opacity * (1 - crossfadeOpacity),
            mixBlendMode: blendMode,
            filter: combinedFilter,
          }}
        >
          <Video
            src={src}
            loop
            volume={0}
            startFrom={0} // Start from beginning
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      )}
    </>
  );
};
