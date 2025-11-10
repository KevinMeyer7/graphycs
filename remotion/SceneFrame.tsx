import React from "react";
import { AbsoluteFill, useCurrentFrame, Easing, interpolate } from "remotion";
import { theme } from "./theme";
import { MotionTrail } from "./transitions";

type SceneFrameProps = {
  kicker?: string;
  title: string;
  body?: string;
  bullets?: string[];
  tag?: string;
  accent?: string;
  right?: React.ReactNode;
};

export const SceneFrame: React.FC<SceneFrameProps> = ({
  kicker,
  title,
  body,
  bullets,
  tag,
  accent = theme.colors.primary,
  right,
}) => {
  const frame = useCurrentFrame();
  const stagger = (index: number, offset = 6) =>
    interpolate(
      frame,
      [offset + index * 4, offset + index * 4 + 12],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.33, 1, 0.68, 1),
      }
    );

  return (
    <AbsoluteFill style={{ padding: 80 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.1fr",
          gap: 48,
          height: "100%",
        }}
      >
        <div
          style={{
            background: theme.colors.card,
            borderRadius: theme.radii.lg,
            padding: 48,
            boxShadow: theme.shadows.floating,
            display: "flex",
            flexDirection: "column",
            gap: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(120deg, rgba(16,185,129,0.08), rgba(56,189,248,0.05))`,
              opacity: 0.8,
            }}
          />

          <div style={{ position: "relative", zIndex: 2 }}>
            {tag && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 14px",
                  borderRadius: theme.radii.sm,
                  background: theme.colors.primarySoft,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: 0.4,
                  opacity: stagger(0),
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "999px",
                    background: accent,
                    boxShadow: theme.shadows.glow,
                  }}
                />
                {tag}
              </div>
            )}

            {kicker && (
              <p
                style={{
                  marginTop: 12,
                  color: theme.colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontWeight: 600,
                  fontSize: 15,
                  fontFamily: theme.fonts.body,
                  opacity: stagger(1),
                }}
              >
                {kicker}
              </p>
            )}

            <MotionTrail frames={4} intensity={0.15}>
              <h1
                style={{
                  marginTop: 12,
                  fontSize: 54,
                  lineHeight: 1.05,
                  fontWeight: 700,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.display,
                  opacity: stagger(2),
                }}
              >
                {title}
              </h1>
            </MotionTrail>

            {body && (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 22,
                  lineHeight: 1.5,
                  color: theme.colors.textMuted,
                  fontFamily: theme.fonts.body,
                  opacity: stagger(3),
                }}
              >
                {body}
              </p>
            )}
          </div>

          {bullets && (
            <div style={{ position: "relative", zIndex: 2 }}>
              <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: "none", display: "grid", gap: 16 }}>
                {bullets.map((bullet, index) => (
                  <li
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      fontSize: 22,
                      color: theme.colors.text,
                      fontFamily: theme.fonts.body,
                      opacity: stagger(4 + index),
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "999px",
                        background: accent,
                        boxShadow: theme.shadows.glow,
                      }}
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div
          style={{
            borderRadius: theme.radii.lg,
            position: "relative",
            overflow: "hidden",
            background: theme.colors.cardMuted,
            boxShadow: theme.shadows.floating,
          }}
        >
          <AbsoluteFill
            style={{
              inset: 0,
              padding: 32,
            }}
          >
            {right}
          </AbsoluteFill>
        </div>
      </div>
    </AbsoluteFill>
  );
};
