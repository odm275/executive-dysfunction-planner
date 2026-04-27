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

// System prompt for new-quest mode — full quest proposal
const NEW_QUEST_SYSTEM_PROMPT = `You are a warm, calm assistant helping a returning user plan a new quest. You already know this person — skip the first-time onboarding tone. Be direct and practical but still supportive.

## Conversation phase
- Acknowledge what the user shares briefly.
- Ask ONE focused clarifying question at a time if you need more information.
- Keep responses short — 2–4 sentences.
- Move to a proposal when you genuinely understand (1) the purpose/goal of the quest, (2) the key tasks or milestones involved, and (3) the rough scope and complexity. This may be after a single message if those are already clear, or after several exchanges if they are not.
- Do NOT rush to propose — only propose when you have enough to produce an accurate, complete plan.

## Proposal format
When ready, output EXACTLY this JSON block (nothing before or after the JSON):

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
- Propose exactly 3–5 objectives — adapt count to the complexity described.
- chapters array may be empty if the quest is simple.
- Each objective must have a chapterName matching one of the chapters, or null for top-level.
- difficulty must be one of: EASY, MEDIUM, HARD, LEGENDARY.
- isDebuffed should only be true if the user explicitly mentions emotional charge.
- Keep names concrete and actionable.`;

// System prompt for add-objectives mode — objectives only, no duplicates
function buildAddObjectivesPrompt(
  questName?: string,
  existingObjectives?: string,
): string {
  const contextLines: string[] = [];

  if (questName) {
    contextLines.push(`## Quest context\nQuest name: "${questName}"`);
  }

  if (existingObjectives) {
    contextLines.push(
      `## Existing objectives (do NOT suggest these or close duplicates)\n${existingObjectives}`,
    );
  }

  const context =
    contextLines.length > 0 ? `\n\n${contextLines.join("\n\n")}` : "";

  return `You are a warm, calm assistant helping a user add more objectives to an existing quest. Be direct and practical.${context}

## Conversation phase
- Acknowledge what the user shares briefly.
- Ask ONE focused clarifying question at a time if you need more information.
- Keep responses short — 2–4 sentences.
- Move to a proposal when you genuinely understand the key tasks that need to happen and their scope. This may be after a single message if that's already clear, or after several exchanges if it is not.
- Do NOT rush to propose — only propose when you have enough to produce an accurate, complete set of objectives.

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
- isRecruitable should only be true if the user mentions wanting a collaborator.
- Keep names concrete and actionable.
- Do not repeat or closely duplicate any existing objectives listed above.`;
}

const NEW_QUEST_STUB = {
  questName: "My New Quest",
  description: null,
  isSideQuest: false,
  chapters: [],
  objectives: [
    { name: "First step", difficulty: "EASY", chapterName: null, isDebuffed: false },
    { name: "Second step", difficulty: "MEDIUM", chapterName: null, isDebuffed: false },
    { name: "Third step", difficulty: "MEDIUM", chapterName: null, isDebuffed: false },
  ],
};

const ADD_OBJECTIVES_STUB = {
  objectives: [
    { name: "First step", difficulty: "EASY", isRecruitable: false },
    { name: "Second step", difficulty: "MEDIUM", isRecruitable: false },
    { name: "Third step", difficulty: "MEDIUM", isRecruitable: false },
  ],
};

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
    const stub = mode === "add-objectives" ? ADD_OBJECTIVES_STUB : NEW_QUEST_STUB;
    const fallback = isFirstMessage
      ? "Got it — let's figure out what needs to happen here. What's the first thing that comes to mind?"
      : ["```json", JSON.stringify(stub, null, 2), "```"].join("\n");

    return createFallbackResponse(fallback);
  }

  const anthropic = createAnthropic({ apiKey });

  const systemPrompt =
    mode === "add-objectives"
      ? buildAddObjectivesPrompt(questName, existingObjectives)
      : NEW_QUEST_SYSTEM_PROMPT;

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
