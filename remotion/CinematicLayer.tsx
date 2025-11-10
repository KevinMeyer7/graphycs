import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";

type CinematicLayerProps = {
  children: React.ReactNode;
  durationInFrames: number;
  enterFrames?: number;
  exitFrames?: number;
};

export const CinematicLayer: React.FC<CinematicLayerProps> = ({
  children,
  durationInFrames,
  enterFrames = 36,
  exitFrames = 36,
}) => {
  const frame = useCurrentFrame();

  const effectiveEnter = Math.min(enterFrames, durationInFrames / 2);
  const effectiveExit = Math.min(exitFrames, durationInFrames / 2);

  const fadeIn = interpolate(
    frame,
    [0, effectiveEnter],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.22, 0.61, 0.36, 1),
    }
  );

  const fadeOut = interpolate(
    frame,
    [durationInFrames - effectiveExit, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    }
  );

  const opacity = fadeIn * fadeOut;

  return (
    <AbsoluteFill
      style={{
        opacity,
        transition: "opacity 0.2s ease-out",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
