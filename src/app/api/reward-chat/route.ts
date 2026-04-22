import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { type NextRequest } from "next/server";
import { getSession } from "~/server/better-auth/server";

export const runtime = "nodejs";

const SYSTEM_PROMPTS: Record<"HARD" | "LEGENDARY", string> = {
  HARD: `You are a warm, enthusiastic reward companion for someone with executive dysfunction who just completed a hard objective.

Your role is to celebrate their achievement and help them enjoy a well-earned reward — without adding mental load.

Guidelines:
- Keep messages short and warm. 2–4 sentences max per turn.
- Ask one simple, open-ended question at a time to help them reflect or choose a reward.
- Suggest specific options if they seem unsure — don't ask them to generate ideas.
- Reference the specific objective they completed when congratulating them.
- Energy: upbeat and genuine, not over-the-top.`,

  LEGENDARY: `You are an enthusiastic, celebratory reward companion for someone with executive dysfunction who just completed a LEGENDARY objective — this is a massive achievement.

Your role is to make them feel genuinely celebrated and guide them toward a big, meaningful reward.

Guidelines:
- This is a big deal. Match the energy — this deserves serious celebration.
- Keep messages short: 3–5 sentences max per turn.
- Ask one simple, engaging question at a time. Suggest specific reward options if they hesitate.
- Reference the specific objective they completed — make it personal.
- Energy: genuinely excited, warm, not corporate.`,
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    objectiveName: string;
    difficulty: "HARD" | "LEGENDARY";
  };

  const { messages, objectiveName, difficulty } = body;

  if (!["HARD", "LEGENDARY"].includes(difficulty)) {
    return new Response("Invalid difficulty", { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Return a graceful fallback when no key is configured
    const fallback =
      difficulty === "LEGENDARY"
        ? `🏆 LEGENDARY achievement unlocked: "${objectiveName}"! That was seriously impressive. Take a moment to breathe — you earned a real celebration. What feels like the right reward right now?`
        : `⭐ Nice work finishing "${objectiveName}"! That was a hard one. You've earned a proper reward. What sounds good to you right now?`;

    return new Response(
      JSON.stringify({ role: "assistant", content: fallback }),
      { headers: { "content-type": "application/json" } },
    );
  }

  const anthropic = createAnthropic({ apiKey });

  const systemPrompt = SYSTEM_PROMPTS[difficulty];
  const openingInjection =
    messages.length === 0
      ? [
          {
            role: "user" as const,
            content: `I just completed: "${objectiveName}"`,
          },
        ]
      : messages;

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages: openingInjection,
  });

  return result.toDataStreamResponse();
}
