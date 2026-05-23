import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "backend/convex/_generated/api";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

export async function GET(req: Request) {
  const { user } = await withAuth();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const convex = getConvexClient();
  if (!convex) {
    return Response.json({ projects: [] });
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : 50;

  try {
    const projects = await convex.query(api.chats.listByUser, {
      userId: user.id,
      limit,
    });
    return Response.json({ projects });
  } catch (error: any) {
    console.error("Failed to load projects from Convex", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
