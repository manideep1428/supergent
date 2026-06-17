import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "backend/convex/_generated/api";
import { resumeSandboxForChat, syncSandboxFilesToConvex } from "@/lib/sandbox-tools";

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

    let isFresh = source === "fresh";
    if (!isFresh) {
      try {
        await sandbox.fs.readFile("package.json");
      } catch {
        isFresh = true;
      }
    }

    if (isFresh) {
      console.log(`[wake] Sandbox is empty/fresh. Initializing starter repo in ${sandbox.sandboxId}...`);
      const cloneCmd = await sandbox.runCommand({
        cmd: "sh",
        args: [
          "-c",
          "rm -rf * && git clone https://github.com/manideep1428/supergent-starter .",
        ],
      });
      const cloneResult = await cloneCmd.wait();
      if (cloneResult.exitCode !== 0) {
        throw new Error(`Failed to clone starter repo: ${await cloneResult.stderr()}`);
      }

      console.log(`[wake] Restoring custom files from Convex...`);
      const dbFiles = await convex.query(api.chats.getAllFiles, {
        chatId,
        userId: user.id,
      });
      for (const file of dbFiles) {
        const parts = file.path.split("/");
        if (parts.length > 1) {
          const dir = parts.slice(0, -1).join("/");
          if (dir && dir !== "." && dir !== "..") {
            await sandbox.fs.mkdir(dir, { recursive: true });
          }
        }
        await sandbox.fs.writeFile(file.path, file.content, "utf8");
      }

      console.log(`[wake] Installing dependencies...`);
      const installCmd = await sandbox.runCommand({
        cmd: "pnpm",
        args: ["install"],
      });
      const installResult = await installCmd.wait();
      if (installResult.exitCode !== 0) {
        throw new Error(`Failed to install dependencies: ${await installResult.stderr()}`);
      }

      console.log(`[wake] Starting dev server in background...`);
      await sandbox.runCommand({
        cmd: "pnpm",
        args: ["dev", "--", "--hostname", "0.0.0.0"],
        detached: true,
      });

      console.log(`[wake] Syncing workspace files to Convex...`);
      await syncSandboxFilesToConvex({
        sandbox,
        onRuntimeUpdate: async (update) => {
          await convex.mutation(api.chats.updateRuntime, {
            chatId,
            userId: user.id,
            sandboxId: update.sandboxId ?? null,
            previewUrl: update.previewUrl ?? null,
            generatedFiles: update.generatedFiles,
            overwriteGeneratedFiles: update.overwriteGeneratedFiles,
          });
          if (update.files && update.files.length > 0) {
            await convex.mutation(api.chats.saveFilesBatch, {
              chatId,
              userId: user.id,
              files: update.files,
            });
          }
        },
      });
    } else if (source === "snapshot") {
      console.log(`[wake] Restored from snapshot. Starting dev server and syncing...`);
      await sandbox.runCommand({
        cmd: "pnpm",
        args: ["dev", "--", "--hostname", "0.0.0.0"],
        detached: true,
      });

      await syncSandboxFilesToConvex({
        sandbox,
        onRuntimeUpdate: async (update) => {
          await convex.mutation(api.chats.updateRuntime, {
            chatId,
            userId: user.id,
            sandboxId: update.sandboxId ?? null,
            previewUrl: update.previewUrl ?? null,
            generatedFiles: update.generatedFiles,
            overwriteGeneratedFiles: update.overwriteGeneratedFiles,
          });
          if (update.files && update.files.length > 0) {
            await convex.mutation(api.chats.saveFilesBatch, {
              chatId,
              userId: user.id,
              files: update.files,
            });
          }
        },
      });
    }

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
    console.error("Failed to wake sandbox:", error);
    return new Response(
      JSON.stringify({
        error: error?.message || "Failed to resume sandbox",
      }),
      { status: 500 },
    );
  }
}
