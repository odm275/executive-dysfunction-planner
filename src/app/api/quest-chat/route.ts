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

const BASE_SYSTEM_PROMPT = `You are a warm, calm assistant helping someone manage their ongoing quests and objectives. You already know this user — skip the onboarding tone. Be concise and practical.

## Conversation phase
- Acknowledge what the user shares with warmth but briefly.
- Ask ONE clarifying question at a time if needed.
- Keep responses short — 2–4 sentences.
- After a focused 2–4 message exchange, produce a structured proposal.

## Proposal format
When ready, output EXACTLY this JSON block (nothing before or after the JSON):

\`\`\`json
{
  "objectives": [
    {
      "name": "Objective name",
      "difficulty": "EASY|MEDIUM|HARD|LEGENDARY",
      "isRecruitable": false
    }
  ]
}
\`\`\`

Rules for the proposal:
- Propose exactly 3–5 objectives — no fewer, no more.
- difficulty must be one of: EASY, MEDIUM, HARD, LEGENDARY.
- isRecruitable should only be true if the user mentions wanting a collaborator for that item.
- Keep names concrete and actionable.`;

function buildSystemPrompt(
  mode: string,
  questName?: string,
  existingObjectives?: string,
): string {
  if (mode !== "add-objectives") return BASE_SYSTEM_PROMPT;

  const contextLines: string[] = [];

  if (questName) {
    contextLines.push(`## Quest context\nQuest name: "${questName}"`);
  }

  if (existingObjectives) {
    contextLines.push(
      `## Existing objectives (do NOT suggest these or close duplicates)\n${existingObjectives}`,
    );
  }

  if (contextLines.length === 0) return BASE_SYSTEM_PROMPT;

  return `${BASE_SYSTEM_PROMPT}\n\n${contextLines.join("\n\n")}`;
}

const STUB_OBJECTIVES = [
  { name: "First step", difficulty: "EASY", isRecruitable: false },
  { name: "Second step", difficulty: "MEDIUM", isRecruitable: false },
  { name: "Third step", difficulty: "MEDIUM", isRecruitable: false },
];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    mode?: string;
    questName?: string;
    existingObjectives?: string;
  };

  const { messages, mode = "new-quest", questName, existingObjectives } = body;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const isFirstMessage = messages.length <= 1;
    const fallback = isFirstMessage
      ? "Got it — let's figure out what needs to happen here. What's the first thing that comes to mind when you think about this?"
      : [
          "```json",
          JSON.stringify({ objectives: STUB_OBJECTIVES }, null, 2),
          "```",
        ].join("\n");

    return createFallbackResponse(fallback);
  }

  const anthropic = createAnthropic({ apiKey });

  const systemPrompt = buildSystemPrompt(mode, questName, existingObjectives);

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
