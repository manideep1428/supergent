import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGateway } from "@ai-sdk/gateway";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createMistral } from "@ai-sdk/mistral";
import { createGroq } from "@ai-sdk/groq";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { stepCountIs, streamText, type LanguageModel, type ModelMessage } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "backend/convex/_generated/api";
import { createSandboxTools, type ToolEvent } from "@/lib/sandbox-tools";
import { getModelEntry, type ModelEntry } from "@/lib/models";

type ClientMessage = {
  from: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `You are the Emergent app-building agent running with Vercel Sandbox tools.

Use the sandbox workflow:
1. Create exactly one sandbox per chat with createSandbox. If the tool reports the sandbox was created from a saved snapshot, the previously generated files and installed dependencies are already present - skip generateFiles and pnpm install entirely. Otherwise generate files and install dependencies normally.
2. Generate complete runnable files for the requested app (only when there is no snapshot).
3. Install dependencies with pnpm (only when there is no snapshot).
4. Start the dev server with pnpm run dev in the background using runCommand with wait false.
5. Get the sandbox URL for the preview port.
6. Once the user confirms the app works, you MAY call saveSnapshot to persist a 30-day snapshot. Calling saveSnapshot stops the running sandbox, so do not call it while the user still expects to interact with the preview in the same session.

Prefer Next.js for new frontend apps. Use next@16.0.10 or newer, app/layout.tsx, app/page.tsx, app/globals.css, and next.config.js or next.config.mjs. Never generate lock files, node_modules, .next, or build artifacts. Use relative paths and do not use cd or shell chaining.

Keep user-facing replies short and tell the user what was created or what failed.`;

type ResolvedKeys = {
  vercelKey: string | null;
  openaiKey: string | null;
  anthropicKey: string | null;
  googleKey: string | null;
  deepseekKey: string | null;
  mistralKey: string | null;
  groqKey: string | null;
  moonshotKey: string | null;
};

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  if (!url) {
    return null;
  }

  return new ConvexHttpClient(url);
}

function toClientMessages(messages: unknown): ClientMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "from" in message &&
        "content" in message
      ) {
        const from = message.from === "user" ? "user" : "assistant";
        const content = typeof message.content === "string" ? message.content : "";

        return { from, content };
      }

      return null;
    })
    .filter((message): message is ClientMessage => Boolean(message && message.content.trim()));
}

async function resolveKeysForUser(userId: string): Promise<ResolvedKeys> {
  const keys: ResolvedKeys = {
    vercelKey: process.env.VERCEL_API_KEY || process.env.AI_GATEWAY_API_KEY || null,
    openaiKey: process.env.OPENAI_API_KEY || null,
    anthropicKey: process.env.ANTHROPIC_API_KEY || null,
    googleKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || null,
    deepseekKey: process.env.DEEPSEEK_API_KEY || null,
    mistralKey: process.env.MISTRAL_API_KEY || null,
    groqKey: process.env.GROQ_API_KEY || null,
    moonshotKey: process.env.MOONSHOT_API_KEY || null,
  };

  const convex = getConvexClient();
  if (!convex) {
    return keys;
  }

  try {
    const stored = await convex.query(api.apiKeys.getKeys, { userId });
    const trimmed = (value: string | null | undefined) =>
      typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

    keys.vercelKey = trimmed(stored.vercelKey) ?? keys.vercelKey;
    keys.openaiKey = trimmed(stored.openaiKey) ?? keys.openaiKey;
    keys.anthropicKey = trimmed(stored.anthropicKey) ?? keys.anthropicKey;
    keys.googleKey = trimmed(stored.googleKey) ?? keys.googleKey;
    keys.deepseekKey = trimmed(stored.deepseekKey) ?? keys.deepseekKey;
    keys.mistralKey = trimmed(stored.mistralKey) ?? keys.mistralKey;
    keys.groqKey = trimmed(stored.groqKey) ?? keys.groqKey;
    keys.moonshotKey = trimmed(stored.moonshotKey) ?? keys.moonshotKey;
  } catch (error) {
    console.error("Failed to load API keys from Convex", error);
  }

  return keys;
}

function pickAiModel(entry: ModelEntry, keys: ResolvedKeys): LanguageModel {
  if (entry.directId && entry.chef === "openai" && keys.openaiKey) {
    return createOpenAI({ apiKey: keys.openaiKey })(entry.directId);
  }
  if (entry.directId && entry.chef === "anthropic" && keys.anthropicKey) {
    return createAnthropic({ apiKey: keys.anthropicKey })(entry.directId);
  }
  if (entry.directId && entry.chef === "google" && keys.googleKey) {
    return createGoogleGenerativeAI({ apiKey: keys.googleKey })(entry.directId);
  }
  if (entry.directId && entry.chef === "deepseek" && keys.deepseekKey) {
    return createDeepSeek({ apiKey: keys.deepseekKey })(entry.directId);
  }
  if (entry.directId && entry.chef === "mistral" && keys.mistralKey) {
    return createMistral({ apiKey: keys.mistralKey })(entry.directId);
  }
  if (entry.directId && entry.chef === "meta" && keys.groqKey) {
    return createGroq({ apiKey: keys.groqKey })(entry.directId);
  }
  if (entry.directId && entry.chef === "moonshotai" && keys.moonshotKey) {
    return createMoonshotAI({ apiKey: keys.moonshotKey })(entry.directId);
  }

  if (!keys.vercelKey) {
    throw new Error(
      `No API key configured for ${entry.chef}. Add a Vercel AI Gateway key (or a direct ${entry.chef} key) at /settings/keys.`,
    );
  }

  return createGateway({ apiKey: keys.vercelKey })(entry.gatewayId);
}

async function saveChatMessage({
  chatId,
  userId,
  userEmail,
  role,
  content,
  modelId,
}: {
  chatId: string;
  userId: string;
  userEmail: string | null;
  role: "user" | "assistant";
  content: string;
  modelId: string | null;
}) {
  const convex = getConvexClient();
  if (!convex || !content.trim()) {
    return;
  }

  try {
    await convex.mutation(api.chats.addMessage, {
      chatId,
      userId,
      userEmail,
      role,
      content,
      modelId,
      status: "saved",
    });
  } catch (error) {
    console.error("Failed to save chat message to Convex", error);
  }
}

async function saveRuntimeUpdate({
  chatId,
  userId,
  sandboxId,
  previewUrl,
  generatedFiles,
  status,
}: {
  chatId: string;
  userId: string;
  sandboxId?: string;
  previewUrl?: string;
  generatedFiles?: string[];
  status?: "creating" | "ready" | "error";
}) {
  const convex = getConvexClient();
  if (!convex) {
    return;
  }

  try {
    await convex.mutation(api.chats.updateRuntime, {
      chatId,
      userId,
      sandboxId: sandboxId ?? null,
      previewUrl: previewUrl ?? null,
      generatedFiles,
      status,
    });
  } catch (error) {
    console.error("Failed to save sandbox runtime to Convex", error);
  }
}

async function getActiveRuntimeForChat({
  chatId,
  userId,
}: {
  chatId: string;
  userId: string;
}) {
  const convex = getConvexClient();
  if (!convex) return null;
  try {
    const runtime = await convex.query(api.chats.getActiveRuntime, {
      chatId,
      userId,
    });
    return runtime ?? null;
  } catch (error) {
    console.error("Failed to load sandbox runtime from Convex", error);
    return null;
  }
}

async function persistSandboxSnapshot({
  chatId,
  userId,
  snapshotId,
  expiresAt,
}: {
  chatId: string;
  userId: string;
  snapshotId: string;
  expiresAt: number | null;
}) {
  const convex = getConvexClient();
  if (!convex) return;
  try {
    await convex.mutation(api.chats.saveSandboxSnapshot, {
      chatId,
      userId,
      snapshotId,
      expiresAt,
    });
  } catch (error) {
    console.error("Failed to save snapshot to Convex", error);
  }
}

export async function GET(req: Request) {
  const { user } = await withAuth();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const chatId = new URL(req.url).searchParams.get("chatId");
  if (!chatId) {
    return new Response(JSON.stringify({ error: "Missing chatId" }), { status: 400 });
  }

  const convex = getConvexClient();
  if (!convex) {
    return Response.json({ app: null, messages: [] });
  }

  try {
    const result = await convex.query(api.chats.list, {
      chatId,
      userId: user.id,
    });

    return Response.json(result);
  } catch (error: any) {
    console.error("Failed to load chat from Convex", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { messages, modelId, chatId } = await req.json();
    const { user } = await withAuth();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    if (typeof chatId !== "string" || !chatId.trim()) {
      return new Response(JSON.stringify({ error: "Missing chatId" }), { status: 400 });
    }

    const clientMessages = toClientMessages(messages);
    const latestUserMessage = [...clientMessages]
      .reverse()
      .find((message) => message.from === "user");

    const resolvedModelId = typeof modelId === "string" ? modelId : null;
    const modelEntry = getModelEntry(resolvedModelId);

    if (latestUserMessage) {
      await saveChatMessage({
        chatId,
        userId: user.id,
        userEmail: user.email || null,
        role: "user",
        content: latestUserMessage.content,
        modelId: resolvedModelId,
      });
    }

    const keys = await resolveKeysForUser(user.id);

    let aiModel: LanguageModel;
    try {
      aiModel = pickAiModel(modelEntry, keys);
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          error:
            error?.message ||
            "Could not resolve a model. Configure your API keys at /settings/keys.",
        }),
        { status: 400 },
      );
    }

    const formattedMessages: ModelMessage[] = clientMessages.map((m) => {
      const role: "user" | "assistant" = m.from === "user" ? "user" : "assistant";
      return {
        role,
        content: m.content,
      };
    });

    // NDJSON stream wiring -----------------------------------------------------
    const encoder = new TextEncoder();
    let pushChunk: ((line: string) => void) | null = null;
    let pendingEvents: string[] = [];

    const enqueue = (line: string) => {
      if (pushChunk) {
        pushChunk(line);
      } else {
        pendingEvents.push(line);
      }
    };

    const writeEvent = (event: ToolEvent) => {
      enqueue(JSON.stringify({ type: "tool", value: event }));
    };

    const writeText = (text: string) => {
      if (!text) return;
      enqueue(JSON.stringify({ type: "text", value: text }));
    };

    const writeError = (errorText: string) => {
      enqueue(JSON.stringify({ type: "error", value: errorText }));
    };

    const tools = createSandboxTools({
      chatId,
      model: aiModel,
      modelId: modelEntry.id,
      onRuntimeUpdate: (update) =>
        saveRuntimeUpdate({
          chatId,
          userId: user.id,
          sandboxId: update.sandboxId,
          previewUrl: update.previewUrl,
          generatedFiles: update.generatedFiles,
          status: update.status,
        }),
      onToolEvent: (event) => writeEvent(event),
      getActiveRuntime: () =>
        getActiveRuntimeForChat({ chatId, userId: user.id }),
      saveSnapshot: ({ snapshotId, expiresAt }) =>
        persistSandboxSnapshot({
          chatId,
          userId: user.id,
          snapshotId,
          expiresAt,
        }),
    });

    const result = streamText({
      model: aiModel,
      messages: formattedMessages,
      system: SYSTEM_PROMPT,
      stopWhen: stepCountIs(20),
      tools,
      onFinish: async ({ text, usage }) => {
        await saveChatMessage({
          chatId,
          userId: user.id,
          userEmail: user.email || null,
          role: "assistant",
          content: text,
          modelId: modelEntry.id,
        });

        // AI SDK v6 typically returns { inputTokens, outputTokens, totalTokens };
        // older runtimes used { promptTokens, completionTokens }. Read both
        // defensively and skip the ledger entry if we got nothing usable.
        const usageAny = usage as
          | {
              inputTokens?: number
              outputTokens?: number
              promptTokens?: number
              completionTokens?: number
            }
          | null
          | undefined;
        const inputTokens =
          usageAny?.inputTokens ?? usageAny?.promptTokens ?? 0;
        const outputTokens =
          usageAny?.outputTokens ?? usageAny?.completionTokens ?? 0;

        if (inputTokens > 0 || outputTokens > 0) {
          const convex = getConvexClient();
          if (convex) {
            try {
              await convex.mutation(api.credits.recordUsage, {
                userId: user.id,
                chatId,
                modelId: modelEntry.id,
                inputTokens,
                outputTokens,
              });
            } catch (error) {
              console.error("Failed to record token usage", error);
            }
          }
        }
      },
    });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        pushChunk = (line: string) => {
          controller.enqueue(encoder.encode(line + "\n"));
        };

        // Flush any tool events that fired before the stream consumer started.
        for (const line of pendingEvents) {
          pushChunk(line);
        }
        pendingEvents = [];

        (async () => {
          try {
            for await (const part of result.fullStream) {
              if (part.type === "text-delta") {
                const delta =
                  (part as unknown as { textDelta?: string; text?: string })
                    .textDelta ??
                  (part as unknown as { textDelta?: string; text?: string })
                    .text ??
                  "";
                writeText(delta);
              } else if (part.type === "error") {
                const err = (part as unknown as { error?: unknown }).error;
                writeError(
                  err instanceof Error ? err.message : String(err ?? "Unknown error"),
                );
              }
            }
          } catch (error: any) {
            writeError(error?.message ?? String(error));
          } finally {
            controller.close();
            pushChunk = null;
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
