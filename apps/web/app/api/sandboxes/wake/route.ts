import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "backend/convex/_generated/api";
import { resumeSandboxForChat } from "@/lib/sandbox-tools";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) {
    return null;
  }

  return new ConvexHttpClient(url);
}

/**
 * POST /api/sandboxes/wake
 *
 * Body: { chatId: string, port?: number }
 *
 * Resumes the sandbox for this chat. Reattaches to a running sandbox if
 * possible, otherwise creates a new sandbox from the most recent snapshot
 * (preserving all generated files + installed deps), otherwise no-ops if
 * the chat has never had a sandbox.
 *
 * Returns the live sandboxId, the source it was resumed from, and the
 * preview URL for the requested port (default 3000) when available.
 */
export async function POST(req: Request) {
  const { user } = await withAuth();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  let chatId: unknown = null;
  let port = 3000;
  try {
    const body = await req.json();
    chatId = body?.chatId;
    if (typeof body?.port === "number" && Number.isFinite(body.port)) {
      port = body.port;
    }
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

  const runtime = await convex.query(api.chats.getActiveRuntime, {
    chatId,
    userId: user.id,
  });

  // Nothing to wake if the chat has never had a sandbox or snapshot.
  if (!runtime || (!runtime.sandboxId && !runtime.snapshotId)) {
    return Response.json({
      status: "idle",
      reason: "no-runtime",
      sandboxId: null,
      previewUrl: null,
    });
  }

  try {
    const { sandbox, source } = await resumeSandboxForChat({
      runtime: {
        sandboxId: runtime.sandboxId,
        snapshotId: runtime.snapshotId,
      },
      ports: [port],
    });

    let previewUrl: string | null = null;
    try {
      previewUrl = sandbox.domain(port);
    } catch {
      previewUrl = runtime.previewUrl ?? null;
    }

    await convex.mutation(api.chats.updateRuntime, {
      chatId,
      userId: user.id,
      sandboxId: sandbox.sandboxId,
      previewUrl,
      status: "ready",
    });

    return Response.json({
      status: "running",
      source,
      sandboxId: sandbox.sandboxId,
      previewUrl,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message || "Failed to resume sandbox",
      }),
      { status: 500 },
    );
  }
}
