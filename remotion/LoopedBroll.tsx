import React from "react";
import { AbsoluteFill, Video, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

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
 * LoopedBroll: Silky-smooth self-crossfading video background
 *
 * - Uses easeInOut easing for buttery smooth crossfades
 * - Crossfades last frames with first frames for seamless looping
 * - Applies subtle color normalization for consistency
 * - Supports opacity, blur, and blend modes
 */
export const LoopedBroll: React.FC<LoopedBrollProps> = ({
  src,
  opacity = 0.22,
  blur = 0,
  blendMode = "multiply",
  crossfadeFrames = 20, // Increased for smoother fade
  desaturate = 0.05, // 5% desaturation by default
  luminanceClamp = [0.95, 1.05], // Slight brightness normalization
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // Calculate crossfade opacity with smooth easing
  const isInCrossfadeZone = frame >= durationInFrames - crossfadeFrames;

  let crossfadeOpacity = 1;
  if (isInCrossfadeZone) {
    // Use easeInOut for silky smooth transition
    crossfadeOpacity = interpolate(
      frame,
      [durationInFrames - crossfadeFrames, durationInFrames],
      [1, 0],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.42, 0, 0.58, 1), // Smooth easeInOut curve
      }
    );
  }

  // Fade in at the start for smooth entry
  const fadeInFrames = Math.min(15, durationInFrames / 4);
  const fadeIn = interpolate(
    frame,
    [0, fadeInFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.ease),
    }
  );

  // Build color normalization filter
  const saturation = 1 - desaturate; // 0.95 = 5% desaturation
  const [minBrightness, maxBrightness] = luminanceClamp;
  const brightness = (minBrightness + maxBrightness) / 2; // Average for now

  const colorFilter = `brightness(${brightness}) saturate(${saturation})`;
  const blurFilter = blur > 0 ? `blur(${blur}px)` : "";
  const combinedFilter = [colorFilter, blurFilter].filter(Boolean).join(" ");

  // Combined opacity: fade in * crossfade * base opacity
  const finalOpacity = opacity * fadeIn * crossfadeOpacity;

  return (
    <>
      {/* Main looped video layer with smooth transitions */}
      <AbsoluteFill
        style={{
          opacity: finalOpacity,
          mixBlendMode: blendMode,
          filter: combinedFilter,
          transition: "opacity 0.1s ease-out", // Micro-smooth opacity changes
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
            opacity: opacity * fadeIn * (1 - crossfadeOpacity),
            mixBlendMode: blendMode,
            filter: combinedFilter,
            transition: "opacity 0.1s ease-out",
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
