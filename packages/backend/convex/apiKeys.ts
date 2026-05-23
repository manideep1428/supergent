import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const stringOrNull = v.union(v.string(), v.null());

function clean(value: string | null | undefined) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const setKeys = mutation({
  args: {
    userId: v.string(),
    vercelKey: stringOrNull,
    openaiKey: stringOrNull,
    anthropicKey: stringOrNull,
    googleKey: stringOrNull,
    deepseekKey: stringOrNull,
    mistralKey: stringOrNull,
    groqKey: stringOrNull,
    moonshotKey: stringOrNull,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("userApiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    const data = {
      userId: args.userId,
      vercelKey: clean(args.vercelKey),
      openaiKey: clean(args.openaiKey),
      anthropicKey: clean(args.anthropicKey),
      googleKey: clean(args.googleKey),
      deepseekKey: clean(args.deepseekKey),
      mistralKey: clean(args.mistralKey),
      groqKey: clean(args.groqKey),
      moonshotKey: clean(args.moonshotKey),
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("userApiKeys", data);
  },
});

export const getKeys = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userApiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    return {
      vercelKey: row?.vercelKey ?? "",
      openaiKey: row?.openaiKey ?? "",
      anthropicKey: row?.anthropicKey ?? "",
      googleKey: row?.googleKey ?? "",
      deepseekKey: row?.deepseekKey ?? "",
      mistralKey: row?.mistralKey ?? "",
      groqKey: row?.groqKey ?? "",
      moonshotKey: row?.moonshotKey ?? "",
    };
  },
});
