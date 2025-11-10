"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { createTRPCReact } from "@trpc/react-query";
import { z } from "zod";

// UI (shadcn)
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

// Icons
import {
  Play,
  Pause,
  Wand2,
  AudioLines,
  Film,
  Loader2,
  CheckCircle2,
  Download,
} from "lucide-react";

// Remotion + Lottie preview
import { Player } from "@remotion/player";
import { GraphycsComposition } from "@/remotion/Composition";
import type { Segment } from "@/remotion/Composition";

/**
 * STEP 1.1 — shadcn UI + tRPC + Remotion Player + Lottie + OpenAI Responses API (GPT‑5)
 * -------------------------------------------------------------------------------------
 * What changed:
 *  - Uses **GPT‑5** (or OPENAI_MODEL env override) via Responses API + JSON schema
 *  - Adds a visual **progress bar + stepper** while generating
 *  - Keeps fallback path if API fails (demo never stalls)
 *
 * ENV:
 *  - OPENAI_API_KEY (required)
 *  - OPENAI_MODEL (optional, default 'gpt-4o' — will use gpt-5 when available)
 */

// ---------- Types shared client/server ----------
export type Module = {
  title: string;
  points: string[];
  lottie: "office" | "checklist" | "security";
};
export type Storyboard = {
  title: string;
  language: string;
  intro: string;
  overview: string[];
  modules: Module[];
  summary: string;
  quiz: { q: string; a: string[]; correct: number }[];
};

// ---------- tRPC client ----------
export const trpc = createTRPCReact<import("@/trpc-types").AppRouter>();
const queryClient = new QueryClient();
function TRPCProvider({ children }: { children: React.ReactNode }) {
  return (
    <trpc.Provider
      client={trpc.createClient({
        links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
        transformer: superjson,
      })}
      queryClient={queryClient}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

// ---------- UI ----------
const SAMPLE_TEXT = `Die DSGVO schützt personenbezogene Daten. Mitarbeitende müssen verstehen: Welche Daten erfassen wir? Rechtsgrundlage? Einwilligung? Vorfallsmeldung? Fehler vermeiden durch Minimierung, Prozesse, Schulungen.`;

function Stepper({ step }: { step: number }) {
  const steps = ["Sende an GPT", "Erhalte JSON", "Szene-Komposition", "Bereit"];
  const pct = [10, 45, 80, 100][Math.min(step, 3)];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-1 ${
              i <= step ? "text-emerald-600" : "text-gray-400"
            }`}
          >
            {i < step ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            <span>{s}</span>
            {i < steps.length - 1 && (
              <span className="mx-2 text-gray-300">›</span>
            )}
          </div>
        ))}
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function DemoPage() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [style, setStyle] = useState<Module["lottie"]>("office");
  const generate = trpc.structure.generate.useMutation();
  const tts = trpc.audio.tts.useMutation();
  const audioSegments = trpc.audioSegments.generateSegments.useMutation();
  const video = trpc.video.generateBrollClips.useMutation();

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioSeconds, setAudioSeconds] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [brollClips, setBrollClips] = useState<Array<{brollUrl: string; metadata: any}> | null>(null);
  const [useSegmented, setUseSegmented] = useState(false);
  const [useBroll, setUseBroll] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  // Local progress stepper while the mutation is inflight
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (generate.isPending) {
      setStep(0);
      const a = setTimeout(() => setStep(1), 300);
      const b = setTimeout(() => setStep(2), 900);
      const c = setTimeout(() => setStep(3), 1600);
      return () => {
        clearTimeout(a);
        clearTimeout(b);
        clearTimeout(c);
      };
    }
  }, [generate.isPending]);

  const story = generate.data as Storyboard | undefined;

  // Measure audio length when we receive it
  useEffect(() => {
    console.log("===== AUDIO URL CHANGED =====");
    console.log("New audioUrl:", audioUrl);
    if (!audioUrl) {
      console.log("audioUrl is null, skipping duration measurement");
      return;
    }
    console.log("Creating Audio element to measure duration");
    const audio = new window.Audio(audioUrl);
    const onLoaded = () => {
      console.log("Audio metadata loaded, duration:", audio.duration);
      setAudioSeconds(audio.duration || null);
    };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", (e) => {
      console.error("Error loading audio for duration measurement:", e);
      console.error("Audio error:", audio.error);
    });
    return () => {
      console.log("Cleaning up audio duration measurement listener");
      audio.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [audioUrl]);

  const fps = 30;
  const fallbackFrames = (story?.modules?.length || 3) * 4 * fps;
  const durationInFrames = audioSeconds
    ? Math.ceil(audioSeconds * fps)
    : fallbackFrames;

  const handleGenerateVoice = async () => {
    if (!story) return alert("Generate storyboard first.");

    if (useSegmented) {
      // Segmented mode with voice-driven timing
      const narration = [
        story.intro,
        ...story.overview,
        ...story.modules.flatMap((m) => m.points),
        story.summary,
      ].join(" ");

      console.log("[Segmented] Generating voice segments...");
      const res = await audioSegments.mutateAsync({
        text: narration,
        voice: "eleven",
        language: story.language || "de",
      });

      if (!res?.segments) {
        return alert("Segmented TTS failed - no segments");
      }

      console.log("[Segmented] Generated", res.segments.length, "segments");
      setSegments(res.segments);
      setAudioSeconds(res.totalDuration);
    } else {
      // Single-pass mode
      const narration = [
        story.intro,
        ...story.overview,
        ...story.modules.flatMap((m) => m.points),
        story.summary,
      ].join("\n");

      console.log("[TTS] Generating single audio track...");
      const res = await tts.mutateAsync({
        text: narration,
        voice: "eleven",
        language: story.language || "de",
      });

      if (!res?.audioUrl) {
        console.error("[TTS] No audioUrl in response!");
        return alert("TTS failed - no audioUrl");
      }

      console.log("[TTS] Audio URL:", res.audioUrl);
      setAudioUrl(res.audioUrl);
    }
  };

  const handleGenerateBroll = async () => {
    if (!story) return alert("Generate storyboard first.");

    // Get semantic concepts from story (generated by GPT-5)
    const moduleConcepts = (story as any).moduleConcepts || story.modules.map(m => m.title);

    // Generate concepts for ALL slides: intro + modules + summary
    const allConcepts = [
      story.intro, // Intro slide
      ...moduleConcepts, // Module slides
      story.summary // Summary slide
    ];

    const allTitles = [
      story.title, // Intro
      ...story.modules.map(m => m.title), // Modules
      'Summary' // Summary
    ];

    console.log("[Broll] Generating", allConcepts.length, "B-roll clips (one per slide)");
    console.log("[Broll] Concepts:", allConcepts);
    console.log("[Broll] Titles:", allTitles);

    const res = await video.mutateAsync({
      concepts: allConcepts,
      moduleTitles: allTitles,
      accentColor: 'emerald',
      duration: 6
    });

    if (!res?.clips || res.clips.length === 0) {
      return alert("B-roll generation failed");
    }

    console.log("[Broll] Generated", res.totalClips, "clips");
    res.clips.forEach((clip, i) => {
      console.log(`[Broll] Clip ${i + 1}:`, clip.metadata);
    });
    setBrollClips(res.clips);
  };

  const handleRenderMP4 = async () => {
    if (!story) return alert("Generate storyboard first.");

    setIsRendering(true);
    try {
      console.log("[Render] Starting MP4 export...");
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyboard: story,
          audioUrl,
          brollClips: useBroll ? brollClips : null,
          segments: useSegmented ? segments : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Render failed");
      }

      const result = await response.json();
      console.log("[Render] Success:", result.videoUrl);

      // Download the video
      const a = document.createElement("a");
      a.href = result.videoUrl;
      a.download = `${story.title.replace(/\s+/g, "_")}.mp4`;
      a.click();

      alert(
        `Video rendered successfully! Duration: ${result.duration.toFixed(1)}s`
      );
    } catch (error) {
      console.error("[Render] Error:", error);
      alert(
        `Render failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsRendering(false);
    }
  };

  const handleTestAudio = () => {
    if (!audioUrl) return alert("Generate voice first.");

    console.log("===== TEST AUDIO DEBUG =====");
    console.log("audioUrl:", audioUrl);
    console.log("Current playing state:", isPlaying);
    console.log("audioRef.current exists:", !!audioRef.current);

    if (isPlaying && audioRef.current) {
      console.log("PAUSING audio");
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (audioRef.current) {
      console.log("STOPPING and resetting existing audio");
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    console.log("CREATING new Audio element with URL:", audioUrl);
    const audio = new window.Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      console.log("Audio metadata loaded - duration:", audio.duration);
    });

    audio.addEventListener("canplay", () => {
      console.log("Audio can play");
    });

    audio.addEventListener("error", (e) => {
      console.error("Audio error event:", e);
      console.error("Audio error details:", audio.error);
    });

    audio.addEventListener("ended", () => {
      console.log("Audio playback ended");
      setIsPlaying(false);
    });

    console.log("STARTING audio playback...");
    audio
      .play()
      .then(() => {
        console.log("Audio playback started successfully");
        setIsPlaying(true);
      })
      .catch((err) => {
        console.error("Audio playback FAILED:", err);
        console.error("Error name:", err.name);
        console.error("Error message:", err.message);
        setIsPlaying(false);
        alert("Audio playback failed. Check console for details.");
      });

    console.log("===== END TEST AUDIO DEBUG =====");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Graphycs v2{" "}
        </h1>
        <div className="flex gap-2">
          <Button
            onClick={() => generate.mutate({ text, defaultStyle: style })}
            className="gap-2"
            disabled={generate.isPending}
          >
            {generate.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            {generate.isPending ? "Generating…" : "Generate"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              document
                .getElementById("preview")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Play className="w-4 h-4" />
            Preview
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-24 space-y-8">
        <Card className="p-6 rounded-2xl shadow-sm space-y-3">
          <Label>1) Paste policy text</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="font-mono"
          />
          <div className="flex items-center gap-3 pt-2">
            <Label className="text-sm">Comic Pack</Label>
            <Select
              value={style}
              onValueChange={(v) => setStyle(v as Module["lottie"])}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office">Office</SelectItem>
                <SelectItem value="checklist">Checklist</SelectItem>
                <SelectItem value="security">Security</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="p-6 rounded-2xl shadow-sm">
          <h2 className="text-xl font-semibold mb-3">2) Script</h2>
          {generate.isIdle && !story && (
            <p className="text-sm text-gray-500">
              Click Generate to structure the storyboard via OpenAI (JSON schema
              enforced).
            </p>
          )}
          {generate.isPending && <Stepper step={step} />}
          {story && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold">Intro:</span> {story.intro}
              </div>
              <div>
                <span className="font-semibold">Overview:</span>
                <ul className="list-disc ml-5">
                  {story.overview.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="font-semibold">Modules:</span>
                <ol className="list-decimal ml-5 space-y-2">
                  {story.modules.map((m, i) => (
                    <li key={i}>
                      <span className="font-medium">{m.title}</span> — style{" "}
                      <code>{m.lottie}</code>
                      <ul className="list-disc ml-5">
                        {m.points.map((p, j) => (
                          <li key={j}>{p}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <span className="font-semibold">Summary:</span> {story.summary}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6 rounded-2xl shadow-sm space-y-3">
          <h2 className="text-xl font-semibold mb-3">3) Advanced Features</h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Checkbox
                id="segmented"
                checked={useSegmented}
                onCheckedChange={(checked) => setUseSegmented(!!checked)}
              />
              <Label htmlFor="segmented" className="cursor-pointer">
                Segmented TTS (voice-driven timing with music-metadata)
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="broll"
                checked={useBroll}
                onCheckedChange={(checked) => setUseBroll(!!checked)}
              />
              <Label htmlFor="broll" className="cursor-pointer">
                Generate B-roll with Runway Gen-4 Turbo
              </Label>
            </div>
          </div>
        </Card>

        <Card id="preview" className="p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">4) Preview & Export</h2>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleGenerateVoice}
                disabled={!story || tts.isPending || audioSegments.isPending}
              >
                {tts.isPending || audioSegments.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <AudioLines className="w-4 h-4" />
                )}
                {tts.isPending || audioSegments.isPending
                  ? "Generating Voice…"
                  : "Add Voice"}
              </Button>
              {useBroll && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleGenerateBroll}
                  disabled={!story || video.isPending}
                >
                  {video.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Film className="w-4 h-4" />
                  )}
                  {video.isPending ? "Generating B-roll…" : "Add B-roll"}
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleTestAudio}
                disabled={!audioUrl && !segments}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {isPlaying ? "Pause Audio" : "Test Audio"}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleRenderMP4}
                disabled={!story || isRendering}
              >
                {isRendering ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isRendering ? "Rendering MP4…" : "Render MP4"}
              </Button>
            </div>
          </div>
          {(audioUrl || segments) && (
            <div className="text-xs text-emerald-600">
              Voice attached.{" "}
              {useSegmented
                ? `${segments?.length} segments`
                : `Duration ${
                    audioSeconds ? audioSeconds.toFixed(1) + "s" : "…"
                  }`}
              {brollClips && ` • ${brollClips.length} B-roll clips ready`}
            </div>
          )}
          {story ? (
            <Player
              key={`${audioUrl || segments?.[0]?.url || "no-audio"}-${
                brollClips?.map(c => c.brollUrl).join(',') || "no-broll"
              }`}
              component={GraphycsComposition}
              inputProps={{
                storyboard: story,
                audioUrl: useSegmented ? null : audioUrl,
                brollClips: useBroll ? brollClips || undefined : undefined,
                segments: useSegmented ? segments || undefined : undefined,
              }}
              durationInFrames={durationInFrames}
              compositionWidth={1280}
              compositionHeight={720}
              fps={30}
              controls
              allowFullscreen
              clickToPlay
              showVolumeControls
              initiallyMuted={false}
              numberOfSharedAudioTags={20}
              style={{
                width: "100%",
                maxWidth: "800px",
                aspectRatio: "16/9",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
              }}
            />
          ) : (
            <div className="text-sm text-gray-500">
              Generate a script to see the composition.
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <TRPCProvider>
      <DemoPage />
    </TRPCProvider>
  );
}
