import React from "react";
import { Video } from "remotion";

type KenBurnsVideoProps = {
  src: string;
  zoom?: number;
  panX?: number;
  panY?: number;
  opacity?: number;
  blendMode?: React.CSSProperties["mixBlendMode"];
};

export const KenBurnsVideo: React.FC<KenBurnsVideoProps> = ({
  src,
  zoom = 1.12,
  panX = -30,
  panY = 20,
  opacity = 0.4,
  blendMode = "overlay",
}) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: -20,
        overflow: "hidden",
        opacity,
        mixBlendMode: blendMode,
      }}
    >
      <Video
        src={src}
        loop
        muted
        style={{
          width: "120%",
          height: "120%",
          objectFit: "cover",
          transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
          filter: "saturate(0.9) contrast(1.05)",
        }}
      />
    </div>
  );
};
