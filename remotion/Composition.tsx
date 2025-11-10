import React from "react";
import { AbsoluteFill, Sequence, Html5Audio, Video, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { CrossFade } from "./transitions";
import { LoopedBroll } from "./LoopedBroll";
import { Grade } from "./Grade";

export type Module = { title: string; points: string[] };
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

// Scene components
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
  brollUrl?: string;
  moduleIndex?: number;
}> = ({ title, points, brollUrl, moduleIndex = 0 }) => (
  <AbsoluteFill style={{ background: "#ffffff" }}>
    {brollUrl && <LoopedBroll src={brollUrl} opacity={0.25} />}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 80 }}>
      <div style={{ maxWidth: 1100 }}>
        <h1 style={{ fontSize: 56, marginBottom: 24, fontWeight: 700, ...fadeInUp(0) }}>{title}</h1>
        <ul style={{ fontSize: 32, lineHeight: 1.6, listStyleType: "disc", paddingLeft: 40 }}>
          {points.map((p, j) => (
            <li key={j} style={{ marginBottom: 16, ...fadeInUp(6 + j * 4) }}>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </AbsoluteFill>
);

const SummaryScene: React.FC<{ text: string; brollUrl?: string; moduleIndex?: number }> = ({ text, brollUrl, moduleIndex = 0 }) => (
  <AbsoluteFill style={{ background: "#0b1220", color: "white" }}>
    {brollUrl && <LoopedBroll src={brollUrl} opacity={0.18} blur={2} />}
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ maxWidth: 900, textAlign: "center" }}>
        <h2 style={{ fontSize: 40, marginBottom: 14, ...fadeInUp(0) }}>Summary</h2>
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
                  title={"Overview"}
                  points={[s.text]}
                  brollUrl={getBrollForSlide('intro')}
                  moduleIndex={0}
                />
              ) : i < storyboard.overview.length + storyboard.modules.length ? (
                <ModuleScene
                  title={storyboard.modules[moduleIdx]?.title || "Module"}
                  points={storyboard.modules[moduleIdx]?.points || [s.text]}
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
