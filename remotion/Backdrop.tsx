import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { theme } from "./theme";

type BackdropProps = {
  accent?: string;
};

const buildGrid = (size: number) =>
  `linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px) ${size}px,
   linear-gradient(0deg, rgba(255,255,255,0.04) 1px, transparent 1px) ${size}px`;

export const Backdrop: React.FC<BackdropProps> = ({ accent = theme.colors.primary }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulse = interpolate(
    frame,
    [0, fps * 4],
    [0, 1],
    {
      extrapolateRight: "extend",
      easing: Easing.bezier(0.42, 0, 0.2, 1),
    }
  );

  const driftX = interpolate(frame, [0, fps * 12], [0, -50], { extrapolateRight: "extend" });
  const driftY = interpolate(frame, [0, fps * 12], [0, 60], { extrapolateRight: "extend" });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 20% 20%, rgba(16,185,129,${0.35 + pulse * 0.2}), transparent 55%),
                     radial-gradient(circle at 80% 30%, rgba(56,189,248,${0.25 + pulse * 0.15}), transparent 65%),
                     ${theme.colors.background}`,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          opacity: 0.35,
          backgroundImage: buildGrid(80),
          backgroundSize: "120px 120px, 120px 120px",
          transform: `translate(${driftX}px, ${driftY}px)`,
          filter: "blur(0.4px)",
        }}
      />

      <AbsoluteFill
        style={{
          background: `linear-gradient(140deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.7) 60%)`,
        }}
      />

      <AbsoluteFill
        style={{
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "70%",
            height: "70%",
            borderRadius: "40%",
            filter: "blur(120px)",
            opacity: 0.25,
            background: accent,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
