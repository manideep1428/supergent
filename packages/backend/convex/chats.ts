import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { chargeProjectCreation } from "./credits";

const roleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system"),
);

const statusValidator = v.union(
  v.literal("saved"),
  v.literal("streaming"),
  v.literal("error"),
);

function titleFromContent(content: string) {
  const title = content.replace(/\s+/g, " ").trim();
  if (!title) {
    return "Untitled app";
  }

  return title.length > 64 ? `${title.slice(0, 61)}...` : title;
}

export const createOrGetApp = mutation({
  args: {
    chatId: v.string(),
    userId: v.string(),
    userEmail: v.union(v.string(), v.null()),
    title: v.union(v.string(), v.null()),
    modelId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("apps")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (existing) {
      if (existing.userId !== args.userId) {
        throw new Error("Chat does not belong to the current user.");
      }

      await ctx.db.patch(existing._id, {
        modelId: args.modelId,
        updatedAt: now,
      });

      return existing._id;
    }

    await chargeProjectCreation(ctx.db, args.userId);

    return await ctx.db.insert("apps", {
      chatId: args.chatId,
      userId: args.userId,
      userEmail: args.userEmail,
      title: args.title || "Untitled app",
      modelId: args.modelId,
      status: "creating",
      sandboxId: null,
      previewUrl: null,
      generatedFiles: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addMessage = mutation({
  args: {
    chatId: v.string(),
    userId: v.string(),
    userEmail: v.union(v.string(), v.null()),
    role: roleValidator,
    content: v.string(),
    modelId: v.union(v.string(), v.null()),
    status: statusValidator,
    reasoning: v.optional(v.string()),
    toolEvents: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const app = await ctx.db
      .query("apps")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (app && app.userId !== args.userId) {
      throw new Error("Chat does not belong to the current user.");
    }

    if (!app) {
      await chargeProjectCreation(ctx.db, args.userId);

      await ctx.db.insert("apps", {
        chatId: args.chatId,
        userId: args.userId,
        userEmail: args.userEmail,
        title: args.role === "user" ? titleFromContent(args.content) : "Untitled app",
        modelId: args.modelId,
        status: "creating",
        sandboxId: null,
        previewUrl: null,
        generatedFiles: [],
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(app._id, {
        modelId: args.modelId,
        status: args.role === "assistant" ? "ready" : app.status,
        title:
          app.title === "Untitled app" && args.role === "user"
            ? titleFromContent(args.content)
            : app.title,
        updatedAt: now,
      });
    }

    return await ctx.db.insert("messages", {
      chatId: args.chatId,
      userId: args.userId,
      role: args.role,
      content: args.content,
      modelId: args.modelId,
      status: args.status,
      reasoning: args.reasoning,
      toolEvents: args.toolEvents,
      createdAt: now,
    });
  },
});

export const updateMessage = mutation({
  args: {
    messageId: v.id("messages"),
    chatId: v.string(),
    userId: v.string(),
    content: v.string(),
    status: statusValidator,
    reasoning: v.optional(v.string()),
    toolEvents: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found.");
    }
    if (message.userId !== args.userId || message.chatId !== args.chatId) {
      throw new Error("Message does not belong to the current user/chat.");
    }

    const patch: any = {
      content: args.content,
      status: args.status,
    };
    if (args.reasoning !== undefined) {
      patch.reasoning = args.reasoning;
    }
    if (args.toolEvents !== undefined) {
      patch.toolEvents = args.toolEvents;
    }

    await ctx.db.patch(args.messageId, patch);

    // Also update the app status to "ready" when the assistant message finishes
    if (message.role === "assistant" && args.status === "saved") {
      const app = await ctx.db
        .query("apps")
        .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
        .unique();
      if (app && app.userId === args.userId) {
        await ctx.db.patch(app._id, {
          status: "ready",
          updatedAt: Date.now(),
        });
      }
    }

    return args.messageId;
  },
});

export const updateRuntime = mutation({
  args: {
    chatId: v.string(),
    userId: v.string(),
    sandboxId: v.union(v.string(), v.null()),
    previewUrl: v.union(v.string(), v.null()),
    generatedFiles: v.optional(v.array(v.string())),
    status: v.optional(v.union(v.literal("creating"), v.literal("ready"), v.literal("error"))),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (!app) {
      throw new Error("Chat app does not exist.");
    }

    if (app.userId !== args.userId) {
      throw new Error("Chat does not belong to the current user.");
    }

    await ctx.db.patch(app._id, {
      sandboxId: args.sandboxId ?? app.sandboxId,
      previewUrl: args.previewUrl ?? app.previewUrl,
      generatedFiles: args.generatedFiles
        ? [...new Set([...(app.generatedFiles ?? []), ...args.generatedFiles])]
        : app.generatedFiles,
      status: args.status ?? app.status,
      updatedAt: Date.now(),
    });

    return app._id;
  },
});

export const list = query({
  args: {
    chatId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (!app) {
      return { app: null, messages: [] };
    }

    if (app.userId !== args.userId) {
      throw new Error("Chat does not belong to the current user.");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId_and_createdAt", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();

    const favorite = await ctx.db
      .query("favoriteProjects")
      .withIndex("by_userId_and_chatId", (q) =>
        q.eq("userId", args.userId).eq("chatId", args.chatId),
      )
      .unique();

    return {
      app: {
        ...app,
        isFavorite: !!favorite,
      },
      messages: messages.filter((message) => message.userId === args.userId),
    };
  },
});

export const listByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("apps")
      .withIndex("by_userId_and_updatedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 50);

    const favorites = await ctx.db
      .query("favoriteProjects")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const favoriteSet = new Set(favorites.map((f) => f.chatId));

    return items.map((app) => ({
      chatId: app.chatId,
      title: app.title,
      modelId: app.modelId,
      status: app.status,
      sandboxId: app.sandboxId ?? null,
      previewUrl: app.previewUrl ?? null,
      generatedFilesCount: app.generatedFiles?.length ?? 0,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      isFavorite: favoriteSet.has(app.chatId),
    }));
  },
});

export const addFavorite = mutation({
  args: {
    userId: v.string(),
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("favoriteProjects")
      .withIndex("by_userId_and_chatId", (q) =>
        q.eq("userId", args.userId).eq("chatId", args.chatId),
      )
      .unique();
    if (existing) {
      return existing._id;
    }
    return await ctx.db.insert("favoriteProjects", {
      userId: args.userId,
      chatId: args.chatId,
      createdAt: Date.now(),
    });
  },
});

export const removeFavorite = mutation({
  args: {
    userId: v.string(),
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("favoriteProjects")
      .withIndex("by_userId_and_chatId", (q) =>
        q.eq("userId", args.userId).eq("chatId", args.chatId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const listFavorites = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const favorites = await ctx.db
      .query("favoriteProjects")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 50);

    const enriched = [] as {
      chatId: string
      title: string
      status: "creating" | "ready" | "error"
      updatedAt: number
    }[];
    for (const fav of favorites) {
      const app = await ctx.db
        .query("apps")
        .withIndex("by_chatId", (q) => q.eq("chatId", fav.chatId))
        .unique();
      if (!app || app.userId !== args.userId) continue;
      enriched.push({
        chatId: app.chatId,
        title: app.title,
        status: app.status,
        updatedAt: app.updatedAt,
      });
    }
    return enriched;
  },
});

export const deleteProject = mutation({
  args: {
    chatId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (!app) {
      return { deletedMessages: 0, deletedSnapshots: 0, deletedApp: false };
    }

    if (app.userId !== args.userId) {
      throw new Error("Chat does not belong to the current user.");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId_and_createdAt", (q) => q.eq("chatId", args.chatId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    const snapshot = await ctx.db
      .query("sandboxSnapshots")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (snapshot) {
      await ctx.db.delete(snapshot._id);
    }

    const favorite = await ctx.db
      .query("favoriteProjects")
      .withIndex("by_userId_and_chatId", (q) =>
        q.eq("userId", args.userId).eq("chatId", args.chatId),
      )
      .unique();

    if (favorite) {
      await ctx.db.delete(favorite._id);
    }

    await ctx.db.delete(app._id);

    return {
      deletedMessages: messages.length,
      deletedSnapshots: snapshot ? 1 : 0,
      deletedApp: true,
    };
  },
});

export const renameProject = mutation({
  args: {
    chatId: v.string(),
    userId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (!app) {
      throw new Error("Project not found.");
    }

    if (app.userId !== args.userId) {
      throw new Error("Chat does not belong to the current user.");
    }

    const title = args.title.trim() || "Untitled app";
    await ctx.db.patch(app._id, {
      title: title.length > 64 ? `${title.slice(0, 61)}...` : title,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

export const saveSandboxSnapshot = mutation({
  args: {
    chatId: v.string(),
    userId: v.string(),
    snapshotId: v.string(),
    expiresAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (app && app.userId !== args.userId) {
      throw new Error("Chat does not belong to the current user.");
    }

    const existing = await ctx.db
      .query("sandboxSnapshots")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    const data = {
      chatId: args.chatId,
      userId: args.userId,
      snapshotId: args.snapshotId,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return await ctx.db.insert("sandboxSnapshots", data);
  },
});

export const getActiveSnapshot = query({
  args: {
    chatId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("sandboxSnapshots")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (!row || row.userId !== args.userId) {
      return null;
    }

    if (row.expiresAt !== null && row.expiresAt < Date.now()) {
      return null;
    }

    return {
      snapshotId: row.snapshotId,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  },
});

/**
 * Returns the current sandboxId (last known live sandbox) plus the most
 * recent non-expired snapshotId, so the caller can decide whether to
 * reattach, restore from snapshot, or create a fresh sandbox.
 */
export const getActiveRuntime = query({
  args: {
    chatId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (app && app.userId !== args.userId) {
      return null;
    }

    const snapshotRow = await ctx.db
      .query("sandboxSnapshots")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    const snapshotValid =
      snapshotRow &&
      snapshotRow.userId === args.userId &&
      (snapshotRow.expiresAt === null || snapshotRow.expiresAt >= Date.now());

    return {
      sandboxId: app?.sandboxId ?? null,
      snapshotId: snapshotValid ? snapshotRow!.snapshotId : null,
      previewUrl: app?.previewUrl ?? null,
    };
  },
});

/**
 * Clears the live sandboxId after it has been snapshotted (so the next
 * chat turn knows the sandbox is no longer reachable and must be resumed
 * from snapshot). Optionally clears previewUrl since the URL is dead too.
 */
export const clearSandboxRuntime = mutation({
  args: {
    chatId: v.string(),
    userId: v.string(),
    keepPreviewUrl: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (!app) {
      return null;
    }

    if (app.userId !== args.userId) {
      throw new Error("Chat does not belong to the current user.");
    }

    await ctx.db.patch(app._id, {
      sandboxId: null,
      previewUrl: args.keepPreviewUrl ? app.previewUrl : null,
      updatedAt: Date.now(),
    });

    return app._id;
  },
});
