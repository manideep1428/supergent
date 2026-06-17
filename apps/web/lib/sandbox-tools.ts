import { Sandbox } from "@vercel/sandbox";
import {
  generateObject,
  tool,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { z } from "zod";

const createSandboxDescription = `Create or resume the Vercel Sandbox for the current chat. Reuses a running sandbox or restores from a saved snapshot when available, otherwise spins up a fresh sandbox. Reuse the returned sandboxId for the rest of the chat.`;

const generateFilesDescription = `Generate complete app files and write them into an existing Vercel Sandbox. Use relative paths from the sandbox root. Do not write lock files, node_modules, .next, or other generated artifacts.`;

const runCommandDescription = `Run a command in an existing Vercel Sandbox. Put the base executable in command and every argument in args. Do not use cd or shell chaining. Use wait true for install/build commands and wait false for dev servers.`;

const getSandboxUrlDescription = `Get the public preview URL for a port exposed when the sandbox was created. Call this after the dev server is running.`;

const saveSnapshotDescription = `Save a snapshot of the current sandbox so the same app state can be restored later. Call this once the dev server is running and the app is verified working. Note: taking a snapshot stops the sandbox; the user can re-open the chat to spin up a new sandbox from the snapshot.`;

const fileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

type RuntimeUpdate = {
  sandboxId?: string;
  previewUrl?: string;
  generatedFiles?: string[];
  files?: { path: string; content: string }[];
  status?: "creating" | "ready" | "error";
  overwriteGeneratedFiles?: boolean;
};

export type ToolEvent =
  | {
      kind: "createSandbox";
      id: string;
      status: "loading" | "done" | "error";
      sandboxId?: string;
      source?: "fresh" | "snapshot" | "running";
      message?: string;
      error?: string;
    }
  | {
      kind: "generateFiles";
      id: string;
      status: "generating" | "done" | "error";
      paths: string[];
      error?: string;
    }
  | {
      kind: "runCommand";
      id: string;
      status: "executing" | "running" | "done" | "error";
      command: string;
      args: string[];
      exitCode?: number;
      stdout?: string;
      stderr?: string;
      error?: string;
    }
  | {
      kind: "getSandboxURL";
      id: string;
      status: "loading" | "done" | "error";
      url?: string;
      port?: number;
      error?: string;
    }
  | {
      kind: "saveSnapshot";
      id: string;
      status: "loading" | "done" | "error";
      snapshotId?: string;
      expiresAt?: number;
      error?: string;
    }
  | {
      kind: "readFile";
      id: string;
      status: "reading" | "done" | "error";
      path: string;
      error?: string;
    }
  | {
      kind: "writeFile";
      id: string;
      status: "writing" | "done" | "error";
      path: string;
      error?: string;
    }
  | {
      kind: "writeFiles";
      id: string;
      status: "writing" | "done" | "error";
      paths: string[];
      error?: string;
    };

export type SnapshotInfo = {
  snapshotId: string;
  expiresAt: number | null;
};

export type ActiveRuntime = {
  sandboxId: string | null;
  snapshotId: string | null;
};

export type CreateSandboxToolsOptions = {
  /**
   * Chat identifier this tool set belongs to. Currently only used by callers
   * for context wiring (e.g. logging); the tools themselves access chat-scoped
   * state through `getActiveRuntime` / `saveSnapshot`.
   */
  chatId?: string;
  model: LanguageModel;
  modelId: string;
  /**
   * Called when sandbox runtime data should be persisted (sandbox id, preview
   * url, generated files, status).
   */
  onRuntimeUpdate?: (update: RuntimeUpdate) => Promise<void> | void;
  /**
   * Called for every tool lifecycle event so the chat route can stream them
   * to the client as inline status cards.
   */
  onToolEvent?: (event: ToolEvent) => void;
  /**
   * Returns the current sandboxId (may already be running) and the saved
   * snapshotId for this chat. Used to decide whether to reattach, restore
   * from snapshot, or create fresh.
   */
  getActiveRuntime?: () => Promise<ActiveRuntime | null>;
  /**
   * Persists a snapshot id for this chat. Called after Sandbox.snapshot()
   * succeeds. Default expiration: 30 days.
   */
  saveSnapshot?: (info: SnapshotInfo) => Promise<void> | void;
};

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export const SANDBOX_IDLE_TIMEOUT_MS = 2 * 60 * 1000;
export const SNAPSHOT_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000;

async function reattachOrCreateSandbox({
  runtime,
  ports,
}: {
  runtime: ActiveRuntime | null;
  ports: number[];
}): Promise<{
  sandbox: Sandbox;
  source: "running" | "snapshot" | "fresh";
}> {
  // 1) Try to reattach to a previously created sandbox.
  if (runtime?.sandboxId) {
    try {
      const existing = await Sandbox.get({ sandboxId: runtime.sandboxId });
      if (existing.status === "running" || existing.status === "pending") {
        return { sandbox: existing, source: "running" };
      }
    } catch {
      // Sandbox no longer exists or is unreachable; fall through.
    }
  }

  // 2) Try to restore from a saved snapshot. This always preserves files +
  //    installed deps, so the agent can skip dependency install on resume.
  if (runtime?.snapshotId) {
    try {
      const restored = await Sandbox.create({
        source: { type: "snapshot", snapshotId: runtime.snapshotId },
        timeout: SANDBOX_IDLE_TIMEOUT_MS,
        ports,
      });
      return { sandbox: restored, source: "snapshot" };
    } catch (error) {
      console.error(
        "Failed to restore sandbox from snapshot, creating fresh",
        error,
      );
    }
  }

  // 3) Brand-new sandbox.
  const fresh = await Sandbox.create({
    runtime: "node24",
    timeout: SANDBOX_IDLE_TIMEOUT_MS,
    ports,
  });
  return { sandbox: fresh, source: "fresh" };
}

/**
 * Take a snapshot of a running sandbox and persist its id. The Vercel SDK
 * stops the sandbox automatically once snapshot() resolves.
 */
export async function snapshotAndStop({
  sandboxId,
  saveSnapshot,
}: {
  sandboxId: string;
  saveSnapshot?: (info: SnapshotInfo) => Promise<void> | void;
}): Promise<SnapshotInfo> {
  const sandbox = await Sandbox.get({ sandboxId });
  const snapshot = await sandbox.snapshot({
    expiration: SNAPSHOT_EXPIRATION_MS,
  });

  const expiresAt = snapshot.expiresAt
    ? snapshot.expiresAt.getTime()
    : Date.now() + SNAPSHOT_EXPIRATION_MS;

  const info: SnapshotInfo = {
    snapshotId: snapshot.snapshotId,
    expiresAt,
  };

  await saveSnapshot?.(info);
  return info;
}

/**
 * Resume a sandbox for the chat. Reattaches if the sandbox is still alive,
 * otherwise restores from the most recent snapshot. Returns the running
 * sandbox so callers can update DB-side runtime state.
 */
export async function resumeSandboxForChat({
  runtime,
  ports = [3000],
}: {
  runtime: ActiveRuntime | null;
  ports?: number[];
}) {
  return reattachOrCreateSandbox({ runtime, ports });
}

export async function syncSandboxFilesToConvex({
  sandbox,
  onRuntimeUpdate,
}: {
  sandbox: Sandbox;
  onRuntimeUpdate?: (update: RuntimeUpdate) => Promise<void> | void;
}) {
  try {
    const nodeScript = `
const fs = require('fs');
const path = require('path');
const ignoreDirs = new Set(['node_modules', '.next', '.git']);
const ignoreFiles = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lock']);

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        if (!ignoreDirs.has(file)) {
          results = results.concat(walk(filePath));
        }
      } else {
        if (!ignoreFiles.has(file)) {
          results.push(filePath);
        }
      }
    }
  } catch (err) {}
  return results;
}

const files = walk('.');
const output = [];
for (const f of files) {
  const rel = path.relative('.', f).replace(/\\\\/g, '/');
  try {
    const stat = fs.statSync(f);
    if (stat.size > 500000) continue;
    const content = fs.readFileSync(f, 'utf8');
    output.push({ path: rel, content });
  } catch (e) {}
}
console.log(JSON.stringify(output));
`;

    const cmd = await sandbox.runCommand({
      cmd: "node",
      args: ["-e", nodeScript],
    });
    const result = await cmd.wait();
    const stdout = await result.stdout();
    
    if (result.exitCode !== 0) {
      console.error("File sync script failed with exit code:", result.exitCode, await result.stderr());
      return;
    }

    const files = JSON.parse(stdout.trim()) as { path: string; content: string }[];
    const paths = files.map((f) => f.path);

    await onRuntimeUpdate?.({
      sandboxId: sandbox.sandboxId,
      generatedFiles: paths,
      files,
      overwriteGeneratedFiles: true,
      status: "creating",
    });
  } catch (error) {
    console.error("Error syncing files from sandbox:", error);
  }
}

async function getOrReconnectSandbox({
  sandboxId,
  getActiveRuntime,
  onRuntimeUpdate,
  onToolEvent,
  ports = [3000],
}: {
  sandboxId: string;
  getActiveRuntime?: () => Promise<ActiveRuntime | null>;
  onRuntimeUpdate?: (update: RuntimeUpdate) => Promise<void> | void;
  onToolEvent?: (event: ToolEvent) => void;
  ports?: number[];
}): Promise<Sandbox> {
  const runtime = (await getActiveRuntime?.()) ?? null;
  const targetSandboxId = runtime?.sandboxId || sandboxId;

  try {
    const sandbox = await Sandbox.get({ sandboxId: targetSandboxId });
    if (sandbox.status === "running" || sandbox.status === "pending") {
      return sandbox;
    }
    throw new Error(`Sandbox status is ${sandbox.status}`);
  } catch (error) {
    console.warn(`Sandbox connection lost or status inactive for ${targetSandboxId}:`, error);

    const eventId = `reconnect-${Date.now()}`;
    onToolEvent?.({
      kind: "createSandbox",
      id: eventId,
      status: "loading",
      source: runtime?.snapshotId ? "snapshot" : "running",
    });

    try {
      const { sandbox, source } = await reattachOrCreateSandbox({
        runtime,
        ports,
      });

      await onRuntimeUpdate?.({
        sandboxId: sandbox.sandboxId,
        status: "creating",
      });

      onToolEvent?.({
        kind: "createSandbox",
        id: eventId,
        status: "done",
        sandboxId: sandbox.sandboxId,
        source,
      });

      return sandbox;
    } catch (reconnectError) {
      onToolEvent?.({
        kind: "createSandbox",
        id: eventId,
        status: "error",
        error: errorMessage(reconnectError),
      });
      throw reconnectError;
    }
  }
}

async function generateFilesForPaths({
  model,
  messages,
  paths,
}: {
  model: LanguageModel;
  messages: ModelMessage[];
  paths: string[];
}) {
  const result = await generateObject({
    model,
    maxOutputTokens: 64000,
    schema: z.object({ files: z.array(fileSchema) }),
    system:
      "You generate complete file contents for a sandbox app. Return only files requested by path. Never generate lock files, node_modules, .next, or build artifacts.",
    messages: [
      ...messages,
      {
        role: "user",
        content: `Generate complete contents for these sandbox-relative files:\n${paths
          .map((path) => `- ${path}`)
          .join("\n")}`,
      },
    ],
  });

  return result.object.files;
}

export function createSandboxTools({
  model,
  modelId,
  onRuntimeUpdate,
  onToolEvent,
  getActiveRuntime,
  saveSnapshot,
}: CreateSandboxToolsOptions): ToolSet {
  return {
    createSandbox: tool({
      description: createSandboxDescription,
      inputSchema: z.object({
        ports: z.array(z.number()).max(2).optional(),
      }),
      execute: async ({ ports }, { toolCallId }) => {
        const eventId = toolCallId ?? `createSandbox-${Date.now()}`;
        try {
          const portsList = ports?.length ? ports : [3000];
          const runtime = (await getActiveRuntime?.()) ?? null;
          onToolEvent?.({
            kind: "createSandbox",
            id: eventId,
            status: "loading",
            source: runtime?.sandboxId ? "running" : runtime?.snapshotId ? "snapshot" : "fresh",
          });

          const { sandbox, source } = await reattachOrCreateSandbox({
            runtime,
            ports: portsList,
          });

          await onRuntimeUpdate?.({
            sandboxId: sandbox.sandboxId,
            status: "creating",
          });

          onToolEvent?.({
            kind: "createSandbox",
            id: eventId,
            status: "done",
            sandboxId: sandbox.sandboxId,
            source,
          });

          if (source === "running") {
            return `Sandbox ${sandbox.sandboxId} is still running with the previously generated files. Skip generateFiles and pnpm install. Verify the dev server with runCommand and call getSandboxURL.`;
          }

          if (source === "snapshot") {
            return `Sandbox ${sandbox.sandboxId} was restored from a saved snapshot. The previously generated files and installed dependencies are already present, so skip generateFiles and pnpm install. Start the dev server and call getSandboxURL.`;
          }

          return `Sandbox ${sandbox.sandboxId} created. Use this sandboxId for all remaining tool calls in this chat.`;
        } catch (error) {
          await onRuntimeUpdate?.({ status: "error" });
          const message = errorMessage(error);
          onToolEvent?.({
            kind: "createSandbox",
            id: eventId,
            status: "error",
            error: message,
          });
          return `Error creating sandbox: ${message}`;
        }
      },
    }),
    generateFiles: tool({
      description: generateFilesDescription,
      inputSchema: z.object({
        sandboxId: z.string(),
        paths: z.array(z.string()).min(1),
      }),
      execute: async ({ sandboxId, paths }, { messages, toolCallId }) => {
        const eventId = toolCallId ?? `generateFiles-${Date.now()}`;
        onToolEvent?.({
          kind: "generateFiles",
          id: eventId,
          status: "generating",
          paths,
        });

        try {
          const sandbox = await getOrReconnectSandbox({
            sandboxId,
            getActiveRuntime,
            onRuntimeUpdate,
            onToolEvent,
          });
          const files = await generateFilesForPaths({
            model,
            messages: messages as ModelMessage[],
            paths,
          });

          await sandbox.writeFiles(
            files.map((file) => ({
              path: file.path,
              content: Buffer.from(file.content, "utf8"),
            })),
          );

          await syncSandboxFilesToConvex({ sandbox, onRuntimeUpdate });

          onToolEvent?.({
            kind: "generateFiles",
            id: eventId,
            status: "done",
            paths: files.map((file) => file.path),
          });

          return `Generated and uploaded ${files.length} files with ${modelId}`;
        } catch (error) {
          await onRuntimeUpdate?.({ status: "error" });
          const message = errorMessage(error);
          onToolEvent?.({
            kind: "generateFiles",
            id: eventId,
            status: "error",
            paths,
            error: message,
          });
          return `Error generating files: ${message}`;
        }
      },
    }),
    runCommand: tool({
      description: runCommandDescription,
      inputSchema: z.object({
        sandboxId: z.string(),
        command: z.string(),
        args: z.array(z.string()).optional(),
        sudo: z.boolean().optional(),
        wait: z.boolean(),
      }),
      execute: async ({ sandboxId, command, args = [], sudo, wait }, { toolCallId }) => {
        const eventId = toolCallId ?? `runCommand-${Date.now()}`;
        onToolEvent?.({
          kind: "runCommand",
          id: eventId,
          status: "executing",
          command,
          args,
        });

        try {
          const sandbox = await getOrReconnectSandbox({
            sandboxId,
            getActiveRuntime,
            onRuntimeUpdate,
            onToolEvent,
          });
          const cmd = await sandbox.runCommand({
            detached: true,
            cmd: command,
            args,
            sudo,
          });

          if (!wait) {
            onToolEvent?.({
              kind: "runCommand",
              id: eventId,
              status: "running",
              command,
              args,
            });
            return `Command ${command} ${args.join(
              " ",
            )} is running in sandbox ${sandboxId} with command ID ${cmd.cmdId}.`;
          }

          const done = await cmd.wait();
          const [stdout, stderr] = await Promise.all([
            done.stdout(),
            done.stderr(),
          ]);

          onToolEvent?.({
            kind: "runCommand",
            id: eventId,
            status: "done",
            command,
            args,
            exitCode: done.exitCode,
            stdout,
            stderr,
          });

          return `Command ${command} ${args.join(
            " ",
          )} finished with exit code ${done.exitCode}.\nStdout:\n${stdout}\nStderr:\n${stderr}`;
        } catch (error) {
          await onRuntimeUpdate?.({ status: "error" });
          const message = errorMessage(error);
          onToolEvent?.({
            kind: "runCommand",
            id: eventId,
            status: "error",
            command,
            args,
            error: message,
          });
          return `Error running command: ${message}`;
        }
      },
    }),
    getSandboxURL: tool({
      description: getSandboxUrlDescription,
      inputSchema: z.object({
        sandboxId: z.string(),
        port: z.number(),
      }),
      execute: async ({ sandboxId, port }, { toolCallId }) => {
        const eventId = toolCallId ?? `getSandboxURL-${Date.now()}`;
        onToolEvent?.({
          kind: "getSandboxURL",
          id: eventId,
          status: "loading",
          port,
        });

        try {
          const sandbox = await getOrReconnectSandbox({
            sandboxId,
            getActiveRuntime,
            onRuntimeUpdate,
            onToolEvent,
            ports: [port],
          });
          const previewUrl = sandbox.domain(port);

          await onRuntimeUpdate?.({
            sandboxId,
            previewUrl,
            status: "ready",
          });

          onToolEvent?.({
            kind: "getSandboxURL",
            id: eventId,
            status: "done",
            url: previewUrl,
            port,
          });

          return `Preview URL for sandbox ${sandboxId} on port ${port}: ${previewUrl}`;
        } catch (error) {
          await onRuntimeUpdate?.({ status: "error" });
          const message = errorMessage(error);
          onToolEvent?.({
            kind: "getSandboxURL",
            id: eventId,
            status: "error",
            port,
            error: message,
          });
          return `Error getting sandbox URL: ${message}`;
        }
      },
    }),
    saveSnapshot: tool({
      description: saveSnapshotDescription,
      inputSchema: z.object({
        sandboxId: z.string(),
        // Optional override; defaults to 30 days. Pass 0 to disable expiration.
        expirationMs: z.number().min(0).optional(),
      }),
      execute: async ({ sandboxId, expirationMs }, { toolCallId }) => {
        const eventId = toolCallId ?? `saveSnapshot-${Date.now()}`;
        onToolEvent?.({ kind: "saveSnapshot", id: eventId, status: "loading" });

        const expiration = expirationMs ?? SNAPSHOT_EXPIRATION_MS;

        try {
          const sandbox = await getOrReconnectSandbox({
            sandboxId,
            getActiveRuntime,
            onRuntimeUpdate,
            onToolEvent,
          });
          const snapshot = await sandbox.snapshot({ expiration });
          const expiresAt = snapshot.expiresAt
            ? snapshot.expiresAt.getTime()
            : expiration === 0
              ? null
              : Date.now() + expiration;

          await saveSnapshot?.({
            snapshotId: snapshot.snapshotId,
            expiresAt,
          });

          onToolEvent?.({
            kind: "saveSnapshot",
            id: eventId,
            status: "done",
            snapshotId: snapshot.snapshotId,
            expiresAt: expiresAt ?? undefined,
          });

          return `Snapshot ${snapshot.snapshotId} saved (expires ${
            expiresAt ? new Date(expiresAt).toISOString() : "never"
          }). The sandbox has stopped automatically; reopening this chat will spin up a new sandbox from this snapshot without regenerating files.`;
        } catch (error) {
          const message = errorMessage(error);
          onToolEvent?.({
            kind: "saveSnapshot",
            id: eventId,
            status: "error",
            error: message,
          });
          return `Error saving snapshot: ${message}`;
        }
      },
    }),
    readFile: tool({
      description: "Read the full contents of a file from the Vercel Sandbox. Paths are relative to the sandbox root unless absolute.",
      inputSchema: z.object({
        sandboxId: z.string(),
        path: z.string(),
      }),
      execute: async ({ sandboxId, path }, { toolCallId }) => {
        const eventId = toolCallId ?? `readFile-${Date.now()}`;
        onToolEvent?.({
          kind: "readFile",
          id: eventId,
          status: "reading",
          path,
        });

        try {
          const sandbox = await getOrReconnectSandbox({
            sandboxId,
            getActiveRuntime,
            onRuntimeUpdate,
            onToolEvent,
          });
          const content = await sandbox.fs.readFile(path, "utf8");

          onToolEvent?.({
            kind: "readFile",
            id: eventId,
            status: "done",
            path,
          });

          return content;
        } catch (error) {
          const message = errorMessage(error);
          onToolEvent?.({
            kind: "readFile",
            id: eventId,
            status: "error",
            path,
            error: message,
          });
          return `Error reading file ${path}: ${message}`;
        }
      },
    }),
    writeFile: tool({
      description: "Create or overwrite a file in the Vercel Sandbox. Paths are relative to the sandbox root unless absolute. Automatically creates parent directories.",
      inputSchema: z.object({
        sandboxId: z.string(),
        path: z.string(),
        content: z.string(),
      }),
      execute: async ({ sandboxId, path, content }, { toolCallId }) => {
        const eventId = toolCallId ?? `writeFile-${Date.now()}`;
        onToolEvent?.({
          kind: "writeFile",
          id: eventId,
          status: "writing",
          path,
        });

        try {
          const sandbox = await getOrReconnectSandbox({
            sandboxId,
            getActiveRuntime,
            onRuntimeUpdate,
            onToolEvent,
          });

          // Extract parent directory and create if it doesn't exist
          const parts = path.split("/");
          if (parts.length > 1) {
            const dir = parts.slice(0, -1).join("/");
            if (dir && dir !== "." && dir !== "..") {
              await sandbox.fs.mkdir(dir, { recursive: true });
            }
          }

          await sandbox.fs.writeFile(path, content, "utf8");

          await syncSandboxFilesToConvex({ sandbox, onRuntimeUpdate });

          onToolEvent?.({
            kind: "writeFile",
            id: eventId,
            status: "done",
            path,
          });

          return `Successfully wrote file: ${path}`;
        } catch (error) {
          const message = errorMessage(error);
          onToolEvent?.({
            kind: "writeFile",
            id: eventId,
            status: "error",
            path,
            error: message,
          });
          return `Error writing file ${path}: ${message}`;
        }
      },
    }),
    writeFiles: tool({
      description: "Create or overwrite multiple files in the Vercel Sandbox at once. Paths are relative to the sandbox root unless absolute. Automatically creates parent directories.",
      inputSchema: z.object({
        sandboxId: z.string(),
        files: z.array(z.object({
          path: z.string(),
          content: z.string(),
        })).min(1),
      }),
      execute: async ({ sandboxId, files }, { toolCallId }) => {
        const eventId = toolCallId ?? `writeFiles-${Date.now()}`;
        const paths = files.map(f => f.path);
        onToolEvent?.({
          kind: "writeFiles",
          id: eventId,
          status: "writing",
          paths,
        });

        try {
          const sandbox = await getOrReconnectSandbox({
            sandboxId,
            getActiveRuntime,
            onRuntimeUpdate,
            onToolEvent,
          });

          // Ensure parent directories exist
          for (const file of files) {
            const parts = file.path.split("/");
            if (parts.length > 1) {
              const dir = parts.slice(0, -1).join("/");
              if (dir && dir !== "." && dir !== "..") {
                await sandbox.fs.mkdir(dir, { recursive: true });
              }
            }
          }

          await sandbox.writeFiles(
            files.map((file) => ({
              path: file.path,
              content: file.content,
            })),
          );

          await syncSandboxFilesToConvex({ sandbox, onRuntimeUpdate });

          onToolEvent?.({
            kind: "writeFiles",
            id: eventId,
            status: "done",
            paths,
          });

          return `Successfully wrote ${files.length} files: ${paths.join(", ")}`;
        } catch (error) {
          const message = errorMessage(error);
          onToolEvent?.({
            kind: "writeFiles",
            id: eventId,
            status: "error",
            paths,
            error: message,
          });
          return `Error writing files: ${message}`;
        }
      },
    }),
  };
}
