"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, GlobeIcon, MicIcon } from "lucide-react"
import { nanoid } from "nanoid"
import { toast } from "sonner"
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
    Attachment,
    AttachmentPreview,
    AttachmentRemove,
    Attachments,
} from "@/components/ai/attachments"

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

export function HomeChatBox() {
    const router = useRouter()
    const [model, setModel] = useState<string>(models[0]?.id ?? "gpt-5.5")
    const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
    const [text, setText] = useState<string>("")
    const [useWebSearch, setUseWebSearch] = useState<boolean>(false)
    const [useMicrophone, setUseMicrophone] = useState<boolean>(false)
    const [status, setStatus] = useState<"submitted" | "streaming" | "ready" | "error">("ready")

    const selectedModelData = models.find(m => m.id === model)

    const handleSubmit = (message: PromptInputMessage) => {
        const hasText = Boolean(message.text)
        const hasAttachments = Boolean(message.files?.length)

        if (!(hasText || hasAttachments)) {
            return
        }

        setStatus("submitted")

        // In a real app, you might save the initial message to a database,
        // create a new chat session, and then redirect.
        const chatId = nanoid()
        const initialText = message.text || "Sent with attachments"

        window.sessionStorage.setItem(
            `pending_chat_${chatId}`,
            JSON.stringify({
                text: initialText,
                modelId: model,
            }),
        )

        router.push(`/chat/${chatId}`)
    }

    return (
        <div className="flex flex-1 w-full flex-col items-center justify-center p-4">
            <div className="w-full max-w-3xl space-y-8 mb-20">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground/90">
                        Build anything you want <br className="hidden sm:block" />
                        <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">wherever you want.</span>
                    </h1>
                </div>

                <div className="w-full">
                    <PromptInput globalDrop multiple onSubmit={handleSubmit}>
                        <PromptInputHeader>
                            <PromptInputAttachmentsDisplay />
                        </PromptInputHeader>
                        <PromptInputBody>
                            <PromptInputTextarea
                                onChange={event => setText(event.target.value)}
                                value={text}
                                className="min-h-[80px]"
                            />
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
