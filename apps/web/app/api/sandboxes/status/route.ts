import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "backend/convex/_generated/api";
import { Sandbox } from "@vercel/sandbox";

export const dynamic = "force-dynamic";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) {
    return null;
  }

  return new ConvexHttpClient(url);
}

/**
 * GET /api/sandboxes/status?chatId=xxx
 *
 * Returns the current liveness status of the chat's sandbox so the UI can
 * surface an "active" indicator and decide whether it needs to wake the
 * sandbox before the next interaction.
 *
 * Response shape:
 *   { status: "running" | "pending" | "stopped" | "snapshotted" | "idle" | "failed",
 *     sandboxId: string | null,
 *     snapshotId: string | null,
 *     hasSnapshot: boolean,
 *     timeoutMs: number | null,
 *     previewUrl: string | null }
 */
export async function GET(req: Request) {
  const { user } = await withAuth();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const url = new URL(req.url);
  const chatId = url.searchParams.get("chatId");

  if (!chatId) {
    return new Response(JSON.stringify({ error: "Missing chatId" }), {
      status: 400,
    });
  }

  const convex = getConvexClient();
  if (!convex) {
    return Response.json({
      status: "idle",
      sandboxId: null,
      snapshotId: null,
      hasSnapshot: false,
      timeoutMs: null,
      previewUrl: null,
    });
  }

  const runtime = await convex.query(api.chats.getActiveRuntime, {
    chatId,
    userId: user.id,
  });

  if (!runtime) {
    return Response.json({
      status: "idle",
      sandboxId: null,
      snapshotId: null,
      hasSnapshot: false,
      timeoutMs: null,
      previewUrl: null,
    });
  }

  const hasSnapshot = Boolean(runtime.snapshotId);

  if (!runtime.sandboxId) {
    return Response.json({
      status: hasSnapshot ? "snapshotted" : "idle",
      sandboxId: null,
      snapshotId: runtime.snapshotId ?? null,
      hasSnapshot,
      timeoutMs: null,
      previewUrl: runtime.previewUrl ?? null,
    });
  }

  try {
    const sandbox = await Sandbox.get({ sandboxId: runtime.sandboxId });
    return Response.json({
      status: sandbox.status,
      sandboxId: runtime.sandboxId,
      snapshotId: runtime.snapshotId ?? null,
      hasSnapshot,
      timeoutMs: typeof sandbox.timeout === "number" ? sandbox.timeout : null,
      previewUrl: runtime.previewUrl ?? null,
    });
  } catch {
    // Sandbox no longer exists; report snapshotted (if we have one) or idle.
    return Response.json({
      status: hasSnapshot ? "snapshotted" : "idle",
      sandboxId: null,
      snapshotId: runtime.snapshotId ?? null,
      hasSnapshot,
      timeoutMs: null,
      previewUrl: runtime.previewUrl ?? null,
    });
  }
}
