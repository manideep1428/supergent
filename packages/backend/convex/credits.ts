import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

// Pricing (matches the dashboard copy):
//   0.50 credit  ->  Project creation
//   1.00 credit  ->  20,000 output tokens (input tokens are free)
const INPUT_CREDIT_PER_TOKEN = 0;
const OUTPUT_CREDIT_PER_TOKEN = 1 / 20_000;

// Initial free credits granted to every new user the first time they generate
// usage. Bump this in code or grant top-ups via a future mutation.
const INITIAL_CREDITS = 5;

export async function chargeProjectCreation(db: any, userId: string) {
  const now = Date.now();
  const existing = await db
    .query("userCredits")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();

  if (!existing) {
    await db.insert("userCredits", {
      userId,
      balance: INITIAL_CREDITS - 0.5,
      lifetimeUsed: 0.5,
      lifetimeIssued: INITIAL_CREDITS,
      updatedAt: now,
    });
  } else {
    await db.patch(existing._id, {
      balance: existing.balance - 0.5,
      lifetimeUsed: existing.lifetimeUsed + 0.5,
      updatedAt: now,
    });
  }
}

function chargeFor(inputTokens: number, outputTokens: number) {
  const inputCredit = Math.max(0, inputTokens) * INPUT_CREDIT_PER_TOKEN;
  const outputCredit = Math.max(0, outputTokens) * OUTPUT_CREDIT_PER_TOKEN;
  return inputCredit + outputCredit;
}

export const getCredits = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userCredits")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!row) {
      return {
        balance: 0,
        lifetimeUsed: 0,
        lifetimeIssued: 0,
        initialized: false,
      };
    }

    return {
      balance: row.balance,
      lifetimeUsed: row.lifetimeUsed,
      lifetimeIssued: row.lifetimeIssued,
      initialized: true,
    };
  },
});

export const recentUsage = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tokenUsage")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 25);

    return rows.map((row) => ({
      chatId: row.chatId,
      modelId: row.modelId,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
      credits: row.credits,
      createdAt: row.createdAt,
    }));
  },
});

export const recordUsage = mutation({
  args: {
    userId: v.string(),
    chatId: v.string(),
    modelId: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const inputTokens = Math.max(0, Math.round(args.inputTokens));
    const outputTokens = Math.max(0, Math.round(args.outputTokens));
    const totalTokens = inputTokens + outputTokens;

    const existing = await ctx.db
      .query("userCredits")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    const credits = chargeFor(inputTokens, outputTokens);

    const now = Date.now();

    await ctx.db.insert("tokenUsage", {
      userId: args.userId,
      chatId: args.chatId,
      modelId: args.modelId,
      inputTokens,
      outputTokens,
      totalTokens,
      credits,
      createdAt: now,
    });

    if (!existing) {
      await ctx.db.insert("userCredits", {
        userId: args.userId,
        balance: INITIAL_CREDITS - credits,
        lifetimeUsed: credits,
        lifetimeIssued: INITIAL_CREDITS,
        updatedAt: now,
      });
      return {
        credits,
        balance: INITIAL_CREDITS - credits,
      };
    }

    const nextBalance = existing.balance - credits;
    await ctx.db.patch(existing._id, {
      balance: nextBalance,
      lifetimeUsed: existing.lifetimeUsed + credits,
      updatedAt: now,
    });

    return {
      credits,
      balance: nextBalance,
    };
  },
});

export const grantCredits = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) return null;
    const now = Date.now();
    const existing = await ctx.db
      .query("userCredits")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!existing) {
      await ctx.db.insert("userCredits", {
        userId: args.userId,
        balance: args.amount,
        lifetimeUsed: 0,
        lifetimeIssued: args.amount,
        updatedAt: now,
      });
      return { balance: args.amount };
    }
    await ctx.db.patch(existing._id, {
      balance: existing.balance + args.amount,
      lifetimeIssued: existing.lifetimeIssued + args.amount,
      updatedAt: now,
    });
    return { balance: existing.balance + args.amount };
  },
});
