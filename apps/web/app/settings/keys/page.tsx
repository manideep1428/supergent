"use client"

import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { toast } from "sonner"

type StoredKeys = {
  vercelKey: string
  openaiKey: string
  anthropicKey: string
  googleKey: string
  deepseekKey: string
  mistralKey: string
  groqKey: string
  moonshotKey: string
}

const EMPTY: StoredKeys = {
  vercelKey: "",
  openaiKey: "",
  anthropicKey: "",
  googleKey: "",
  deepseekKey: "",
  mistralKey: "",
  groqKey: "",
  moonshotKey: "",
}

export default function CustomKeysPage() {
  const [keys, setKeys] = useState<StoredKeys>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const set = (field: keyof StoredKeys) => (value: string) =>
    setKeys((prev) => ({ ...prev, [field]: value }))

  useEffect(() => {
    let cancelled = false

    const loadKeys = async () => {
      try {
        const response = await fetch("/api/keys", { cache: "no-store" })
        if (!response.ok) {
          if (response.status !== 401) {
            toast.error("Could not load saved keys")
          }
          return
        }

        const data = (await response.json()) as Partial<StoredKeys>
        if (cancelled) return

        setKeys({
          vercelKey: data.vercelKey ?? "",
          openaiKey: data.openaiKey ?? "",
          anthropicKey: data.anthropicKey ?? "",
          googleKey: data.googleKey ?? "",
          deepseekKey: data.deepseekKey ?? "",
          mistralKey: data.mistralKey ?? "",
          groqKey: data.groqKey ?? "",
          moonshotKey: data.moonshotKey ?? "",
        })
      } catch (error) {
        console.error(error)
        toast.error("Could not load saved keys")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadKeys()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keys),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({} as { error?: string }))
        toast.error("Could not save keys", {
          description: errorBody.error || `HTTP ${response.status}`,
        })
        return
      }

      toast.success("API keys saved", {
        description:
          "These keys are stored on your account in Convex and used by the AI Gateway and direct provider SDKs.",
      })
    } catch (error) {
      console.error(error)
      toast.error("Could not save keys")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-svh overflow-hidden bg-muted/20">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Settings</span>
            <span className="text-muted-foreground text-sm">/</span>
            <span className="text-sm text-muted-foreground">Custom Keys</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-3xl space-y-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
              <p className="text-muted-foreground mt-2">
                Bring your own API keys. Keys are saved to your account in Convex and only used to
                make AI calls on your behalf. Direct provider keys are preferred over the gateway
                for the matching chef.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Vercel AI Gateway</CardTitle>
                <CardDescription>
                  Unified key that works for every model in the selector (OpenAI, Anthropic,
                  Google, DeepSeek, Llama, Mistral, Kimi, GLM).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vercel-key">Vercel API Key</Label>
                  <Input
                    id="vercel-key"
                    type="password"
                    placeholder="vck_..."
                    value={keys.vercelKey}
                    onChange={(e) => set("vercelKey")(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Required for GLM (Z.ai). Optional for the other chefs when their direct keys
                    are set below.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Direct Provider Keys</CardTitle>
                <CardDescription>
                  Optional. When set, the chat uses the matching @ai-sdk/* provider directly
                  instead of the gateway.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="sk-..."
                    value={keys.openaiKey}
                    onChange={(e) => set("openaiKey")(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                  <Input
                    id="anthropic-key"
                    type="password"
                    placeholder="sk-ant-..."
                    value={keys.anthropicKey}
                    onChange={(e) => set("anthropicKey")(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="google-key">Google Gemini API Key</Label>
                  <Input
                    id="google-key"
                    type="password"
                    placeholder="AIza..."
                    value={keys.googleKey}
                    onChange={(e) => set("googleKey")(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deepseek-key">DeepSeek API Key</Label>
                  <Input
                    id="deepseek-key"
                    type="password"
                    placeholder="sk-..."
                    value={keys.deepseekKey}
                    onChange={(e) => set("deepseekKey")(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for the DeepSeek V4 models via @ai-sdk/deepseek.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mistral-key">Mistral API Key</Label>
                  <Input
                    id="mistral-key"
                    type="password"
                    placeholder="..."
                    value={keys.mistralKey}
                    onChange={(e) => set("mistralKey")(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for Mistral Medium / Small via @ai-sdk/mistral.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="groq-key">Groq API Key</Label>
                  <Input
                    id="groq-key"
                    type="password"
                    placeholder="gsk_..."
                    value={keys.groqKey}
                    onChange={(e) => set("groqKey")(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used to serve Meta Llama 4 (Maverick / Scout) via @ai-sdk/groq.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="moonshot-key">Moonshot AI API Key</Label>
                  <Input
                    id="moonshot-key"
                    type="password"
                    placeholder="sk-..."
                    value={keys.moonshotKey}
                    onChange={(e) => set("moonshotKey")(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for Kimi K2 models via @ai-sdk/moonshotai.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button size="lg" onClick={handleSave} disabled={loading || saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
