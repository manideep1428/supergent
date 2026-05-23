import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    authId: v.string(),
    email: v.string(),
    name: v.string(),
  }).index("authId", ["authId"]),
  apps: defineTable({
    chatId: v.string(),
    userId: v.string(),
    userEmail: v.union(v.string(), v.null()),
    title: v.string(),
    modelId: v.union(v.string(), v.null()),
    status: v.union(v.literal("creating"), v.literal("ready"), v.literal("error")),
    sandboxId: v.optional(v.union(v.string(), v.null())),
    previewUrl: v.optional(v.union(v.string(), v.null())),
    generatedFiles: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_chatId", ["chatId"])
    .index("by_userId_and_updatedAt", ["userId", "updatedAt"]),
  messages: defineTable({
    chatId: v.string(),
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    modelId: v.union(v.string(), v.null()),
    status: v.union(v.literal("saved"), v.literal("streaming"), v.literal("error")),
    createdAt: v.number(),
  })
    .index("by_chatId_and_createdAt", ["chatId", "createdAt"])
    .index("by_userId_and_chatId", ["userId", "chatId"]),
  userApiKeys: defineTable({
    userId: v.string(),
    vercelKey: v.optional(v.string()),
    openaiKey: v.optional(v.string()),
    anthropicKey: v.optional(v.string()),
    googleKey: v.optional(v.string()),
    deepseekKey: v.optional(v.string()),
    mistralKey: v.optional(v.string()),
    groqKey: v.optional(v.string()),
    moonshotKey: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  sandboxSnapshots: defineTable({
    chatId: v.string(),
    userId: v.string(),
    snapshotId: v.string(),
    // Stored milliseconds since epoch. `null` means never expires.
    expiresAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
  })
    .index("by_chatId", ["chatId"])
    .index("by_userId_and_chatId", ["userId", "chatId"]),
  favoriteProjects: defineTable({
    userId: v.string(),
    chatId: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_chatId", ["userId", "chatId"]),
  userCredits: defineTable({
    userId: v.string(),
    // Number of credits remaining for this user.
    balance: v.number(),
    // Total credits ever spent.
    lifetimeUsed: v.number(),
    // Total credits ever granted (initial + top-ups).
    lifetimeIssued: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  tokenUsage: defineTable({
    userId: v.string(),
    chatId: v.string(),
    modelId: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    // Credits charged for this single call.
    credits: v.number(),
    createdAt: v.number(),
  })
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_chatId_and_createdAt", ["chatId", "createdAt"]),
});
