"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, Lock, Crown, Loader2Icon } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@workspace/ui/components/dialog"
import { nanoid } from "nanoid"
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
import { useSelectedModel } from "@/lib/use-selected-model"

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
        id: "gemini-3.5-flash",
        name: "Gemini 3.5 Flash",
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

const PENDING_HOME_PROMPT_KEY = "supergent_pending_home_prompt"

type PendingHomePrompt = {
    text: string
    modelId: string
}

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

export function HomeChatBox({ isSignedIn }: { isSignedIn: boolean }) {
    const router = useRouter()
    const [model, setModel] = useSelectedModel(
        models.map(m => m.id),
        "gemini-3.5-flash",
    )
    const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
    const [text, setText] = useState<string>("")

    const [status, setStatus] = useState<"submitted" | "streaming" | "ready" | "error">("ready")
    const [isFreePlan, setIsFreePlan] = useState<boolean>(true)
    const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)
    const resumedPendingPromptRef = useRef(false)

    useEffect(() => {
        if (!isSignedIn) return
        let cancelled = false
        fetch("/api/credits", { cache: "no-store" })
            .then(r => r.ok ? r.json() : null)
            .then((data: { credits?: { lifetimeIssued: number } } | null) => {
                if (!cancelled && data?.credits) {
                    setIsFreePlan(data.credits.lifetimeIssued <= 5)
                }
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [isSignedIn])

    const selectedModelData = models.find(m => m.id === model)

    const startChat = useCallback(
        (initialText: string, selectedModel: string) => {
            const chatId = nanoid()

            window.sessionStorage.setItem(
                `pending_chat_${chatId}`,
                JSON.stringify({
                    text: initialText,
                    modelId: selectedModel,
                }),
            )

            window.location.assign(`/chat/${chatId}`)
        },
        [],
    )

    useEffect(() => {
        if (!isSignedIn || resumedPendingPromptRef.current) {
            return
        }

        resumedPendingPromptRef.current = true

        const pendingRaw = window.localStorage.getItem(PENDING_HOME_PROMPT_KEY)
        if (!pendingRaw) {
            return
        }

        window.localStorage.removeItem(PENDING_HOME_PROMPT_KEY)

        try {
            const pending = JSON.parse(pendingRaw) as Partial<PendingHomePrompt>
            const pendingText = pending.text?.trim()

            if (pending.modelId) {
                setModel(pending.modelId)
            }

            if (pendingText) {
                setStatus("submitted")
                startChat(pendingText, pending.modelId || model)
            }
        } catch (error) {
            console.error("Could not restore pending prompt", error)
        }
    }, [isSignedIn, model, startChat])

    const handleSubmit = (message: PromptInputMessage) => {
        const hasText = Boolean(message.text)
        const hasAttachments = Boolean(message.files?.length)

        if (!(hasText || hasAttachments)) {
            return
        }

        setStatus("submitted")

        const initialText = message.text || "Sent with attachments"

        if (!isSignedIn) {
            window.localStorage.setItem(
                PENDING_HOME_PROMPT_KEY,
                JSON.stringify({
                    text: initialText,
                    modelId: model,
                }),
            )
            window.location.assign("/login?returnTo=/")
            return
        }

        startChat(initialText, model)
    }

    const handleSignIn = () => {
        const trimmedText = text.trim()

        if (trimmedText) {
            window.localStorage.setItem(
                PENDING_HOME_PROMPT_KEY,
                JSON.stringify({
                    text: trimmedText,
                    modelId: model,
                }),
            )
        }

        window.location.assign("/login?returnTo=/")
    }

    const handleSignUp = () => {
        const trimmedText = text.trim()

        if (trimmedText) {
            window.localStorage.setItem(
                PENDING_HOME_PROMPT_KEY,
                JSON.stringify({
                    text: trimmedText,
                    modelId: model,
                }),
            )
        }

        window.location.assign("/login?screen_hint=sign-up&returnTo=/")
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
                                onKeyDown={e => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault()
                                        if (status === "ready" && text.trim()) {
                                            handleSubmit({ text, files: [] })
                                        }
                                        return
                                    }
                                    if (e.key === "Enter" && e.shiftKey) {
                                        // Shift+Enter = insert a real newline
                                        e.preventDefault()
                                        const el = e.currentTarget
                                        const start = el.selectionStart ?? 0
                                        const end = el.selectionEnd ?? 0
                                        const newValue = el.value.substring(0, start) + "\n" + el.value.substring(end)
                                        setText(newValue)
                                        // Restore cursor position after the newline
                                        requestAnimationFrame(() => {
                                            el.selectionStart = el.selectionEnd = start + 1
                                        })
                                    }
                                }}
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

                                <ModelSelector onOpenChange={setModelSelectorOpen} open={modelSelectorOpen}>
                                    <ModelSelectorTrigger asChild>
                                        <PromptInputButton className="flex gap-1.5 items-center">
                                            {selectedModelData?.chefSlug && (
                                                <ModelSelectorLogo provider={selectedModelData.chefSlug} />
                                            )}
                                            {selectedModelData?.name && (
                                                <ModelSelectorName className="flex items-center gap-1">
                                                    {selectedModelData.name}
                                                    {(selectedModelData.id === "gemini-3.5-flash" || selectedModelData.id === "deepseek-v4-flash") && isFreePlan && (
                                                         <span className="px-1 py-0.2 text-[8px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                                                             Free
                                                         </span>
                                                     )}
                                                </ModelSelectorName>
                                            )}
                                            <ChevronDownIcon className="size-3.5 shrink-0 opacity-50 ml-auto" />
                                        </PromptInputButton>
                                    </ModelSelectorTrigger>
                                    <ModelSelectorContent>
                                        <ModelSelectorInput placeholder="Search models..." />
                                        <ModelSelectorList>
                                            <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                                            {Array.from(new Set(models.map(m => m.chef)))
                                                .sort((a, b) => {
                                                    const aFree = a === "Google" || a === "DeepSeek";
                                                    const bFree = b === "Google" || b === "DeepSeek";
                                                    if (aFree && !bFree) return -1;
                                                    if (!aFree && bFree) return 1;
                                                    return 0;
                                                })
                                                .map(chef => (
                                                <ModelSelectorGroup heading={chef} key={chef}>
                                                    {models
                                                        .filter(m => m.chef === chef)
                                                        .map(m => {
                                                             const isFree = m.id === "gemini-3.5-flash" || m.id === "deepseek-v4-flash";
                                                             const isAllowed = !isFreePlan || isFree;
                                                            return (
                                                                 <ModelSelectorItem
                                                                    key={m.id}
                                                                    onSelect={() => {
                                                                        if (isAllowed) {
                                                                            setModel(m.id)
                                                                            setModelSelectorOpen(false)
                                                                        } else {
                                                                            setUpgradeDialogOpen(true)
                                                                            setModelSelectorOpen(false)
                                                                        }
                                                                    }}
                                                                    value={m.id}
                                                                    className={cn(!isAllowed && "opacity-80 cursor-pointer")}
                                                                >
                                                                    <ModelSelectorLogo provider={m.chefSlug} />
                                                                    <ModelSelectorName className="flex items-center gap-1.5">
                                                                        {m.name}
                                                                        {isFree && isFreePlan && (
                                                                            <span className="px-1.5 py-0.5 text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                                                                                Free
                                                                            </span>
                                                                        )}
                                                                        {!isAllowed && (
                                                                            <span className="px-1.5 py-0.5 text-[9px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 rounded flex items-center gap-0.5">
                                                                                <Lock className="size-2" /> Pro
                                                                            </span>
                                                                        )}
                                                                    </ModelSelectorName>
                                                                    {!isAllowed ? (
                                                                        <Lock className="ml-auto size-4 text-amber-500 fill-amber-500/10" />
                                                                    ) : model === m.id ? (
                                                                        <CheckIcon className="ml-auto size-4" />
                                                                    ) : (
                                                                        <div className="ml-auto size-4" />
                                                                    )}
                                                                </ModelSelectorItem>
                                                            )
                                                        })}
                                                </ModelSelectorGroup>
                                            ))}
                                        </ModelSelectorList>
                                    </ModelSelectorContent>
                                </ModelSelector>
                            </PromptInputTools>
                            <PromptInputSubmit
                                disabled={status === "submitted" || status === "streaming" || (!text.trim() && status === "ready")}
                                status={status}
                            >
                                {status === "submitted" ? (
                                    <Loader2Icon className="size-4 animate-spin" />
                                ) : (
                                    <ArrowUpIcon className="size-4" />
                                )}
                            </PromptInputSubmit>
                        </PromptInputFooter>
                    </PromptInput>
                    {!isSignedIn ? (
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                            <button
                                className="font-medium text-primary underline-offset-4 hover:underline"
                                onClick={handleSignIn}
                                type="button"
                            >
                                Sign in
                            </button>
                            <span className="text-muted-foreground">or</span>
                            <button
                                className="font-medium text-primary underline-offset-4 hover:underline"
                                onClick={handleSignUp}
                                type="button"
                            >
                                create an account
                            </button>
                            <span className="text-muted-foreground">to save and run your prompt.</span>
                        </div>
                    ) : null}
                </div>
            </div>
            <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
                <DialogContent className="bg-zinc-950 border border-white/10 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
                            <Crown className="size-5 text-amber-500 fill-amber-500/10" />
                            Upgrade to Pro
                        </DialogTitle>
                        <DialogDescription className="text-sm text-zinc-400">
                            Premium models (such as GPT-5.5, Claude 4.6, and Gemini 3 Deep Think) are only available on paid plans. Upgrade your plan to get access to these advanced models.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => setUpgradeDialogOpen(false)}
                            className="text-zinc-400 hover:text-white hover:bg-white/10 border-white/10"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                setUpgradeDialogOpen(false)
                                router.push("/upgrade")
                            }}
                            className="bg-white text-black hover:bg-zinc-200"
                        >
                            Upgrade Now
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
