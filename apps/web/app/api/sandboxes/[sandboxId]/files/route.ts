import { NextResponse, type NextRequest } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { z } from "zod";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "backend/convex/_generated/api";

export const dynamic = "force-dynamic";

const fileParamsSchema = z.object({
  sandboxId: z.string(),
  path: z.string(),
});

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) {
    return null;
  }
  return new ConvexHttpClient(url);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> },
) {
  const { user } = await withAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sandboxId } = await params;
  const parsed = fileParamsSchema.safeParse({
    sandboxId,
    path: request.nextUrl.searchParams.get("path"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters. Pass a path query parameter." },
      { status: 400 },
    );
  }

  // 1) Try to fetch from the live Vercel Sandbox first
  try {
    const sandbox = await Sandbox.get({ sandboxId: parsed.data.sandboxId });
    if (sandbox.status === "running" || sandbox.status === "pending") {
      const stream = await sandbox.readFile(parsed.data);
      if (stream) {
        return new NextResponse(
          new ReadableStream({
            async pull(controller) {
              for await (const chunk of stream) {
                controller.enqueue(chunk);
              }
              controller.close();
            },
          }),
          {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
            },
          },
        );
      }
    }
  } catch (liveError) {
    console.warn(`Failed to read from live sandbox ${sandboxId}, attempting Convex DB fallback:`, liveError);
  }

  // 2) Fallback to Convex Database if sandbox is inactive/offline
  const convex = getConvexClient();
  if (convex) {
    try {
      // Find app by sandboxId to resolve chatId
      const app = await convex.query(api.chats.getAppBySandboxId, {
        sandboxId: parsed.data.sandboxId,
        userId: user.id,
      });

      if (app) {
        // Fetch file content from Convex files table
        const file = await convex.query(api.chats.getFile, {
          chatId: app.chatId,
          userId: user.id,
          path: parsed.data.path,
        });

        if (file) {
          return new NextResponse(file.content, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
            },
          });
        }
      }
    } catch (dbError) {
      console.error("Failed to fetch file from Convex DB fallback:", dbError);
    }
  }

  return NextResponse.json(
    { error: "File not found in the sandbox or database." },
    { status: 404 },
  );
}
