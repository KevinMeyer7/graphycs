import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import OpenAI from "openai";

const storyboardSchema = z.object({
  title: z.string(),
  language: z.string(),
  intro: z.string(),
  overview: z.array(z.string()).length(3),
  modules: z
    .array(
      z.object({
        title: z.string(),
        points: z.array(z.string()).length(3),
        lottie: z.enum(["office", "checklist", "security"]),
      })
    )
    .length(3),
  summary: z.string(),
  quiz: z
    .array(
      z.object({
        q: z.string(),
        a: z.array(z.string()).length(3),
        correct: z.number().int().min(0).max(2),
      })
    )
    .length(3),
});

export type Storyboard = z.infer<typeof storyboardSchema>;

// Extended storyboard with module concepts for B-roll generation
export type StoryboardWithConcepts = Storyboard & {
  moduleConcepts: string[];
};

// OPTIONAL (if this file can ever run in Next.js Edge, force Node in the route file instead):
// export const runtime = "nodejs";

function safeFingerprint(key: string) {
  const k = key.trim();
  const first = k.slice(0, 8);
  const last = k.slice(-4);
  return `${first}…${last}`;
}

function getOpenAIClient() {
  const rawKey = process.env.OPENAI_API_KEY;
  if (!rawKey) {
    console.warn("No OPENAI_API_KEY in env; using fallback.");
    return null;
  }
  const trimmed = rawKey.trim();

  // Basic sanity on length — project keys are typically ~150+ chars.
  const len = trimmed.length;
  console.log(
    "[OpenAI] Using key fingerprint:",
    safeFingerprint(trimmed),
    "length:",
    len
  );

  // If you (or a lib) set OPENAI_BASE_URL/OPENAI_API_BASE accidentally, this forces the official endpoint.
  return new OpenAI({
    apiKey: trimmed,
    baseURL: "https://api.openai.com/v1",
    // Do NOT set organization/project unless you must. Leaving them unset avoids scope mismatches.
    // organization: undefined,
    // project: undefined,
  });
}

export const structureRouter = router({
  generate: publicProcedure
    .input(
      z.object({
        text: z.string().min(20),
        defaultStyle: z
          .enum(["office", "checklist", "security"])
          .default("office"),
      })
    )
    .mutation(async ({ input }) => {
      const openai = getOpenAIClient();
      if (!openai) {
        return getFallbackStoryboard(input.defaultStyle);
      }

      try {
        // 1) Same-process auth sanity check. If THIS throws 401,
        // your runtime isn't actually reading the same key your curl used.
        const models = await openai.models.list();
        console.log("[OpenAI] models.list() ok, e.g.:", models.data[0]?.id);

        // 2) Now do the real call
        const model = process.env.OPENAI_MODEL || "gpt-4o"; // keep your default

        const response = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are an instructional designer. Structure the policy text into a training storyboard.",
            },
            {
              role: "user",
              content: `Structure the following German policy text into a training storyboard. Prefer lottie="${input.defaultStyle}" for modules when appropriate.\n\nText: ${input.text}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "storyboard",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  language: { type: "string" },
                  intro: { type: "string" },
                  overview: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 3,
                    maxItems: 3,
                  },
                  modules: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        points: {
                          type: "array",
                          items: { type: "string" },
                          minItems: 3,
                          maxItems: 3,
                        },
                        lottie: { type: "string", enum: ["office", "checklist", "security"] },
                      },
                      required: ["title", "points", "lottie"],
                      additionalProperties: false,
                    },
                    minItems: 3,
                    maxItems: 3,
                  },
                  summary: { type: "string" },
                  quiz: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        q: { type: "string" },
                        a: {
                          type: "array",
                          items: { type: "string" },
                          minItems: 3,
                          maxItems: 3,
                        },
                        correct: { type: "integer", minimum: 0, maximum: 2 },
                      },
                      required: ["q", "a", "correct"],
                      additionalProperties: false,
                    },
                    minItems: 3,
                    maxItems: 3,
                  },
                },
                required: ["title", "language", "intro", "overview", "modules", "summary", "quiz"],
                additionalProperties: false,
              },
            },
          },
          temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          console.warn("No content in OpenAI response; using fallback.");
          return getFallbackStoryboard(input.defaultStyle);
        }

        const parsed = storyboardSchema.safeParse(JSON.parse(content));
        if (!parsed.success) {
          console.warn(
            "Invalid schema from OpenAI; using fallback:",
            parsed.error
          );
          return getFallbackStoryboard(input.defaultStyle);
        }

        const storyboard = parsed.data;

        // Generate semantic concepts for B-roll using GPT
        console.log("[OpenAI] Generating semantic concepts for B-roll...");
        try {
          const conceptResponse = await openai.chat.completions.create({
            model,
            messages: [
              {
                role: "system",
                content: `Generate concise visual scene descriptions (<15 words) for video generation.
Use nouns/verbs from the training topic. Focus on visual elements that can be animated.
Do not invent new style words. Return a JSON array of strings, one per module.`
              },
              {
                role: "user",
                content: `Modules: ${JSON.stringify(storyboard.modules.map(m => ({ title: m.title, points: m.points })))}`
              }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "concepts",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    concepts: {
                      type: "array",
                      items: { type: "string" },
                      minItems: 3,
                      maxItems: 3
                    }
                  },
                  required: ["concepts"],
                  additionalProperties: false
                }
              }
            },
            temperature: 0.8
          });

          const conceptContent = conceptResponse.choices[0]?.message?.content;
          if (conceptContent) {
            const conceptData = JSON.parse(conceptContent);
            console.log("[OpenAI] Generated concepts:", conceptData.concepts);
            return {
              ...storyboard,
              moduleConcepts: conceptData.concepts
            } as StoryboardWithConcepts;
          }
        } catch (error) {
          console.warn("[OpenAI] Concept generation failed, using module titles:", error);
        }

        // Fallback: use module titles as concepts
        return {
          ...storyboard,
          moduleConcepts: storyboard.modules.map(m => m.title)
        } as StoryboardWithConcepts;
      } catch (error) {
        console.error("OpenAI API error, using fallback:", error);
        return getFallbackStoryboard(input.defaultStyle);
      }
    }),
});

function getFallbackStoryboard(
  style: "office" | "checklist" | "security"
): StoryboardWithConcepts {
  return {
    title: "DSGVO Essentials",
    language: "de",
    intro: "Warum Datenschutz zählt – Risiken, Vertrauen, Rechtsrahmen.",
    overview: [
      "Begriffe: personenbezogene Daten, Verarbeitung, Verantwortliche/r",
      "Rechtsgrundlagen: Einwilligung, Vertrag, gesetzliche Pflicht",
      "Rechte: Auskunft, Berichtigung, Löschung",
    ],
    modules: [
      {
        title: "Datenminimierung & Zweckbindung",
        points: [
          "Nur erforderliche Daten erfassen",
          "Zweck klar dokumentieren",
          "Regelmäßige Löschfristen umsetzen",
        ],
        lottie: style,
      },
      {
        title: "Einwilligungen korrekt einholen",
        points: [
          "Informiert, freiwillig, nachweisbar",
          "Widerruf jederzeit ermöglichen",
          "Keine Kopplung mit irrelevanten Vorteilen",
        ],
        lottie: style,
      },
      {
        title: "Sicherheitsvorfälle & Meldepflicht",
        points: [
          "Erkennen, dokumentieren, 72-Stunden-Meldung",
          "Kontakt zur Datenschutzbeauftragten Person",
          "Kommunikation mit Betroffenen vorbereiten",
        ],
        lottie: style,
      },
    ],
    summary:
      "Datenschutz ist Teamarbeit: korrekt erheben, sicher verarbeiten, Vorfälle melden.",
    quiz: [
      {
        q: "Was bedeutet Datenminimierung?",
        a: [
          "So viel wie möglich erfassen",
          "Nur notwendige Daten erfassen",
          "Alle Daten verschlüsseln",
        ],
        correct: 1,
      },
      {
        q: "Welche Bedingung gilt für Einwilligungen?",
        a: [
          "Immer stillschweigend",
          "Informiert & nachweisbar",
          "Nur mündlich",
        ],
        correct: 1,
      },
      {
        q: "Frist zur Meldung eines Vorfalls?",
        a: ["72 Stunden", "14 Tage", "Sofort ist nicht notwendig"],
        correct: 0,
      },
    ],
    moduleConcepts: [
      "data minimization checklist with selective collection",
      "consent forms with clear approval process",
      "incident reporting with 72-hour timeline"
    ]
  };
}
