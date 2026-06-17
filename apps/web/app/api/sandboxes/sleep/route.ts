import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "backend/convex/_generated/api";
import { Sandbox } from "@vercel/sandbox";


function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) {
    return null;
  }

  return new ConvexHttpClient(url);
}

/**
 * POST /api/sandboxes/sleep
 *
 * Body: { chatId: string }
 *
 * Snapshots the current sandbox for this chat (which also stops it),
 * persists the resulting snapshotId to Convex, and clears the live
 * sandboxId so the next interaction restores from snapshot.
 *
 * Idempotent: if no live sandbox exists, returns ok with already-stopped.
 */
export async function POST(req: Request) {
  const { user } = await withAuth();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  let chatId: unknown = null;
  try {
    const body = await req.json();
    chatId = body?.chatId;
  } catch {
    // ignore - validated below
  }

  if (typeof chatId !== "string" || !chatId.trim()) {
    return new Response(JSON.stringify({ error: "Missing chatId" }), {
      status: 400,
    });
  }

  const convex = getConvexClient();
  if (!convex) {
    return new Response(
      JSON.stringify({ error: "Convex is not configured" }),
      { status: 500 },
    );
  }

  let runtime: {
    sandboxId: string | null;
    snapshotId: string | null;
    previewUrl: string | null;
  } | null = null;
  try {
    runtime = await convex.query(api.chats.getActiveRuntime, {
      chatId,
      userId: user.id,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to load runtime" }),
      { status: 500 },
    );
  }

  if (!runtime?.sandboxId) {
    // Nothing to stop. Already snapshotted/idle.
    return Response.json({
      status: "stopped",
      snapshotId: runtime?.snapshotId ?? null,
      reason: "no-live-sandbox",
    });
  }

  // Best-effort status check first - skip snapshot if already stopped.
  try {
    const sandbox = await Sandbox.get({ sandboxId: runtime.sandboxId });
    if (sandbox.status !== "running" && sandbox.status !== "pending") {
      await convex.mutation(api.chats.clearSandboxRuntime, {
        chatId,
        userId: user.id,
        keepPreviewUrl: false,
      });
      return Response.json({
        status: "stopped",
        snapshotId: runtime.snapshotId ?? null,
        reason: `sandbox-${sandbox.status}`,
      });
    }
  } catch {
    // Sandbox is gone; just clear and bail.
    await convex.mutation(api.chats.clearSandboxRuntime, {
      chatId,
      userId: user.id,
      keepPreviewUrl: false,
    });
    return Response.json({
      status: "stopped",
      snapshotId: runtime.snapshotId ?? null,
      reason: "sandbox-missing",
    });
  }

  try {
    const sandbox = await Sandbox.get({ sandboxId: runtime.sandboxId });
    await sandbox.stop();

    await convex.mutation(api.chats.clearSandboxRuntime, {
      chatId,
      userId: user.id,
      keepPreviewUrl: false,
    });

    return Response.json({
      status: "stopped",
      snapshotId: null,
      reason: "stopped-no-snapshot",
    });
  } catch (error: any) {
    // If getting or stopping the sandbox failed, we should still clear the live sandboxId in DB
    await convex.mutation(api.chats.clearSandboxRuntime, {
      chatId,
      userId: user.id,
      keepPreviewUrl: false,
    });
    return Response.json({
      status: "stopped",
      snapshotId: null,
      reason: "stop-failed-cleared-runtime",
      error: error?.message,
    });
  }
}
