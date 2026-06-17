import { NextResponse, type NextRequest } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { z } from "zod";

export const dynamic = "force-dynamic";

const fileParamsSchema = z.object({
  sandboxId: z.string(),
  path: z.string(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> },
) {
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

  const sandbox = await Sandbox.get({ sandboxId: parsed.data.sandboxId });
  const stream = await sandbox.readFile(parsed.data);

  if (!stream) {
    return NextResponse.json(
      { error: "File not found in the sandbox." },
      { status: 404 },
    );
  }

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
