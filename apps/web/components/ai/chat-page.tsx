"use client"

import type { ToolUIPart } from "ai"
import { CheckIcon, GlobeIcon, MicIcon } from "lucide-react"
import { nanoid } from "nanoid"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
/**
 * @title React AI Chatbot
 * @credit {"name": "Vercel", "url": "https://ai-sdk.dev/elements", "license": {"name": "Apache License 2.0", "url": "https://www.apache.org/licenses/LICENSE-2.0"}}
 * @description React AI chatbot component showcasing a complete chat interface with messages, model selection, and prompt input
 * @opening A full-featured AI chatbot interface combining all the essential components—conversation history with branching message versions, model selector dropdown, prompt input with attachments and tools, streaming responses, and suggestion chips. This demo shows how to wire together Message, Conversation, PromptInput, ModelSelector, Reasoning, and Sources into a cohesive chat experience. Great as a starting point for building your own AI assistant interface.
 * @related [
 *   {"href":"/ai/conversation","title":"React AI Conversation","description":"Chat container with scroll"},
 *   {"href":"/ai/message","title":"React AI Message","description":"Chat message bubbles"},
 *   {"href":"/ai/prompt-input","title":"React AI Prompt Input","description":"Message composition"},
 *   {"href":"/ai/model-selector","title":"React AI Model Selector","description":"LLM model picker"},
 *   {"href":"/ai/reasoning","title":"React AI Reasoning","description":"Thinking process display"},
 *   {"href":"/ai/sources","title":"React AI Sources","description":"Citation display"}
 * ]
 * @questions [
 *   {"id":"chatbot-components","title":"What components does this combine?","answer":"Conversation, Message (with branching), PromptInput (with attachments), ModelSelector, Reasoning, Sources, and Suggestions. It's a comprehensive demo of all chat-related components working together."},
 *   {"id":"chatbot-streaming","title":"How does streaming work?","answer":"The demo simulates streaming by adding words one at a time with delays. In production, you'd use the AI SDK's streaming response and update message content as chunks arrive."},
 *   {"id":"chatbot-branching","title":"What is message branching?","answer":"Users can have multiple versions of a message (like regenerating a response). MessageBranch handles switching between versions with prev/next buttons."},
 *   {"id":"chatbot-customization","title":"How do I customize this?","answer":"Replace the mock data and responses with your actual AI integration. The component structure is modular—swap out ModelSelector providers, add more tools to PromptInput, customize message rendering."}
 * ]
 */
import {
    Attachment,
    AttachmentPreview,
    AttachmentRemove,
    Attachments,
} from "@/components/ai/attachments"
import {
    Conversation,
    ConversationContent,
    ConversationScrollButton,
} from "@/components/ai/conversation"
import {
    Message,
    MessageBranch,
    MessageBranchContent,
    MessageBranchNext,
    MessageBranchPage,
    MessageBranchPrevious,
    MessageBranchSelector,
    MessageContent,
    MessageResponse,
} from "@/components/ai/message"
import {
    ModelSelector,
    ModelSelectorContent,
    ModelSelectorEmpty,
    ModelSelectorGroup,
    ModelSelectorInput,
    ModelSelectorItem,
    ModelSelectorList,
    ModelSelectorLogo,
    ModelSelectorLogoGroup,
    ModelSelectorName,
    ModelSelectorTrigger,
} from "@/components/ai/model-selector"
import {
    PromptInput,
    PromptInputActionAddAttachments,
    PromptInputActionMenu,
    PromptInputActionMenuContent,
    PromptInputActionMenuTrigger,
    PromptInputBody,
    PromptInputButton,
    PromptInputFooter,
    PromptInputHeader,
    type PromptInputMessage,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputTools,
    usePromptInputAttachments,
} from "@/components/ai/prompt-input"
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai/reasoning"
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai/sources"
import { ToolEventCard, type ToolEvent } from "@/components/ai/tool-event-card"

type StreamEvent =
    | { type: "text"; value: string }
    | { type: "tool"; value: ToolEvent }
    | { type: "error"; value: string }

interface MessageType {
    key: string
    from: "user" | "assistant"
    sources?: { href: string; title: string }[]
    versions: {
        id: string
        content: string
    }[]
    reasoning?: {
        content: string
        duration: number
    }
    tools?: {
        name: string
        description: string
        status: ToolUIPart["state"]
        parameters: Record<string, unknown>
        result: string | undefined
        error: string | undefined
    }[]
    toolEvents?: ToolEvent[]
}

type StoredMessage = {
    _id?: string
    role: "user" | "assistant" | "system"
    content: string
    createdAt: number
}

const initialMessages: MessageType[] = []
const models = [
    // OpenAI
    {
        id: "gpt-5.5",
        name: "GPT-5.5",
        chef: "OpenAI",
        chefSlug: "openai",
        providers: ["openai", "azure"],
    },
    {
        id: "gpt-5.5-pro",
        name: "GPT-5.5 Pro",
        chef: "OpenAI",
        chefSlug: "openai",
        providers: ["openai", "azure"],
    },
    {
        id: "gpt-5.5-instant",
        name: "GPT-5.5 Instant",
        chef: "OpenAI",
        chefSlug: "openai",
        providers: ["openai"],
    },

    // Anthropic
    {
        id: "claude-sonnet-4.6",
        name: "Claude 4.6 Sonnet",
        chef: "Anthropic",
        chefSlug: "anthropic",
        providers: ["anthropic", "azure", "google", "amazon-bedrock"],
    },
    {
        id: "claude-opus-4.7",
        name: "Claude 4.7 Opus",
        chef: "Anthropic",
        chefSlug: "anthropic",
        providers: ["anthropic", "azure", "google", "amazon-bedrock"],
    },
    {
        id: "claude-haiku-4.5",
        name: "Claude 4.5 Haiku",
        chef: "Anthropic",
        chefSlug: "anthropic",
        providers: ["anthropic"],
    },

    // Google
    {
        id: "gemini-3.1-pro",
        name: "Gemini 3.1 Pro",
        chef: "Google",
        chefSlug: "google",
        providers: ["google-vertex", "google"],
    },
    {
        id: "gemini-3-flash",
        name: "Gemini 3 Flash",
        chef: "Google",
        chefSlug: "google",
        providers: ["google-vertex", "google"],
    },
    {
        id: "gemini-3-deep-think",
        name: "Gemini 3 Deep Think",
        chef: "Google",
        chefSlug: "google",
        providers: ["google-vertex", "google"],
    },

    // DeepSeek
    {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        chef: "DeepSeek",
        chefSlug: "deepseek",
        providers: ["deepseek", "togetherai", "openrouter"],
    },
    {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        chef: "DeepSeek",
        chefSlug: "deepseek",
        providers: ["deepseek", "togetherai", "openrouter"],
    },

    // Meta (Llama)
    {
        id: "llama-4-maverick",
        name: "Llama 4 Maverick (400B)",
        chef: "Meta",
        chefSlug: "llama",
        providers: ["togetherai", "openrouter", "ollama"],
    },
    {
        id: "llama-4-scout",
        name: "Llama 4 Scout (109B)",
        chef: "Meta",
        chefSlug: "llama",
        providers: ["togetherai", "openrouter", "ollama"],
    },

    // Mistral
    {
        id: "mistral-medium-3.5",
        name: "Mistral Medium 3.5",
        chef: "Mistral",
        chefSlug: "mistral",
        providers: ["mistral", "openrouter"],
    },
    {
        id: "mistral-small-4",
        name: "Mistral Small 4",
        chef: "Mistral",
        chefSlug: "mistral",
        providers: ["mistral", "openrouter", "ollama"],
    },

    // Moonshot AI (Kimi)
    {
        id: "kimi-k2.6",
        name: "Kimi K2.6",
        chef: "Moonshot AI",
        chefSlug: "moonshotai",
        providers: ["moonshotai", "openrouter"],
    },

    // Zhipu AI (GLM)
    {
        id: "glm-5",
        name: "GLM-5",
        chef: "Zhipu AI",
        chefSlug: "zhipuai",
        providers: ["zhipuai", "openrouter"],
    },
]

const mockResponses = [
    "That's a great question! Let me help you understand this concept better. The key thing to remember is that proper implementation requires careful consideration of the underlying principles and best practices in the field.",
    "I'd be happy to explain this topic in detail. From my understanding, there are several important factors to consider when approaching this problem. Let me break it down step by step for you.",
    "This is an interesting topic that comes up frequently. The solution typically involves understanding the core concepts and applying them in the right context. Here's what I recommend...",
    "Great choice of topic! This is something that many developers encounter. The approach I'd suggest is to start with the fundamentals and then build up to more complex scenarios.",
    "That's definitely worth exploring. From what I can see, the best way to handle this is to consider both the theoretical aspects and practical implementation details.",
]

const PromptInputAttachmentsDisplay = () => {
    const attachments = usePromptInputAttachments()

    if (attachments.files.length === 0) {
        return null
    }

    return (
        <Attachments variant="inline">
            {attachments.files.map(attachment => (
                <Attachment
                    data={attachment}
                    key={attachment.id}
                    onRemove={() => attachments.remove(attachment.id)}
                >
                    <AttachmentPreview />
                    <AttachmentRemove />
                </Attachment>
            ))}
        </Attachments>
    )
}

function messagesFromStored(storedMessages: StoredMessage[]): MessageType[] {
    return storedMessages
        .filter(message => message.role === "user" || message.role === "assistant")
        .map(message => {
            const id = message._id || `${message.role}-${message.createdAt}`
            const from: "user" | "assistant" = message.role === "user" ? "user" : "assistant"

            return {
                key: id,
                from,
                versions: [
                    {
                        id,
                        content: message.content,
                    },
                ],
            }
        })
}

export function ChatbotDemo({ chatId }: { chatId?: string }) {
    const [model, setModel] = useState<string>(models[0]?.id ?? "gpt-4o")
    const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
    const [text, setText] = useState<string>("")
    const [useWebSearch, setUseWebSearch] = useState<boolean>(false)
    const [useMicrophone, setUseMicrophone] = useState<boolean>(false)
    const [status, setStatus] = useState<"submitted" | "streaming" | "ready" | "error">("ready")
    const [messages, setMessages] = useState<MessageType[]>(initialMessages)
    const [credits, setCredits] = useState<number>(1) // FREE PLAN CREDITS
    const [_streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
    const hydratedChatRef = useRef<string | null>(null)
    // Mirror of `messages` so we can read the current list synchronously
    // without relying on a setState updater (which React may run multiple
    // times for purity checks).
    const messagesRef = useRef<MessageType[]>(initialMessages)
    useEffect(() => {
        messagesRef.current = messages
    }, [messages])

    const selectedModelData = models.find(m => m.id === model)

    const fetchRealResponse = useCallback(async (messageId: string, messageHistory: MessageType[], selectedModel: string) => {
        if (!chatId) {
            toast.error("Missing chat id — please open the chat from a session URL.")
            setStatus("ready")
            return
        }
        setStatus("streaming")
        setStreamingMessageId(messageId)

        try {
            const backendMessages = messageHistory.map(m => ({
                from: m.from,
                content: m.versions[m.versions.length - 1]?.content || ""
            }))

            // API keys are fetched server-side from Convex per the signed-in user.
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: backendMessages, modelId: selectedModel, chatId })
            })

            if (!response.ok) {
                let errorText = `Request failed with status ${response.status}`
                try {
                    const body = await response.json()
                    if (body && typeof body.error === "string") {
                        errorText = body.error
                    }
                } catch {
                    // Response body wasn't JSON; keep the default error.
                }

                toast.error("AI request failed", { description: errorText })
                setMessages(prev =>
                    prev.map(msg => {
                        if (msg.versions.some(v => v.id === messageId)) {
                            return {
                                ...msg,
                                versions: msg.versions.map(v =>
                                    v.id === messageId
                                        ? { ...v, content: `⚠️ ${errorText}` }
                                        : v,
                                ),
                            }
                        }
                        return msg
                    }),
                )
                setStatus("ready")
                return
            }

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let currentContent = ""
            let buffer = ""

            const applyEvent = (event: StreamEvent) => {
                setMessages(prev =>
                    prev.map(msg => {
                        if (!msg.versions.some(v => v.id === messageId)) {
                            return msg
                        }

                        if (event.type === "text") {
                            currentContent += event.value
                            return {
                                ...msg,
                                versions: msg.versions.map(v =>
                                    v.id === messageId
                                        ? { ...v, content: currentContent }
                                        : v,
                                ),
                            }
                        }

                        if (event.type === "tool") {
                            const existing = msg.toolEvents ?? []
                            const idx = existing.findIndex(e => e.id === event.value.id)
                            const next =
                                idx === -1
                                    ? [...existing, event.value]
                                    : existing.map((e, i) => (i === idx ? event.value : e))
                            return { ...msg, toolEvents: next }
                        }

                        if (event.type === "error") {
                            const errText = `⚠️ ${event.value}`
                            currentContent = currentContent
                                ? `${currentContent}\n\n${errText}`
                                : errText
                            return {
                                ...msg,
                                versions: msg.versions.map(v =>
                                    v.id === messageId
                                        ? { ...v, content: currentContent }
                                        : v,
                                ),
                            }
                        }

                        return msg
                    }),
                )
            }

            const consumeBuffer = (final = false) => {
                let newlineIndex = buffer.indexOf("\n")
                while (newlineIndex !== -1) {
                    const line = buffer.slice(0, newlineIndex).trim()
                    buffer = buffer.slice(newlineIndex + 1)
                    if (line) {
                        try {
                            const parsed = JSON.parse(line) as StreamEvent
                            applyEvent(parsed)
                        } catch (parseError) {
                            console.warn("Could not parse stream line", line, parseError)
                        }
                    }
                    newlineIndex = buffer.indexOf("\n")
                }
                if (final && buffer.trim()) {
                    try {
                        const parsed = JSON.parse(buffer.trim()) as StreamEvent
                        applyEvent(parsed)
                    } catch (parseError) {
                        console.warn("Could not parse trailing line", buffer, parseError)
                    }
                    buffer = ""
                }
            }

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) {
                        buffer += decoder.decode()
                        consumeBuffer(true)
                        break
                    }
                    buffer += decoder.decode(value, { stream: true })
                    consumeBuffer(false)
                }
            }
        } catch (error) {
            console.error(error)
            toast.error("Error communicating with AI API")
        } finally {
            setStatus("ready")
            setStreamingMessageId(null)
        }
    }, [chatId])

    const addUserMessage = useCallback(
        (content: string, selectedModel = model) => {
            // Disabled credit limits for unlimited testing
            /*
            if (credits <= 0) {
                toast.error("You have used your 1 free testing credit. Please upgrade to continue.")
                setStatus("ready")
                return
            }
            
            setCredits(prev => prev - 1)
            */

            const ts = Date.now()
            const userMessage: MessageType = {
                key: `user-${ts}`,
                from: "user",
                versions: [
                    {
                        id: `user-${ts}`,
                        content,
                    },
                ],
            }

            const assistantMessageId = `assistant-${ts}`
            const assistantMessage: MessageType = {
                key: assistantMessageId,
                from: "assistant",
                versions: [
                    {
                        id: assistantMessageId,
                        content: "",
                    },
                ],
            }

            // Build the history synchronously from the ref so we don't depend
            // on the setState updater running before the fetch fires. Side
            // effects must never live inside a setState updater because
            // React may invoke updaters multiple times for purity checks.
            const nextHistory = [...messagesRef.current, userMessage]
            messagesRef.current = [...nextHistory, assistantMessage]
            setMessages(messagesRef.current)

            fetchRealResponse(assistantMessageId, nextHistory, selectedModel)
        },
        [credits, fetchRealResponse, model],
    )

    useEffect(() => {
        if (!chatId || hydratedChatRef.current === chatId) {
            return
        }

        hydratedChatRef.current = chatId
        let cancelled = false

        const hydrate = async () => {
            const pendingKey = `pending_chat_${chatId}`
            const pendingRaw = window.sessionStorage.getItem(pendingKey)

            // Brand-new chat coming from the home page: fire it immediately so
            // the user message renders without waiting for the GET round-trip
            // (which may be empty, slow, or fail on a not-yet-persisted chat).
            if (pendingRaw) {
                window.sessionStorage.removeItem(pendingKey)
                try {
                    const pending = JSON.parse(pendingRaw) as {
                        text?: string
                        modelId?: string
                    }

                    if (pending.modelId) {
                        setModel(pending.modelId)
                    }

                    if (pending.text?.trim()) {
                        addUserMessage(pending.text, pending.modelId || model)
                    }
                } catch (error) {
                    console.error("Could not parse pending chat payload", error)
                    toast.error("Could not start chat from the home page")
                }
                return
            }

            // Otherwise this is an existing chat: hydrate saved history.
            try {
                const response = await fetch(
                    `/api/chat?chatId=${encodeURIComponent(chatId)}`,
                    { cache: "no-store" },
                )
                if (!response.ok) {
                    return
                }

                const data = (await response.json()) as { messages?: StoredMessage[] }
                if (cancelled) {
                    return
                }

                const storedMessages = messagesFromStored(data.messages || [])
                if (storedMessages.length > 0) {
                    setMessages(storedMessages)
                }
            } catch (error) {
                console.error(error)
                toast.error("Unable to load saved chat")
            }
        }

        hydrate()

        return () => {
            cancelled = true
        }
    }, [addUserMessage, chatId, model])

    const handleSubmit = (message: PromptInputMessage) => {
        const hasText = Boolean(message.text)
        const hasAttachments = Boolean(message.files?.length)

        if (!(hasText || hasAttachments)) {
            return
        }

        setStatus("submitted")

        // Notify the workspace shell that the user just engaged with the chat
        // so it can wake a snapshotted sandbox before the agent's first tool
        // call needs it.
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("emergent:chat-message-sent"))
        }

        if (message.files?.length) {
            toast.success("Files attached", {
                description: `${message.files.length} file(s) attached to message`,
            })
        }

        addUserMessage(message.text || "Sent with attachments")
        setText("")
    }

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden">
            <Conversation className="min-h-0 flex-1 scrollbar-hide">
                <ConversationContent>
                    {messages.map(({ versions, ...message }) => (
                        <MessageBranch defaultBranch={0} key={message.key}>
                            <MessageBranchContent>
                                {versions.map(version => (
                                    <Message from={message.from} key={`${message.key}-${version.id}`}>
                                        <div>
                                            {message.sources?.length && (
                                                <Sources>
                                                    <SourcesTrigger count={message.sources.length} />
                                                    <SourcesContent>
                                                        {message.sources.map(source => (
                                                            <Source href={source.href} key={source.href} title={source.title} />
                                                        ))}
                                                    </SourcesContent>
                                                </Sources>
                                            )}
                                            {message.reasoning && (
                                                <Reasoning duration={message.reasoning.duration}>
                                                    <ReasoningTrigger />
                                                    <ReasoningContent>{message.reasoning.content}</ReasoningContent>
                                                </Reasoning>
                                            )}
                                            {message.from === "assistant" && message.toolEvents?.length ? (
                                                <div className="mb-1.5 space-y-1">
                                                    {message.toolEvents.map(toolEvent => (
                                                        <ToolEventCard event={toolEvent} key={toolEvent.id} />
                                                    ))}
                                                </div>
                                            ) : null}
                                            <MessageContent>
                                                <MessageResponse>{version.content}</MessageResponse>
                                            </MessageContent>
                                        </div>
                                    </Message>
                                ))}
                            </MessageBranchContent>
                            {versions.length > 1 && (
                                <MessageBranchSelector from={message.from}>
                                    <MessageBranchPrevious />
                                    <MessageBranchPage />
                                    <MessageBranchNext />
                                </MessageBranchSelector>
                            )}
                        </MessageBranch>
                    ))}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>
            <div className="shrink-0 space-y-2 pt-2">
                <div className="w-full px-3 pb-3">
                    <PromptInput globalDrop multiple onSubmit={handleSubmit}>
                        <PromptInputHeader>
                            <PromptInputAttachmentsDisplay />
                        </PromptInputHeader>
                        <PromptInputBody>
                            <PromptInputTextarea onChange={event => setText(event.target.value)} value={text} />
                        </PromptInputBody>
                        <PromptInputFooter>
                            <PromptInputTools>
                                <PromptInputActionMenu>
                                    <PromptInputActionMenuTrigger />
                                    <PromptInputActionMenuContent>
                                        <PromptInputActionAddAttachments />
                                    </PromptInputActionMenuContent>
                                </PromptInputActionMenu>
                                <PromptInputButton
                                    onClick={() => setUseMicrophone(!useMicrophone)}
                                    variant={useMicrophone ? "default" : "ghost"}
                                >
                                    <MicIcon size={16} />
                                    <span className="sr-only">Microphone</span>
                                </PromptInputButton>
                                <PromptInputButton
                                    onClick={() => setUseWebSearch(!useWebSearch)}
                                    variant={useWebSearch ? "default" : "ghost"}
                                >
                                    <GlobeIcon size={16} />
                                    <span>Search</span>
                                </PromptInputButton>
                                <ModelSelector onOpenChange={setModelSelectorOpen} open={modelSelectorOpen}>
                                    <ModelSelectorTrigger asChild>
                                        <PromptInputButton>
                                            {selectedModelData?.chefSlug && (
                                                <ModelSelectorLogo provider={selectedModelData.chefSlug} />
                                            )}
                                            {selectedModelData?.name && (
                                                <ModelSelectorName>{selectedModelData.name}</ModelSelectorName>
                                            )}
                                        </PromptInputButton>
                                    </ModelSelectorTrigger>
                                    <ModelSelectorContent>
                                        <ModelSelectorInput placeholder="Search models..." />
                                        <ModelSelectorList>
                                            <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                                            {Array.from(new Set(models.map(m => m.chef))).map(chef => (
                                                <ModelSelectorGroup heading={chef} key={chef}>
                                                    {models
                                                        .filter(m => m.chef === chef)
                                                        .map(m => (
                                                            <ModelSelectorItem
                                                                key={m.id}
                                                                onSelect={() => {
                                                                    setModel(m.id)
                                                                    setModelSelectorOpen(false)
                                                                }}
                                                                value={m.id}
                                                            >
                                                                <ModelSelectorLogo provider={m.chefSlug} />
                                                                <ModelSelectorName>{m.name}</ModelSelectorName>
                                                                <ModelSelectorLogoGroup>
                                                                    {m.providers.map(provider => (
                                                                        <ModelSelectorLogo key={provider} provider={provider} />
                                                                    ))}
                                                                </ModelSelectorLogoGroup>
                                                                {model === m.id ? (
                                                                    <CheckIcon className="ml-auto size-4" />
                                                                ) : (
                                                                    <div className="ml-auto size-4" />
                                                                )}
                                                            </ModelSelectorItem>
                                                        ))}
                                                </ModelSelectorGroup>
                                            ))}
                                        </ModelSelectorList>
                                    </ModelSelectorContent>
                                </ModelSelector>
                            </PromptInputTools>
                            <PromptInputSubmit
                                disabled={!(text.trim() || status) || status === "streaming"}
                                status={status}
                            />
                        </PromptInputFooter>
                    </PromptInput>
                </div>
            </div>
        </div>
    )
}

export default ChatbotDemo
