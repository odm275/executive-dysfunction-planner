import { createDataStreamResponse, streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { type NextRequest } from "next/server";
import { getSession } from "~/server/better-auth/server";

export const runtime = "nodejs";

function createFallbackResponse(content: string) {
  return createDataStreamResponse({
    execute(dataStream) {
      dataStream.write(`0:${JSON.stringify(content)}\n`);
    },
  });
}

const ONBOARDING_SYSTEM_PROMPT = `You are a warm, calm assistant helping someone with executive dysfunction turn their thoughts into a structured quest plan.

Your goal is to have a brief, supportive conversation, then produce a structured quest proposal.

## Conversation phase
- Start by acknowledging what the user shares. Be warm, not clinical.
- Ask ONE clarifying question at a time if needed (e.g., "Is there a deadline?", "What's the first step that comes to mind?").
- Keep your responses short — 2–4 sentences.
- After 2–3 exchanges (or when you have enough information), produce a structured proposal.

## Proposal format
When you're ready to propose a quest, output EXACTLY this JSON block (nothing before, nothing after the JSON):

\`\`\`json
{
  "questName": "Short, clear quest name",
  "description": "Optional one-line description or null",
  "isSideQuest": false,
  "chapters": [
    { "name": "Chapter name" }
  ],
  "objectives": [
    {
      "name": "Objective name",
      "difficulty": "EASY|MEDIUM|HARD|LEGENDARY",
      "chapterName": "Chapter name or null",
      "isDebuffed": false
    }
  ]
}
\`\`\`

Rules for the proposal:
- chapters array may be empty if the quest is simple
- Each objective must have a chapterName matching one of the chapters, or null for top-level
- difficulty must be one of: EASY, MEDIUM, HARD, LEGENDARY
- isDebuffed should only be true if the user explicitly mentions the objective is emotionally charged
- Keep it realistic: 3–8 objectives is ideal`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const { messages } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Graceful fallback when no key is configured
    const isFirstMessage = messages.length <= 1;
    const fallback = isFirstMessage
      ? "Thanks for sharing that. It sounds like there's a lot going on. Let me help you break this down into something manageable. What feels like the most important piece to start with?"
      : [
          "```json",
          JSON.stringify(
            {
              questName: "My First Quest",
              description: "Getting started",
              isSideQuest: false,
              chapters: [],
              objectives: [
                {
                  name: "First step",
                  difficulty: "EASY",
                  chapterName: null,
                  isDebuffed: false,
                },
                {
                  name: "Next step",
                  difficulty: "MEDIUM",
                  chapterName: null,
                  isDebuffed: false,
                },
              ],
            },
            null,
            2,
          ),
          "```",
        ].join("\n");

    return createFallbackResponse(fallback);
  }

  const anthropic = createAnthropic({ apiKey });

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: ONBOARDING_SYSTEM_PROMPT,
    messages,
  });

  return result.toDataStreamResponse();
}
