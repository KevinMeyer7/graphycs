import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";

type TimelineProps = {
  sceneDurations: number[];
};

export const Timeline: React.FC<TimelineProps> = ({ sceneDurations }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = Math.min(frame / durationInFrames, 1);

  const total = sceneDurations.reduce((acc, val) => acc + val, 0);
  const cumulative = sceneDurations.reduce<number[]>((acc, val, idx) => {
    const prev = acc[idx - 1] || 0;
    return [...acc, prev + val];
  }, []);

  return (
    <AbsoluteFill
      style={{
        top: "auto",
        height: 80,
        padding: "0 80px 40px",
        background: "linear-gradient(180deg, rgba(5,7,13,0) 0%, rgba(5,7,13,0.65) 70%)",
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        style={{
          width: "100%",
          height: 8,
          borderRadius: 999,
          background: "rgba(255,255,255,0.18)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scaleX(${progress})`,
            transformOrigin: "left",
            background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.accent})`,
            borderRadius: 999,
            boxShadow: theme.shadows.glow,
          }}
        />

        {cumulative.map((value, idx) => {
          const markerProgress = value / total;
          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: `${markerProgress * 100}%`,
                top: -6,
                width: 2,
                height: 20,
                background: "rgba(255,255,255,0.4)",
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
