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
 * POST /api/sandboxes/keepalive
 *
 * Body: { chatId: string }
 *
 * Extends the lifetime of the active sandbox for this chat to prevent auto-expiry.
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
    // ignore
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

  try {
    const runtime = await convex.query(api.chats.getActiveRuntime, {
      chatId,
      userId: user.id,
    });

    if (runtime?.sandboxId) {
      const sandbox = await Sandbox.get({ sandboxId: runtime.sandboxId });
      // Extend timeout by 5 minutes
      await sandbox.extendTimeout(5 * 60 * 1000);
      return Response.json({ success: true, sandboxId: runtime.sandboxId });
    }
    
    return Response.json({ success: false, reason: "no-live-sandbox" });
  } catch (error: any) {
    console.error("Failed to extend sandbox timeout:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to keepalive sandbox" }),
      { status: 500 },
    );
  }
}
