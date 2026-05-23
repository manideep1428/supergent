import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "backend/convex/_generated/api";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

async function resolveChatId(params: Promise<{ chatId: string }>) {
  const { chatId } = await params;
  return chatId;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const { user } = await withAuth();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const chatId = await resolveChatId(params);
  if (!chatId) {
    return new Response(JSON.stringify({ error: "Missing chatId" }), { status: 400 });
  }

  const convex = getConvexClient();
  if (!convex) {
    return new Response(
      JSON.stringify({ error: "Convex is not configured." }),
      { status: 500 },
    );
  }

  try {
    await convex.mutation(api.chats.addFavorite, { userId: user.id, chatId });
    return Response.json({ ok: true, favorite: true });
  } catch (error: any) {
    console.error("Failed to add favorite", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Could not add favorite" }),
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const { user } = await withAuth();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const chatId = await resolveChatId(params);
  if (!chatId) {
    return new Response(JSON.stringify({ error: "Missing chatId" }), { status: 400 });
  }

  const convex = getConvexClient();
  if (!convex) {
    return new Response(
      JSON.stringify({ error: "Convex is not configured." }),
      { status: 500 },
    );
  }

  try {
    await convex.mutation(api.chats.removeFavorite, {
      userId: user.id,
      chatId,
    });
    return Response.json({ ok: true, favorite: false });
  } catch (error: any) {
    console.error("Failed to remove favorite", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Could not remove favorite" }),
      { status: 500 },
    );
  }
}
