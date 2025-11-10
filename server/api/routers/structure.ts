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
        defaultStyle: z.enum(["office", "checklist", "security"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const openai = getOpenAIClient();
      if (!openai) {
        return getFallbackStoryboard();
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
                "You are an instructional designer. Structure the policy text into an engaging training storyboard. IMPORTANT: All output must be in English.",
            },
            {
              role: "user",
              content: `Structure the following policy text into a training storyboard in English. Create clear, concise content optimized for video narration.\n\nText: ${input.text}`,
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
                      },
                      required: ["title", "points"],
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
          return getFallbackStoryboard();
        }

        const parsed = storyboardSchema.safeParse(JSON.parse(content));
        if (!parsed.success) {
          console.warn(
            "Invalid schema from OpenAI; using fallback:",
            parsed.error
          );
          return getFallbackStoryboard();
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
                content: `Generate simple, clear visual scene descriptions (<15 words) for reliable AI video generation.
Focus on generic, professional corporate environments: modern offices, clean workspaces, simple data visualizations, neutral backgrounds.
AVOID dramatic, artistic, or complex imagery. AVOID weather effects, dramatic lighting, or abstract concepts.
Use straightforward, simple language. Keep descriptions minimal and generic.
Return a JSON array of strings, one per module, plus intro and summary concepts.`
              },
              {
                role: "user",
                content: `Intro: ${storyboard.intro}\n\nModules: ${JSON.stringify(storyboard.modules.map(m => ({ title: m.title, points: m.points })))}\n\nSummary: ${storyboard.summary}`
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
                      minItems: 5,
                      maxItems: 5
                    }
                  },
                  required: ["concepts"],
                  additionalProperties: false
                }
              }
            },
            temperature: 0.3
          });

          const conceptContent = conceptResponse.choices[0]?.message?.content;
          if (conceptContent) {
            const conceptData = JSON.parse(conceptContent);
            console.log("[OpenAI] Generated B-roll concepts:", conceptData.concepts);
            return {
              ...storyboard,
              moduleConcepts: conceptData.concepts
            } as StoryboardWithConcepts;
          }
        } catch (error) {
          console.warn("[OpenAI] Concept generation failed, using fallback concepts:", error);
        }

        // Fallback: use intro + module titles + summary as concepts
        return {
          ...storyboard,
          moduleConcepts: [
            storyboard.intro,
            ...storyboard.modules.map(m => m.title),
            storyboard.summary
          ]
        } as StoryboardWithConcepts;
      } catch (error) {
        console.error("OpenAI API error, using fallback:", error);
        return getFallbackStoryboard();
      }
    }),
});

function getFallbackStoryboard(): StoryboardWithConcepts {
  return {
    title: "GDPR Essentials",
    language: "en",
    intro: "Why data protection matters – risks, trust, legal framework.",
    overview: [
      "Terms: personal data, processing, data controller",
      "Legal bases: consent, contract, legal obligation",
      "Rights: access, rectification, erasure",
    ],
    modules: [
      {
        title: "Data Minimization & Purpose Limitation",
        points: [
          "Collect only necessary data",
          "Clearly document purpose",
          "Implement regular deletion schedules",
        ],
      },
      {
        title: "Obtaining Consent Correctly",
        points: [
          "Informed, voluntary, demonstrable",
          "Enable withdrawal at any time",
          "No coupling with irrelevant benefits",
        ],
      },
      {
        title: "Security Incidents & Reporting Obligations",
        points: [
          "Detect, document, 72-hour notification",
          "Contact data protection officer",
          "Prepare communication with affected parties",
        ],
      },
    ],
    summary:
      "Data protection is teamwork: collect correctly, process securely, report incidents.",
    quiz: [
      {
        q: "What does data minimization mean?",
        a: [
          "Collect as much as possible",
          "Collect only necessary data",
          "Encrypt all data",
        ],
        correct: 1,
      },
      {
        q: "Which condition applies to consent?",
        a: [
          "Always implied",
          "Informed & demonstrable",
          "Only verbal",
        ],
        correct: 1,
      },
      {
        q: "Deadline for reporting an incident?",
        a: ["72 hours", "14 days", "Immediate reporting not necessary"],
        correct: 0,
      },
    ],
    moduleConcepts: [
      "clean modern office with data screens",
      "professional workspace with documents",
      "simple digital interface with buttons",
      "corporate meeting room with laptops",
      "organized desk with business materials"
    ]
  };
}
