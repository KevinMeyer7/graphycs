import React from "react";
import { AbsoluteFill } from "remotion";

type GradeProps = {
  vignetteIntensity?: number; // 0-1, strength of vignette darkening
  duotoneTint?: string; // Optional brand color tint (hex color)
  duotoneIntensity?: number; // 0-1, strength of duotone effect
};

/**
 * Grade: Global color grading overlay for polished look
 *
 * - Adds subtle vignette (radial gradient darkening at edges)
 * - Optional brand duotone tint for color consistency
 * - Applied at top level of composition
 */
export const Grade: React.FC<GradeProps> = ({
  vignetteIntensity = 0.15, // Subtle by default
  duotoneTint,
  duotoneIntensity = 0.08, // Very subtle duotone
}) => {
  return (
    <>
      {/* Vignette layer */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle, transparent 40%, rgba(0, 0, 0, ${vignetteIntensity}) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Duotone tint layer (optional) */}
      {duotoneTint && (
        <AbsoluteFill
          style={{
            backgroundColor: duotoneTint,
            opacity: duotoneIntensity,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
};
