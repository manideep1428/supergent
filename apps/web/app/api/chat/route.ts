import { createVertex } from "@ai-sdk/google-vertex";
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
import { SYSTEM_PROMPT } from "./prompt";

export const dynamic = "force-dynamic";

type ClientMessage = {
  from: "user" | "assistant";
  content: string;
};

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
    googleKey: process.env.GOOGLE_VERTEX_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || null,
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
  if (entry.directId && entry.chef === "google") {
    if (keys.googleKey) {
      return createVertex({ location: "global", project: "project-bc5ac9e3-64ad-4974-961", apiKey: keys.googleKey })(entry.directId);
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return createVertex()(entry.directId);
    }
    if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      return createVertex({
        project: process.env.GOOGLE_PROJECT_ID,
        googleAuthOptions: {
          credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          },
        },
      })(entry.directId);
    }
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

/**
 * Save a placeholder assistant message with "streaming" status BEFORE the
 * AI stream starts. Returns the Convex document ID so we can update it in
 * onFinish. This guarantees the DB always has an assistant row — even if the
 * user refreshes mid-stream — which prevents the "auto-resend" loop.
 */
async function saveStreamingPlaceholder({
  chatId,
  userId,
  userEmail,
  modelId,
}: {
  chatId: string;
  userId: string;
  userEmail: string | null;
  modelId: string | null;
}): Promise<string | null> {
  const convex = getConvexClient();
  if (!convex) return null;

  try {
    const id = await convex.mutation(api.chats.addMessage, {
      chatId,
      userId,
      userEmail,
      role: "assistant" as const,
      content: "",
      modelId,
      status: "streaming" as const,
    });
    return id as unknown as string;
  } catch (error) {
    console.error("Failed to save streaming placeholder to Convex", error);
    return null;
  }
}

/**
 * Update an existing message's content and status (used to finalise the
 * streaming placeholder once the AI finishes generating).
 */
async function updateChatMessage({
  messageId,
  chatId,
  userId,
  content,
  status,
  reasoning,
  toolEvents,
}: {
  messageId: string;
  chatId: string;
  userId: string;
  content: string;
  status: "saved" | "streaming" | "error";
  reasoning?: string;
  toolEvents?: any[];
}) {
  const convex = getConvexClient();
  if (!convex) return;

  try {
    await convex.mutation(api.chats.updateMessage, {
      messageId: messageId as any,
      chatId,
      userId,
      content,
      status,
      reasoning,
      toolEvents,
    });
  } catch (error) {
    console.error("Failed to update chat message in Convex", error);
  }
}

async function saveRuntimeUpdate({
  chatId,
  userId,
  sandboxId,
  previewUrl,
  generatedFiles,
  files,
  status,
  overwriteGeneratedFiles,
}: {
  chatId: string;
  userId: string;
  sandboxId?: string;
  previewUrl?: string;
  generatedFiles?: string[];
  files?: { path: string; content: string }[];
  status?: "creating" | "ready" | "error";
  overwriteGeneratedFiles?: boolean;
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
      overwriteGeneratedFiles,
    });

    if (files && files.length > 0) {
      await convex.mutation(api.chats.saveFilesBatch, {
        chatId,
        userId,
        files,
      });
    }
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

    const convex = getConvexClient();
    if (!convex) {
      return new Response(JSON.stringify({ error: "Database configuration error" }), { status: 500 });
    }

    const userCredits = await convex.query(api.credits.getCredits, { userId: user.id });
    const isFreePlan = !userCredits || !userCredits.initialized || userCredits.lifetimeIssued <= 5;
    const isFreeModel = modelEntry.id === "gemini-3.5-flash" || modelEntry.id === "deepseek-v4-flash";

    if (isFreePlan && !isFreeModel) {
      return new Response(
        JSON.stringify({
          error: `Only Gemini 3.5 Flash and DeepSeek V4 Flash are allowed on the Free Plan. Please upgrade to Pro to use ${modelEntry.name}.`,
        }),
        { status: 403 },
      );
    }

    const balance = userCredits?.balance ?? 0;
    if (balance <= 0) {
      return new Response(
        JSON.stringify({
          error: "You have run out of credits. Please purchase more credits or upgrade to use this model.",
        }),
        { status: 402 },
      );
    }

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
      if (modelEntry.chef === "google" || modelEntry.id === "gemini-3.5-flash") {
        console.log(`[Gemini AI Event] Request started. User: ${user.id}, Chat: ${chatId}, Model: ${modelEntry.id}`);
      }
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

    const writeReasoning = (
      kind: "start" | "delta" | "end",
      text: string,
    ) => {
      enqueue(JSON.stringify({ type: `reasoning-${kind}`, value: text }));
    };

    let accumulatedText = "";
    let currentReasoning = "";
    const toolEvents: ToolEvent[] = [];
    let hasError = false;
    let isFinished = false;

    let lastSavedText = "";
    let lastSavedReasoning = "";
    let lastSavedToolEventsStr = "";
    let lastSavedTime = Date.now();
    let isUpdating = false;

    const checkAndSave = async (force = false) => {
      if (!streamingMessageId || isFinished) return;

      const now = Date.now();
      const textChanged = accumulatedText !== lastSavedText;
      const reasoningChanged = currentReasoning !== lastSavedReasoning;
      const currentToolEventsStr = JSON.stringify(toolEvents);
      const toolEventsChanged = currentToolEventsStr !== lastSavedToolEventsStr;

      if (
        force ||
        toolEventsChanged ||
        ((textChanged || reasoningChanged) && now - lastSavedTime > 800)
      ) {
        if (isUpdating && !force) return;
        isUpdating = true;
        try {
          await updateChatMessage({
            messageId: streamingMessageId,
            chatId,
            userId: user.id,
            content: accumulatedText.trim(),
            status: "streaming",
            reasoning: currentReasoning || undefined,
            toolEvents: toolEvents.length > 0 ? toolEvents : undefined,
          });
          lastSavedText = accumulatedText;
          lastSavedReasoning = currentReasoning;
          lastSavedToolEventsStr = currentToolEventsStr;
          lastSavedTime = now;
        } catch (dbError) {
          console.error("Failed to update real-time message", dbError);
        } finally {
          isUpdating = false;
        }
      }
    };

    const saveFinalState = async () => {
      if (!streamingMessageId || isFinished) return;
      isFinished = true;
      try {
        await updateChatMessage({
          messageId: streamingMessageId,
          chatId,
          userId: user.id,
          content: accumulatedText.trim() || (hasError ? "⚠️ Generation error" : "(empty response)"),
          status: hasError ? "error" : "saved",
          reasoning: currentReasoning || undefined,
          toolEvents: toolEvents.length > 0 ? toolEvents : undefined,
        });
      } catch (dbError) {
        console.error("Failed to update final message", dbError);
      }
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
          files: update.files,
          status: update.status,
          overwriteGeneratedFiles: update.overwriteGeneratedFiles,
        }),
      onToolEvent: (event) => {
        writeEvent(event);
        const idx = toolEvents.findIndex((e) => e.id === event.id);
        if (idx === -1) {
          toolEvents.push(event);
        } else {
          toolEvents[idx] = event;
        }
        checkAndSave(true);
      },
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

    // Save a streaming placeholder so the DB always has an assistant row.
    // If the user refreshes mid-stream, the placeholder prevents auto-resend.
    const streamingMessageId = await saveStreamingPlaceholder({
      chatId,
      userId: user.id,
      userEmail: user.email || null,
      modelId: modelEntry.id,
    });

    const result = streamText({
      model: aiModel,
      messages: formattedMessages,
      system: SYSTEM_PROMPT,
      stopWhen: stepCountIs(20),
      tools,
      onFinish: async ({ text, usage }) => {
        if (modelEntry.chef === "google" || modelEntry.id === "gemini-3.5-flash") {
          console.log(`[Gemini AI Event] Request finished. User: ${user.id}, Chat: ${chatId}, Model: ${modelEntry.id}, Usage:`, usage, `Text Length: ${text?.length ?? 0}`);
        }
        // Only fallback to saveChatMessage if we don't have a streaming placeholder
        if (!streamingMessageId) {
          await saveChatMessage({
            chatId,
            userId: user.id,
            userEmail: user.email || null,
            role: "assistant",
            content: text,
            modelId: modelEntry.id,
          });
        }

        // AI SDK v6 returns { inputTokens, outputTokens, totalTokens };
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
        let inputTokens =
          usageAny?.inputTokens ?? usageAny?.promptTokens ?? 0;
        let outputTokens =
          usageAny?.outputTokens ?? usageAny?.completionTokens ?? 0;

        // Fallback: if onFinish gave us 0s, try the awaitable result.usage promise
        if (inputTokens === 0 && outputTokens === 0) {
          try {
            const resolvedUsage = await result.usage as {
              inputTokens?: number
              outputTokens?: number
              promptTokens?: number
              completionTokens?: number
            } | null | undefined;
            inputTokens = resolvedUsage?.inputTokens ?? resolvedUsage?.promptTokens ?? 0;
            outputTokens = resolvedUsage?.outputTokens ?? resolvedUsage?.completionTokens ?? 0;
          } catch {
            // result.usage not available, skip
          }
        }

        console.log(`[usage] model=${modelEntry.id} input=${inputTokens} output=${outputTokens}`);

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
                accumulatedText += delta;
                writeText(delta);
                checkAndSave();
              } else if (part.type === "reasoning-start") {
                writeReasoning("start", "");
              } else if (part.type === "reasoning-delta") {
                const delta =
                  (part as unknown as { text?: string; textDelta?: string })
                    .text ??
                  (part as unknown as { text?: string; textDelta?: string })
                    .textDelta ??
                  "";
                if (delta) {
                  currentReasoning += delta;
                  writeReasoning("delta", delta);
                  checkAndSave();
                }
              } else if (part.type === "reasoning-end") {
                writeReasoning("end", "");
              } else if (part.type === "error") {
                const err = (part as unknown as { error?: unknown }).error;
                writeError(
                  err instanceof Error ? err.message : String(err ?? "Unknown error"),
                );
              }
            }
          } catch (error: any) {
            hasError = true;
            writeError(error?.message ?? String(error));
          } finally {
            controller.close();
            pushChunk = null;
            await saveFinalState();
          }
        })();
      },
      cancel() {
        saveFinalState();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        ...(streamingMessageId ? { "x-message-id": streamingMessageId } : {}),
      },
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
