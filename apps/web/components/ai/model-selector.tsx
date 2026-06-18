"use client"

import type { ComponentProps, ReactNode } from "react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@workspace/ui/components/command"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"

export type ModelSelectorProps = ComponentProps<typeof Dialog>

export const ModelSelector = (props: ModelSelectorProps) => <Dialog {...props} />

export type ModelSelectorTriggerProps = ComponentProps<typeof DialogTrigger>

export const ModelSelectorTrigger = (props: ModelSelectorTriggerProps) => (
  <DialogTrigger {...props} />
)

export type ModelSelectorContentProps = ComponentProps<typeof DialogContent> & {
  title?: ReactNode
}

export const ModelSelectorContent = ({
  className,
  children,
  title = "Model Selector",
  ...props
}: ModelSelectorContentProps) => (
  <DialogContent className={cn("p-0", className)} {...props}>
    <DialogTitle className="sr-only">{title}</DialogTitle>
    <Command className="**:data-[slot=command-input-wrapper]:h-auto">{children}</Command>
  </DialogContent>
)

export type ModelSelectorDialogProps = ComponentProps<typeof CommandDialog>

export const ModelSelectorDialog = (props: ModelSelectorDialogProps) => <CommandDialog {...props} />

export type ModelSelectorInputProps = ComponentProps<typeof CommandInput>

export const ModelSelectorInput = ({ className, ...props }: ModelSelectorInputProps) => (
  <CommandInput className={cn("h-auto py-3.5", className)} {...props} />
)

export type ModelSelectorListProps = ComponentProps<typeof CommandList>

export const ModelSelectorList = (props: ModelSelectorListProps) => <CommandList {...props} />

export type ModelSelectorEmptyProps = ComponentProps<typeof CommandEmpty>

export const ModelSelectorEmpty = (props: ModelSelectorEmptyProps) => <CommandEmpty {...props} />

export type ModelSelectorGroupProps = ComponentProps<typeof CommandGroup>

export const ModelSelectorGroup = (props: ModelSelectorGroupProps) => <CommandGroup {...props} />

export type ModelSelectorItemProps = ComponentProps<typeof CommandItem>

export const ModelSelectorItem = (props: ModelSelectorItemProps) => <CommandItem {...props} />

export type ModelSelectorShortcutProps = ComponentProps<typeof CommandShortcut>

export const ModelSelectorShortcut = (props: ModelSelectorShortcutProps) => (
  <CommandShortcut {...props} />
)

export type ModelSelectorSeparatorProps = ComponentProps<typeof CommandSeparator>

export const ModelSelectorSeparator = (props: ModelSelectorSeparatorProps) => (
  <CommandSeparator {...props} />
)

export type ModelSelectorLogoProps = Omit<ComponentProps<"img">, "src" | "alt"> & {
  provider:
  | "moonshotai-cn"
  | "lucidquery"
  | "moonshotai"
  | "zai-coding-plan"
  | "alibaba"
  | "xai"
  | "vultr"
  | "nvidia"
  | "upstage"
  | "groq"
  | "github-copilot"
  | "mistral"
  | "vercel"
  | "nebius"
  | "deepseek"
  | "alibaba-cn"
  | "google-vertex-anthropic"
  | "venice"
  | "chutes"
  | "cortecs"
  | "github-models"
  | "togetherai"
  | "azure"
  | "baseten"
  | "huggingface"
  | "opencode"
  | "fastrouter"
  | "google"
  | "google-vertex"
  | "cloudflare-workers-ai"
  | "inception"
  | "wandb"
  | "openai"
  | "zhipuai-coding-plan"
  | "perplexity"
  | "openrouter"
  | "zenmux"
  | "v0"
  | "iflowcn"
  | "synthetic"
  | "deepinfra"
  | "zhipuai"
  | "submodel"
  | "zai"
  | "inference"
  | "requesty"
  | "morph"
  | "lmstudio"
  | "anthropic"
  | "aihubmix"
  | "fireworks-ai"
  | "modelscope"
  | "llama"
  | "scaleway"
  | "amazon-bedrock"
  | "cerebras"
  | (string & {})
}

export const ModelSelectorLogo = ({ provider, className, ...props }: ModelSelectorLogoProps) => (
  <img
    {...props}
    alt={`${provider} logo`}
    className={cn("size-3 dark:invert", className)}
    height={12}
    src={`https://models.dev/logos/${provider}.svg`}
    width={12}
  />
)

export type ModelSelectorLogoGroupProps = ComponentProps<"div">

export const ModelSelectorLogoGroup = ({ className, ...props }: ModelSelectorLogoGroupProps) => (
  <div
    className={cn(
      "-space-x-1 flex shrink-0 items-center [&>img]:rounded-full [&>img]:bg-background [&>img]:p-px [&>img]:ring-1 dark:[&>img]:bg-foreground",
      className,
    )}
    {...props}
  />
)

export type ModelSelectorNameProps = ComponentProps<"span">

export const ModelSelectorName = ({ className, ...props }: ModelSelectorNameProps) => (
  <span className={cn("flex-1 truncate text-left", className)} {...props} />
)

import { CheckIcon, Lock } from "lucide-react"
import { useState } from "react"
import { Button } from "@workspace/ui/components/button"

const models = [
  // OpenAI
  {
    id: "gpt-5.5-pro",
    name: "GPT-5.5 Pro",
    chef: "OpenAI",
    chefSlug: "openai",
    providers: ["openai", "azure"],
  },
  {
    id: "gpt-5.5",
    name: "GPT-5.5",
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
    id: "claude-opus-4.7",
    name: "Claude 4.7 Opus",
    chef: "Anthropic",
    chefSlug: "anthropic",
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],
  },
  {
    id: "claude-sonnet-4.6",
    name: "Claude 4.6 Sonnet",
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

export default function ModelSelectorDemo() {
  const [open, setOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.5-flash")

  const selectedModelData = models.find(model => model.id === selectedModel)
  const chefs = Array.from(new Set(models.map(model => model.chef))).sort((a, b) => {
    const aFree = a === "Google" || a === "DeepSeek";
    const bFree = b === "Google" || b === "DeepSeek";
    if (aFree && !bFree) return -1;
    if (!aFree && bFree) return 1;
    return 0;
  })

  return (
    <div className="flex size-full items-center justify-center p-8">
      <ModelSelector onOpenChange={setOpen} open={open}>
        <ModelSelectorTrigger asChild>
          <Button className="w-[200px] justify-between" variant="outline">
            {selectedModelData?.chefSlug && (
              <ModelSelectorLogo provider={selectedModelData.chefSlug} />
            )}
            {selectedModelData?.name && (
              <ModelSelectorName>{selectedModelData.name}</ModelSelectorName>
            )}
          </Button>
        </ModelSelectorTrigger>
        <ModelSelectorContent>
          <ModelSelectorInput placeholder="Search models..." />
          <ModelSelectorList>
            <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
            {chefs.map(chef => (
              <ModelSelectorGroup heading={chef} key={chef}>
                {models
                  .filter(model => model.chef === chef)
                  .map(model => {
                    const isAllowed = model.id === "gemini-3.5-flash" || model.id === "deepseek-v4-flash";
                    const isFree = model.id === "gemini-3.5-flash" || model.id === "deepseek-v4-flash";
                    return (
                      <ModelSelectorItem
                        key={model.id}
                        onSelect={() => {
                          if (isAllowed) {
                            setSelectedModel(model.id)
                            setOpen(false)
                          }
                        }}
                        value={model.id}
                        disabled={!isAllowed}
                        className={cn(!isAllowed && "opacity-50 cursor-not-allowed")}
                      >
                        <ModelSelectorLogo provider={model.chefSlug} />
                        <ModelSelectorName className="flex items-center gap-1.5">
                          {model.name}
                          {isFree && (
                            <span className="px-1.5 py-0.5 text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded flex-none">
                              Free
                            </span>
                          )}
                          {!isAllowed && (
                            <span className="px-1.5 py-0.5 text-[9px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 rounded flex items-center gap-0.5 flex-none">
                              <Lock className="size-2" /> Pro
                            </span>
                          )}
                        </ModelSelectorName>
                        <ModelSelectorLogoGroup>
                          {model.providers.map(provider => (
                            <ModelSelectorLogo key={provider} provider={provider} />
                          ))}
                        </ModelSelectorLogoGroup>
                        {selectedModel === model.id ? (
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
    </div>
  )
}
