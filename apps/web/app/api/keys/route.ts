import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "backend/convex/_generated/api";

type KeysPayload = {
  vercelKey: string;
  openaiKey: string;
  anthropicKey: string;
  googleKey: string;
  deepseekKey: string;
  mistralKey: string;
  groqKey: string;
  moonshotKey: string;
};

const EMPTY_KEYS: KeysPayload = {
  vercelKey: "",
  openaiKey: "",
  anthropicKey: "",
  googleKey: "",
  deepseekKey: "",
  mistralKey: "",
  groqKey: "",
  moonshotKey: "",
};

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) {
    return null;
  }
  return new ConvexHttpClient(url);
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return value;
}

export async function GET() {
  const { user } = await withAuth();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const convex = getConvexClient();
  if (!convex) {
    return Response.json(EMPTY_KEYS);
  }

  try {
    const keys = await convex.query(api.apiKeys.getKeys, { userId: user.id });
    return Response.json({
      vercelKey: keys.vercelKey ?? "",
      openaiKey: keys.openaiKey ?? "",
      anthropicKey: keys.anthropicKey ?? "",
      googleKey: keys.googleKey ?? "",
      deepseekKey: keys.deepseekKey ?? "",
      mistralKey: keys.mistralKey ?? "",
      groqKey: keys.groqKey ?? "",
      moonshotKey: keys.moonshotKey ?? "",
    } satisfies KeysPayload);
  } catch (error: any) {
    console.error("Failed to load API keys from Convex", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user } = await withAuth();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const convex = getConvexClient();
  if (!convex) {
    return new Response(
      JSON.stringify({
        error: "Convex is not configured. Set NEXT_PUBLIC_CONVEX_URL in apps/web/.env.local.",
      }),
      { status: 500 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    await convex.mutation(api.apiKeys.setKeys, {
      userId: user.id,
      vercelKey: readString(body.vercelKey),
      openaiKey: readString(body.openaiKey),
      anthropicKey: readString(body.anthropicKey),
      googleKey: readString(body.googleKey),
      deepseekKey: readString(body.deepseekKey),
      mistralKey: readString(body.mistralKey),
      groqKey: readString(body.groqKey),
      moonshotKey: readString(body.moonshotKey),
    });
    return Response.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to save API keys to Convex", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
