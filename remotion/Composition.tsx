import React from "react";
import { AbsoluteFill, Sequence, Html5Audio, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { Grade } from "./Grade";
import { Backdrop } from "./Backdrop";
import { SceneFrame } from "./SceneFrame";
import { Timeline } from "./Timeline";
import { KenBurnsVideo } from "./KenBurnsVideo";
import { theme } from "./theme";

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

// Motion helper
const fadeInUp = (delayFrames = 0, dist = 20) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const prog = spring({ frame: frame - delayFrames, fps, config: { damping: 200, mass: 0.8 } });
  const y = interpolate(prog, [0, 1], [dist, 0]);
  const o = interpolate(prog, [0, 1], [0, 1]);
  return { transform: `translateY(${y}px)`, opacity: o } as React.CSSProperties;
};

export const GraphycsComposition: React.FC<{
  storyboard: Storyboard;
  audioUrl?: string | null;
  brollUrls?: string[]; // Simplified: just an array of URLs
  segments?: Segment[];
}> = ({ storyboard, audioUrl, brollUrls, segments }) => {
  const fps = 30;
  const HANDLE = 12;

  const introBroll = brollUrls?.[0];
  const moduleClip = (index: number) => brollUrls ? brollUrls[index + 1] : undefined;
  const summaryBroll = brollUrls ? brollUrls[brollUrls.length - 1] : undefined;

  const scenePlan = [
    {
      id: "intro",
      tag: "Executive Briefing",
      kicker: "Why it matters",
      title: storyboard.title,
      body: storyboard.intro,
      bullets: storyboard.overview,
      broll: introBroll,
    },
    {
      id: "overview",
      tag: "Module Overview",
      kicker: "Learning path",
      title: "What we cover next",
      bullets: storyboard.overview,
      body: "High-level modules to align your team.",
      broll: moduleClip(0) ?? introBroll,
    },
    ...storyboard.modules.map((module, index) => ({
      id: `module-${index}`,
      tag: `Module ${index + 1}`,
      kicker: "Key decisions",
      title: module.title,
      bullets: module.points,
      body: undefined,
      broll: moduleClip(index),
    })),
    {
      id: "summary",
      tag: "Summary",
      kicker: "Takeaways",
      title: "Commitment to action",
      body: storyboard.summary,
      bullets: storyboard.quiz.map((q) => q.q),
      broll: summaryBroll,
    },
  ];

  const sceneDurations = scenePlan.map((scene) => {
    if (scene.id === "intro") return fps * 4;
    if (scene.id.startsWith("module")) return fps * 4.5;
    if (scene.id === "summary") return fps * 5;
    return fps * 4;
  });

  const runtimeDurations = sceneDurations.map((duration, index) =>
    index === sceneDurations.length - 1 ? duration : duration - HANDLE
  );

  const renderInsight = (sceneIndex: number) => {
    const scene = scenePlan[sceneIndex];
    const statValue =
      sceneIndex === 0
        ? "90%"
        : scene.id === "summary"
        ? "72h"
        : `${scene.bullets?.length ?? 3} pts`;

    const statLabel =
      sceneIndex === 0
        ? "Engagement lift"
        : scene.id === "summary"
        ? "Incident window"
        : "Action items";

    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 24,
          overflow: "hidden",
          background: "rgba(15,23,42,0.75)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 28,
          color: "white",
          fontFamily: theme.fonts.body,
        }}
      >
        {scene.broll && <KenBurnsVideo src={scene.broll} opacity={0.45} />}
        <div style={{ position: "relative", zIndex: 2 }}>
          <p style={{ opacity: 0.8, fontSize: 16, letterSpacing: 1 }}>{statLabel}</p>
          <h3 style={{ fontSize: 58, marginTop: 8, fontFamily: theme.fonts.display }}>{statValue}</h3>
        </div>
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: 10 }}>
          {(scene.bullets ?? []).slice(0, 2).map((bullet, idx) => (
            <div
              key={idx}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                background: "rgba(0,0,0,0.45)",
                fontSize: 16,
              }}
            >
              {bullet}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (segments?.length) {
    return (
      <AbsoluteFill>
        <Backdrop />
        {segments.map((segment, idx) => {
          const sceneIndex = Math.min(idx, scenePlan.length - 1);
          const descriptor = scenePlan[sceneIndex];
          return (
            <Sequence key={idx} from={Math.round(segment.start * fps)} durationInFrames={Math.round(segment.duration * fps)}>
              <Html5Audio src={segment.url} />
              <SceneFrame
                tag={descriptor.tag}
                kicker={descriptor.kicker}
                title={descriptor.title}
                bullets={[segment.text]}
                right={renderInsight(sceneIndex)}
              />
            </Sequence>
          );
        })}
        <Grade duotoneTint="#10b981" />
      </AbsoluteFill>
    );
  }

  const sceneOffsets: number[] = [];
  runtimeDurations.reduce((acc, duration) => {
    sceneOffsets.push(acc);
    return acc + duration;
  }, 0);

  return (
    <AbsoluteFill>
      <Backdrop />
      {audioUrl ? <Html5Audio src={audioUrl} /> : null}
      {scenePlan.map((scene, index) => (
        <Sequence key={scene.id} from={sceneOffsets[index]} durationInFrames={sceneDurations[index]}>
          <SceneFrame
            tag={scene.tag}
            kicker={scene.kicker}
            title={scene.title}
            body={scene.body}
            bullets={scene.bullets}
            right={renderInsight(index)}
          />
        </Sequence>
      ))}
      <Timeline sceneDurations={runtimeDurations} />
      <Grade duotoneTint="#10b981" />
    </AbsoluteFill>
  );
};
