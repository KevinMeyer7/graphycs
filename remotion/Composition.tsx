import React from "react";
import { AbsoluteFill, Sequence, Html5Audio, Video, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import Lottie from "lottie-react";
import { CrossFade } from "./transitions";
import { LoopedBroll } from "./LoopedBroll";
import { Grade } from "./Grade";

export type Module = { title: string; points: string[]; lottie: "office" | "checklist" | "security" };
export type Storyboard = {
  title: string;
  language: string;
  intro: string;
  overview: string[];
  modules: Module[];
  summary: string;
  quiz: { q: string; a: string[]; correct: number }[];
};
export type Segment = { text: string; start: number; duration: number; url: string };
export type BrollClip = { brollUrl: string; metadata: any };

const LOADING_BUBBLES = {
  v: "5.7.8",
  fr: 30,
  ip: 0,
  op: 120,
  w: 200,
  h: 120,
  nm: "bubbles",
  ddd: 0,
  assets: [],
  layers: Array.from({ length: 4 }).map((_, i) => ({
    ddd: 0,
    ind: i + 1,
    ty: 4,
    sr: 1,
    ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [40 + i * 40, 60, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
    shapes: [
      { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [16, 16] }, d: 1 },
      { ty: "fl", c: { a: 0, k: [0.1, 0.6, 0.95, 1] }, o: { a: 0, k: 100 }, r: 1 },
    ],
    ip: 0,
    op: 120,
    st: 0,
    bm: 0,
  })),
} as any;

const lottieMap: Record<Module["lottie"], any> = {
  office: LOADING_BUBBLES,
  checklist: LOADING_BUBBLES,
  security: LOADING_BUBBLES,
};

// Crossfade overlap duration (frames)
const HANDLE = 12;

// Motion helper
const fadeInUp = (delayFrames = 0, dist = 20) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const prog = spring({ frame: frame - delayFrames, fps, config: { damping: 200, mass: 0.8 } });
  const y = interpolate(prog, [0, 1], [dist, 0]);
  const o = interpolate(prog, [0, 1], [0, 1]);
  return { transform: `translateY(${y}px)`, opacity: o } as React.CSSProperties;
};

// B-roll layer with crossfade and color normalization
const BrollLayer: React.FC<{
  brollUrl: string;
  opacity?: number;
  blur?: number;
  crossfadeDuration?: number;
  moduleIndex?: number; // Added for unique Video keys
}> = ({ brollUrl, opacity = 0.22, blur = 0, crossfadeDuration = 15, moduleIndex = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Crossfade in at start
  const fadeIn = interpolate(frame, [0, crossfadeDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Crossfade out at end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - crossfadeDuration, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const combinedOpacity = opacity * fadeIn * fadeOut;

  return (
    <AbsoluteFill
      style={{
        opacity: combinedOpacity,
        mixBlendMode: "multiply",
        filter: `brightness(1.05) saturate(0.95) hue-rotate(-5deg) blur(${blur}px)`,
      }}
    >
      {/* Use unique key based on URL to prevent React reuse */}
      <Video
        key={`broll-${moduleIndex}-${brollUrl}`}
        src={brollUrl}
        loop
        volume={0}
      />
    </AbsoluteFill>
  );
};

const IntroScene: React.FC<{ title: string; brollUrl?: string; moduleIndex?: number }> = ({ title, brollUrl, moduleIndex = 0 }) => (
  <AbsoluteFill style={{ background: "#0b1220", color: "white" }}>
    {brollUrl && <LoopedBroll src={brollUrl} opacity={0.18} blur={2} />}
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <h1 style={{ fontSize: 72, letterSpacing: -1, ...fadeInUp(0) }}>{title}</h1>
    </AbsoluteFill>
  </AbsoluteFill>
);

const ModuleScene: React.FC<{
  title: string;
  points: string[];
  lottie: Module["lottie"];
  brollUrl?: string;
  moduleIndex?: number;
}> = ({ title, points, lottie, brollUrl, moduleIndex = 0 }) => (
  <AbsoluteFill style={{ background: "#ffffff" }}>
    {brollUrl && <LoopedBroll src={brollUrl} opacity={0.22} />}
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", height: "100%" }}>
      <div style={{ padding: 56 }}>
        <h1 style={{ fontSize: 48, marginBottom: 12, ...fadeInUp(0) }}>{title}</h1>
        <ul style={{ fontSize: 28, lineHeight: 1.45 }}>
          {points.map((p, j) => (
            <li key={j} style={fadeInUp(6 + j * 4)}>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 280, height: 190 }}>
          <Lottie animationData={lottieMap[lottie]} loop autoplay />
        </div>
      </div>
    </div>
  </AbsoluteFill>
);

const SummaryScene: React.FC<{ text: string; brollUrl?: string; moduleIndex?: number }> = ({ text, brollUrl, moduleIndex = 0 }) => (
  <AbsoluteFill style={{ background: "#0b1220", color: "white" }}>
    {brollUrl && <LoopedBroll src={brollUrl} opacity={0.18} blur={2} />}
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ maxWidth: 900, textAlign: "center" }}>
        <h2 style={{ fontSize: 40, marginBottom: 14, ...fadeInUp(0) }}>Zusammenfassung</h2>
        <p style={{ fontSize: 26, lineHeight: 1.5, ...fadeInUp(6) }}>{text}</p>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

export const GraphycsComposition: React.FC<{
  storyboard: Storyboard;
  audioUrl?: string | null;
  brollUrls?: string[]; // Simplified: just an array of URLs
  segments?: Segment[];
}> = ({ storyboard, audioUrl, brollUrls, segments }) => {
  const fps = 30;

  // Helper to get B-roll URL by slide type
  // URL array structure: [intro, module1, module2, module3, summary]
  const getBrollForSlide = (slideType: 'intro' | 'module' | 'summary', moduleIndex: number = 0): string | undefined => {
    if (!brollUrls) return undefined;

    let clipIndex: number;
    if (slideType === 'intro') {
      clipIndex = 0; // First clip is intro
    } else if (slideType === 'summary') {
      clipIndex = brollUrls.length - 1; // Last clip is summary
    } else {
      clipIndex = 1 + moduleIndex; // Modules start at index 1
    }

    const url = brollUrls[clipIndex];
    if (url) {
      console.log(`[Composition] ${slideType} ${moduleIndex} (clip ${clipIndex}) B-roll URL:`, url.substring(0, 80) + '...');
    }
    return url;
  };

  // Debug logging
  if (brollUrls) {
    console.log(`[Composition] Total B-roll clips available: ${brollUrls.length}`);
    console.log(`[Composition] Expected: intro + ${storyboard.modules.length} modules + summary = ${1 + storyboard.modules.length + 1} clips`);
    brollUrls.forEach((url, i) => {
      const label = i === 0 ? 'Intro' : i === brollUrls.length - 1 ? 'Summary' : `Module ${i}`;
      console.log(`[Composition] Clip ${i} (${label}):`, url.substring(0, 80) + '...');
    });
  }

  if (segments?.length) {
    // Voice-driven segmented timing with per-slide B-roll
    return (
      <AbsoluteFill>
        {/* Intro */}
        <Sequence from={0} durationInFrames={Math.round(2 * fps)}>
          <IntroScene title={storyboard.title} brollUrl={getBrollForSlide('intro')} moduleIndex={0} />
        </Sequence>
        {segments.map((s, i) => {
          const moduleIdx = i < storyboard.overview.length
            ? 0
            : Math.min(i - storyboard.overview.length, storyboard.modules.length - 1);

          return (
            <Sequence key={i} from={Math.round(s.start * fps)} durationInFrames={Math.round(s.duration * fps)}>
              <Html5Audio src={s.url} />
              {/* Map segments to scenes */}
              {i < storyboard.overview.length ? (
                <ModuleScene
                  title={"Überblick"}
                  points={[s.text]}
                  lottie={"checklist"}
                  brollUrl={getBrollForSlide('intro')}
                  moduleIndex={0}
                />
              ) : i < storyboard.overview.length + storyboard.modules.length ? (
                <ModuleScene
                  title={storyboard.modules[moduleIdx]?.title || "Modul"}
                  points={storyboard.modules[moduleIdx]?.points || [s.text]}
                  lottie={storyboard.modules[moduleIdx]?.lottie || "office"}
                  brollUrl={getBrollForSlide('module', moduleIdx)}
                  moduleIndex={1 + moduleIdx}
                />
              ) : (
                <SummaryScene
                  text={storyboard.summary}
                  brollUrl={getBrollForSlide('summary')}
                  moduleIndex={1 + storyboard.modules.length}
                />
              )}
            </Sequence>
          );
        })}

        {/* Global color grade overlay */}
        <Grade duotoneTint="#10b981" />
      </AbsoluteFill>
    );
  }

  // Single-pass audio fallback with per-slide B-roll and overlapped timeline
  const perScene = 4 * fps;
  const effectiveDuration = perScene - HANDLE; // Each scene starts HANDLE frames before previous ends

  return (
    <AbsoluteFill>
      {audioUrl ? <Html5Audio src={audioUrl} /> : null}
      <Sequence from={0} durationInFrames={perScene}>
        <IntroScene title={storyboard.title} brollUrl={getBrollForSlide('intro')} moduleIndex={0} />
      </Sequence>
      {storyboard.modules.map((m, i) => (
        <Sequence key={i} from={(i + 1) * effectiveDuration} durationInFrames={perScene}>
          <ModuleScene
            title={m.title}
            points={m.points}
            lottie={m.lottie}
            brollUrl={getBrollForSlide('module', i)}
            moduleIndex={1 + i}
          />
        </Sequence>
      ))}
      <Sequence from={(storyboard.modules.length + 1) * effectiveDuration} durationInFrames={perScene}>
        <SummaryScene
          text={storyboard.summary}
          brollUrl={getBrollForSlide('summary')}
          moduleIndex={1 + storyboard.modules.length}
        />
      </Sequence>

      {/* Global color grade overlay */}
      <Grade duotoneTint="#10b981" />
    </AbsoluteFill>
  );
};
