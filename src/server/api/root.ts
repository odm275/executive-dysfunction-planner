import { chapterRouter } from "~/server/api/routers/chapter";
import { collaborationRouter } from "~/server/api/routers/collaboration";
import { debuffRouter } from "~/server/api/routers/debuff";
import { energyRouter } from "~/server/api/routers/energy";
import { objectiveRouter } from "~/server/api/routers/objective";
import { postRouter } from "~/server/api/routers/post";
import { questRouter } from "~/server/api/routers/quest";
import { rewardRouter } from "~/server/api/routers/reward";
import { suggestionRouter } from "~/server/api/routers/suggestion";
import { userRouter } from "~/server/api/routers/user";
import { reminderRouter } from "~/server/api/routers/reminder";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  chapter: chapterRouter,
  collaboration: collaborationRouter,
  debuff: debuffRouter,
  energy: energyRouter,
  objective: objectiveRouter,
  post: postRouter,
  quest: questRouter,
  reward: rewardRouter,
  reminder: reminderRouter,
  suggestion: suggestionRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
