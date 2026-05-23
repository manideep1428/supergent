import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "backend/convex/_generated/api";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const { user } = await withAuth();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { chatId } = await params;
  if (!chatId) {
    return new Response(JSON.stringify({ error: "Missing chatId" }), { status: 400 });
  }

  const convex = getConvexClient();
  if (!convex) {
    return new Response(
      JSON.stringify({
        error: "Convex is not configured. Set NEXT_PUBLIC_CONVEX_URL.",
      }),
      { status: 500 },
    );
  }

  try {
    const result = await convex.mutation(api.chats.deleteProject, {
      chatId,
      userId: user.id,
    });
    return Response.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("Failed to delete project", error);
    const status = /does not belong/.test(error?.message ?? "") ? 403 : 500;
    return new Response(
      JSON.stringify({ error: error?.message ?? "Could not delete project" }),
      { status },
    );
  }
}
