import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/**
 * Equal-power crossfade curve
 * Maintains constant perceived brightness during fade
 */
const equalPowerCurve = (progress: number): number => {
  return Math.sqrt(progress);
};

/**
 * CrossFade: Equal-power curve fade between two elements
 *
 * Usage:
 * <CrossFade durationFrames={12}>
 *   <ElementA />
 *   <ElementB />
 * </CrossFade>
 */
export const CrossFade: React.FC<{
  children: [React.ReactNode, React.ReactNode];
  durationFrames?: number;
}> = ({ children, durationFrames = 12 }) => {
  const frame = useCurrentFrame();
  const [elementA, elementB] = children;

  // Calculate crossfade progress (0 to 1)
  const progress = interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Equal-power curve for A (fading out) and B (fading in)
  const opacityA = equalPowerCurve(1 - progress);
  const opacityB = equalPowerCurve(progress);

  return (
    <>
      <AbsoluteFill style={{ opacity: opacityA }}>{elementA}</AbsoluteFill>
      <AbsoluteFill style={{ opacity: opacityB }}>{elementB}</AbsoluteFill>
    </>
  );
};

/**
 * DipToColor: Fade to a color, then back to content
 *
 * Usage:
 * <DipToColor color="#000000" durationFrames={24}>
 *   <MyContent />
 * </DipToColor>
 */
export const DipToColor: React.FC<{
  children: React.ReactNode;
  color?: string;
  durationFrames?: number;
}> = ({ children, color = "#000000", durationFrames = 24 }) => {
  const frame = useCurrentFrame();
  const halfDuration = durationFrames / 2;

  let colorOpacity = 0;
  if (frame < halfDuration) {
    // Fade to color (first half)
    colorOpacity = interpolate(frame, [0, halfDuration], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else {
    // Fade from color back to content (second half)
    colorOpacity = interpolate(frame, [halfDuration, durationFrames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return (
    <>
      <AbsoluteFill>{children}</AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundColor: color,
          opacity: colorOpacity,
        }}
      />
    </>
  );
};

/**
 * MotionTrail: Subtle motion blur tail effect
 *
 * Creates layered semi-transparent copies with slight offsets
 * to simulate motion blur
 *
 * Usage:
 * <MotionTrail frames={3} intensity={0.3}>
 *   <MovingElement />
 * </MotionTrail>
 */
export const MotionTrail: React.FC<{
  children: React.ReactNode;
  frames?: number;
  intensity?: number; // 0-1, affects opacity of trail
}> = ({ children, frames = 3, intensity = 0.3 }) => {
  const currentFrame = useCurrentFrame();

  return (
    <>
      {/* Render trail layers (from oldest to newest) */}
      {Array.from({ length: frames }).map((_, i) => {
        const trailOpacity = intensity * ((i + 1) / frames); // Gradual fade
        const offsetX = -((frames - i) * 2); // Slight horizontal offset

        return (
          <AbsoluteFill
            key={i}
            style={{
              opacity: trailOpacity,
              transform: `translateX(${offsetX}px)`,
              filter: "blur(1px)",
            }}
          >
            {children}
          </AbsoluteFill>
        );
      })}

      {/* Main element (no trail) */}
      <AbsoluteFill>{children}</AbsoluteFill>
    </>
  );
};

/**
 * Wipe: Directional reveal transition
 *
 * Usage:
 * <Wipe direction="left" durationFrames={20}>
 *   <ElementA />
 *   <ElementB />
 * </Wipe>
 */
export const Wipe: React.FC<{
  children: [React.ReactNode, React.ReactNode];
  direction?: "left" | "right" | "up" | "down";
  durationFrames?: number;
}> = ({ children, direction = "left", durationFrames = 20 }) => {
  const frame = useCurrentFrame();
  const [elementA, elementB] = children;

  const progress = interpolate(frame, [0, durationFrames], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Calculate clip-path based on direction
  let clipPath = "";
  switch (direction) {
    case "left":
      clipPath = `inset(0 ${100 - progress}% 0 0)`;
      break;
    case "right":
      clipPath = `inset(0 0 0 ${100 - progress}%)`;
      break;
    case "up":
      clipPath = `inset(${100 - progress}% 0 0 0)`;
      break;
    case "down":
      clipPath = `inset(0 0 ${100 - progress}% 0)`;
      break;
  }

  return (
    <>
      {/* Base layer (elementA) */}
      <AbsoluteFill>{elementA}</AbsoluteFill>

      {/* Wipe layer (elementB) */}
      <AbsoluteFill style={{ clipPath }}>{elementB}</AbsoluteFill>
    </>
  );
};
