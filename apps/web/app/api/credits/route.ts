import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "backend/convex/_generated/api";

export const dynamic = "force-dynamic";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

export async function GET() {
  const { user } = await withAuth();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const convex = getConvexClient();
  if (!convex) {
    return Response.json({
      credits: { balance: 0, lifetimeUsed: 0, lifetimeIssued: 0, initialized: false },
      recent: [],
    });
  }

  try {
    const [credits, recent] = await Promise.all([
      convex.query(api.credits.getCredits, { userId: user.id }),
      convex.query(api.credits.recentUsage, { userId: user.id, limit: 25 }),
    ]);

    return Response.json({ credits, recent });
  } catch (error: any) {
    console.error("Failed to load credits", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Could not load credits" }),
      { status: 500 },
    );
  }
}
