"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  ChevronDownIcon,
  Code2Icon,
  DatabaseIcon,
  EyeIcon,
  ExternalLinkIcon,
  GlobeIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  SparklesIcon,
  TerminalIcon,
} from "lucide-react"
import ChatbotDemo from "@/components/ai/chat-page"
import { CodeViewer } from "@/components/ai/code-viewer"
import { FileExplorer } from "@/components/ai/file-explorer"
import { UserMenu } from "@/components/user-menu"

const STORAGE_KEY = "chat_position"
const STORAGE_EVENT = "chatPositionChanged"

const SANDBOX_IDLE_MS = 2 * 60 * 1000 // 2 minutes
const STATUS_POLL_MS = 5_000

type ChatPosition = "left" | "right"
type WorkspaceTab = "preview" | "files" | "data"

type SandboxLifecycleStatus =
  | "running"
  | "pending"
  | "stopping"
  | "stopped"
  | "snapshotted"
  | "snapshotting"
  | "idle"
  | "failed"
  | "unknown"

type SandboxStatusPayload = {
  status: SandboxLifecycleStatus
  sandboxId: string | null
  snapshotId: string | null
  hasSnapshot: boolean
  timeoutMs: number | null
  previewUrl: string | null
}

type AppRuntime = {
  title?: string
  status?: "creating" | "ready" | "error"
  sandboxId?: string | null
  previewUrl?: string | null
  generatedFiles?: string[]
}

function EmptyPreview({ projectId }: { projectId: string }) {
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_38%)]" />
      <div className="relative flex w-full max-w-xl flex-col items-center gap-8 text-center">
        <div className="w-full max-w-sm rounded-xl border border-white/10 bg-zinc-950/70 p-5 text-left shadow-2xl shadow-black">
          <div className="mb-5 flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-zinc-700" />
            <span className="size-3 rounded-full bg-zinc-700" />
            <span className="size-3 rounded-full bg-zinc-700" />
            <span className="ml-auto max-w-40 truncate font-mono text-sm text-zinc-400">/project-{projectId}.tsx</span>
          </div>
          <div className="space-y-3">
            <div className="ml-10 h-4 w-40 rounded-full bg-zinc-700" />
            <div className="h-3 w-3 rounded-full bg-zinc-700" />
            <div className="ml-8 h-4 w-28 rounded-full bg-slate-500" />
            <div className="ml-12 h-4 w-20 rounded-full bg-zinc-500" />
            <div className="ml-12 h-4 w-24 rounded-full bg-zinc-500" />
            <div className="h-4 w-4 rounded-full bg-zinc-700" />
            <div className="flex items-center gap-2 pt-7">
              <div className="h-4 w-12 rounded-full bg-teal-700" />
              <div className="h-4 w-24 rounded-full bg-slate-600" />
              <div className="h-4 w-4 rounded-full bg-zinc-700" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Creating project workspace</h1>
          <p className="mx-auto max-w-md text-sm text-zinc-500">
            Project ID <span className="font-mono text-zinc-300">{projectId}</span> is ready for prompts, files, and generated previews.
          </p>
        </div>
      </div>
    </div>
  )
}

function FilesView({ app }: { app: AppRuntime | null }) {
  const files = useMemo(() => app?.generatedFiles ?? [], [app?.generatedFiles])
  const sandboxId = app?.sandboxId ?? null

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState<string>("")
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)

  // Auto-select the first file the moment it shows up (and re-select if the
  // currently selected file disappears from the generated list).
  useEffect(() => {
    if (files.length === 0) {
      setSelectedPath(null)
      return
    }
    if (!selectedPath || !files.includes(selectedPath)) {
      setSelectedPath(files[0] ?? null)
    }
  }, [files, selectedPath])

  useEffect(() => {
    if (!selectedPath || !sandboxId) {
      setContent("")
      setContentError(null)
      setContentLoading(false)
      return
    }

    let cancelled = false
    setContentLoading(true)
    setContentError(null)

    const url = `/api/sandboxes/${sandboxId}/files?path=${encodeURIComponent(selectedPath)}`

    ;(async () => {
      try {
        const response = await fetch(url, { cache: "no-store" })
        if (!response.ok) {
          throw new Error(`Could not read ${selectedPath} (HTTP ${response.status})`)
        }
        const text = await response.text()
        if (!cancelled) setContent(text)
      } catch (error: any) {
        if (!cancelled) setContentError(error?.message || "Failed to load file")
      } finally {
        if (!cancelled) setContentLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedPath, sandboxId])

  if (files.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">
            No files have been generated yet. Ask the agent to scaffold an app and the generated
            files will appear here in a VS Code-style viewer.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#252526]">
        <div className="shrink-0 border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Explorer
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <FileExplorer
            files={files}
            onSelect={(path) => setSelectedPath(path)}
            selectedPath={selectedPath}
          />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedPath ? (
          <CodeViewer
            content={content}
            error={contentError}
            loading={contentLoading}
            path={selectedPath}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-500">
            Select a file from the explorer.
          </div>
        )}
      </div>
    </div>
  )
}

function WorkspaceBody({
  activeTab,
  app,
  projectId,
}: {
  activeTab: WorkspaceTab
  app: AppRuntime | null
  projectId: string
}) {
  if (activeTab === "preview") {
    if (app?.previewUrl) {
      return (
        <div className="min-h-0 flex-1 bg-white">
          <iframe
            className="h-full w-full border-0"
            src={app.previewUrl}
            title="Sandbox preview"
          />
        </div>
      )
    }

    return <EmptyPreview projectId={projectId} />
  }

  if (activeTab === "files") {
    return <FilesView app={app} />
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <div className="mx-auto grid w-full max-w-3xl gap-3 text-sm">
        {[
          ["Status", app?.status ?? "waiting"],
          ["Chat ID", projectId],
          ["Sandbox ID", app?.sandboxId ?? "not created"],
          ["Preview URL", app?.previewUrl ?? "not ready"],
          ["Generated files", String(app?.generatedFiles?.length ?? 0)],
        ].map(([label, value]) => (
          <div className="grid gap-1 rounded-lg border border-white/10 bg-zinc-950 p-3" key={label}>
            <span className="text-xs text-zinc-500">{label}</span>
            <span className="break-all font-mono text-xs text-zinc-200">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChatSessionShell({ projectId, user }: { projectId: string; user: { profilePictureUrl?: string | null; firstName?: string | null; email?: string | null } }) {
  const [chatPosition, setChatPosition] = useState<ChatPosition>("right")
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("preview")
  const [app, setApp] = useState<AppRuntime | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatusPayload | null>(null)
  const [waking, setWaking] = useState(false)

  // Tracks whether the user is currently active so the idle timer only
  // fires after a real period of inactivity inside the workspace area.
  const idleTimerRef = useRef<number | null>(null)
  const sleepInFlightRef = useRef(false)
  const wakeInFlightRef = useRef(false)
  const lastWakeAtRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    fetch("/api/credits", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { credits?: { balance: number } } | null) => {
        if (!cancelled && data?.credits?.balance != null) setCredits(data.credits.balance)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const loadApp = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat?chatId=${encodeURIComponent(projectId)}`)
      if (!response.ok) {
        return
      }
      const data = await response.json() as { app?: AppRuntime | null }
      setApp(data.app ?? null)
    } catch (error) {
      console.error(error)
    }
  }, [projectId])

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === "left" || saved === "right") {
      setChatPosition(saved)
    } else {
      window.localStorage.setItem(STORAGE_KEY, "right")
    }
  }, [])

  useEffect(() => {
    const handleStorageEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ChatPosition>
      const nextPosition = customEvent.detail
      if (nextPosition === "left" || nextPosition === "right") {
        setChatPosition(nextPosition)
      }
    }

    window.addEventListener(STORAGE_EVENT, handleStorageEvent as EventListener)
    return () => window.removeEventListener(STORAGE_EVENT, handleStorageEvent as EventListener)
  }, [])

  useEffect(() => {
    loadApp()
    const interval = window.setInterval(loadApp, 3000)
    return () => window.clearInterval(interval)
  }, [loadApp])

  const fetchSandboxStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/sandboxes/status?chatId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" },
      )
      if (!response.ok) return
      const data = (await response.json()) as SandboxStatusPayload
      setSandboxStatus(data)
    } catch (error) {
      console.error("Failed to load sandbox status", error)
    }
  }, [projectId])

  // Poll sandbox status so the active indicator stays in sync.
  useEffect(() => {
    fetchSandboxStatus()
    const interval = window.setInterval(fetchSandboxStatus, STATUS_POLL_MS)
    return () => window.clearInterval(interval)
  }, [fetchSandboxStatus])

  const sleepSandbox = useCallback(async () => {
    if (sleepInFlightRef.current) return
    if (
      !sandboxStatus ||
      !sandboxStatus.sandboxId ||
      sandboxStatus.status !== "running"
    ) {
      return
    }

    sleepInFlightRef.current = true
    try {
      const response = await fetch("/api/sandboxes/sleep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: projectId }),
      })
      if (response.ok) {
        await fetchSandboxStatus()
      }
    } catch (error) {
      console.error("Failed to snapshot sandbox", error)
    } finally {
      sleepInFlightRef.current = false
    }
  }, [fetchSandboxStatus, projectId, sandboxStatus])

  const wakeSandbox = useCallback(async () => {
    // Throttle wake calls so a flurry of activity events doesn't hammer the
    // resume endpoint.
    if (wakeInFlightRef.current) return
    if (Date.now() - lastWakeAtRef.current < 5_000) return

    // No need to wake if there is nothing to wake into.
    if (!sandboxStatus) return
    if (sandboxStatus.status === "running" || sandboxStatus.status === "pending") {
      return
    }
    if (!sandboxStatus.hasSnapshot && !sandboxStatus.sandboxId) {
      return
    }

    wakeInFlightRef.current = true
    setWaking(true)
    try {
      const response = await fetch("/api/sandboxes/wake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: projectId }),
      })
      if (response.ok) {
        lastWakeAtRef.current = Date.now()
        await Promise.all([fetchSandboxStatus(), loadApp()])
      }
    } catch (error) {
      console.error("Failed to wake sandbox", error)
    } finally {
      wakeInFlightRef.current = false
      setWaking(false)
    }
  }, [fetchSandboxStatus, loadApp, projectId, sandboxStatus])

  // Reset the 2-min idle timer on any in-window activity.
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current)
    }
    idleTimerRef.current = window.setTimeout(() => {
      sleepSandbox()
    }, SANDBOX_IDLE_MS)
  }, [sleepSandbox])

  useEffect(() => {
    if (typeof window === "undefined") return

    const onActivity = () => {
      resetIdleTimer()
      // If the sandbox already snapshotted, restore it the moment the user
      // re-engages with the workspace - even before they send a message.
      if (
        sandboxStatus &&
        sandboxStatus.status !== "running" &&
        sandboxStatus.status !== "pending" &&
        sandboxStatus.hasSnapshot
      ) {
        wakeSandbox()
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // Tab moved to background - start the 2-min idle countdown.
        resetIdleTimer()
      } else {
        // User came back: refresh status, wake if needed, and reset timer.
        fetchSandboxStatus()
        wakeSandbox()
        resetIdleTimer()
      }
    }

    resetIdleTimer()
    window.addEventListener("mousemove", onActivity, { passive: true })
    window.addEventListener("keydown", onActivity)
    window.addEventListener("click", onActivity)
    window.addEventListener("touchstart", onActivity, { passive: true })
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.removeEventListener("mousemove", onActivity)
      window.removeEventListener("keydown", onActivity)
      window.removeEventListener("click", onActivity)
      window.removeEventListener("touchstart", onActivity)
      document.removeEventListener("visibilitychange", onVisibility)
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
    }
  }, [fetchSandboxStatus, resetIdleTimer, sandboxStatus, wakeSandbox])

  // Listen for "user submitted a chat message" so we can wake the sandbox
  // immediately rather than waiting for the agent's createSandbox tool call.
  useEffect(() => {
    if (typeof window === "undefined") return
    const onChatActivity = () => {
      wakeSandbox()
      resetIdleTimer()
    }
    window.addEventListener("emergent:chat-message-sent", onChatActivity)
    return () => {
      window.removeEventListener("emergent:chat-message-sent", onChatActivity)
    }
  }, [resetIdleTimer, wakeSandbox])

  const displayName = user.firstName || user.email || "User"
  const initials = displayName.slice(0, 2).toUpperCase()
  const isRight = chatPosition === "right"

  const sandboxIndicator = useMemo(() => {
    const status = sandboxStatus?.status ?? "unknown"
    if (waking || status === "pending") {
      return { label: "Resuming", color: "bg-amber-400", pulse: true }
    }
    if (status === "running") {
      return { label: "Active", color: "bg-emerald-500", pulse: true }
    }
    if (status === "stopping" || status === "snapshotting") {
      return { label: "Snapshotting", color: "bg-amber-400", pulse: true }
    }
    if (status === "snapshotted") {
      return { label: "Snapshot ready", color: "bg-sky-400", pulse: false }
    }
    if (status === "stopped" || status === "idle") {
      return { label: "Idle", color: "bg-zinc-500", pulse: false }
    }
    if (status === "failed") {
      return { label: "Failed", color: "bg-red-500", pulse: false }
    }
    return { label: "Unknown", color: "bg-zinc-600", pulse: false }
  }, [sandboxStatus?.status, waking])

  const workspacePanel = (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#050505]"
      onMouseEnter={() => {
        // Treat hovering the workspace as a strong "user is engaged" signal
        // - good place to wake a snapshotted sandbox even without a click.
        if (
          sandboxStatus &&
          sandboxStatus.status !== "running" &&
          sandboxStatus.status !== "pending" &&
          sandboxStatus.hasSnapshot
        ) {
          wakeSandbox()
        }
      }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-white/10 border-b px-3">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-950 p-1">
          <Button
            aria-label="Preview"
            className={`size-8 rounded-md ${activeTab === "preview" ? "bg-zinc-800 text-white" : "text-zinc-400"} hover:bg-zinc-800 hover:text-white`}
            onClick={() => setActiveTab("preview")}
            size="icon"
            variant="ghost"
          >
            <EyeIcon className="size-4" />
          </Button>
          <Button
            aria-label="Files"
            className={`size-8 rounded-md ${activeTab === "files" ? "bg-zinc-800 text-white" : "text-zinc-400"} hover:bg-zinc-800 hover:text-white`}
            onClick={() => setActiveTab("files")}
            size="icon"
            variant="ghost"
          >
            <Code2Icon className="size-4" />
          </Button>
          <Button
            aria-label="Data"
            className={`size-8 rounded-md ${activeTab === "data" ? "bg-zinc-800 text-white" : "text-zinc-400"} hover:bg-zinc-800 hover:text-white`}
            onClick={() => setActiveTab("data")}
            size="icon"
            variant="ghost"
          >
            <DatabaseIcon className="size-4" />
          </Button>
        </div>

        <div className="hidden min-w-0 items-center rounded-lg border border-white/10 bg-zinc-950 text-zinc-400 sm:flex">
          <span
            aria-live="polite"
            className="flex shrink-0 items-center gap-1.5 px-3 text-[11px] font-medium text-zinc-300"
            title={
              sandboxStatus?.sandboxId
                ? `Sandbox ${sandboxStatus.sandboxId}`
                : sandboxStatus?.hasSnapshot
                  ? "Sandbox snapshotted - resumes on next activity"
                  : "No sandbox yet"
            }
          >
            <span className="relative flex size-2">
              {sandboxIndicator.pulse ? (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${sandboxIndicator.color}`}
                />
              ) : null}
              <span
                className={`relative inline-flex size-2 rounded-full ${sandboxIndicator.color}`}
              />
            </span>
            {sandboxIndicator.label}
          </span>
          <Separator className="h-5 bg-white/10" orientation="vertical" />
          <span className="max-w-[34vw] truncate px-3 font-mono text-xs">
            {app?.previewUrl || app?.sandboxId || "Sandbox not ready"}
          </span>
          <Separator className="h-5 bg-white/10" orientation="vertical" />
          <Button
            aria-label="Open preview"
            asChild={Boolean(app?.previewUrl)}
            className="size-8 text-zinc-400 hover:bg-zinc-900 hover:text-white"
            disabled={!app?.previewUrl}
            size="icon"
            variant="ghost"
          >
            {app?.previewUrl ? (
              <Link href={app.previewUrl} target="_blank">
                <ExternalLinkIcon className="size-4" />
              </Link>
            ) : (
              <ExternalLinkIcon className="size-4" />
            )}
          </Button>
          <Button
            aria-label="Refresh app state"
            className="size-8 text-zinc-400 hover:bg-zinc-900 hover:text-white"
            onClick={() => {
              loadApp()
              fetchSandboxStatus()
              if (
                sandboxStatus?.status !== "running" &&
                sandboxStatus?.status !== "pending"
              ) {
                wakeSandbox()
              }
            }}
            size="icon"
            variant="ghost"
          >
            <RefreshCwIcon className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 text-zinc-500">
          <TerminalIcon className="size-4" />
          <MoreHorizontalIcon className="size-4" />
        </div>
      </div>

      <WorkspaceBody activeTab={activeTab} app={app} projectId={projectId} />
    </section>
  )

  return (
    <div className="dark flex h-svh flex-col overflow-hidden bg-black text-white">
      <header className="flex h-11 shrink-0 items-center justify-between border-white/10 border-b bg-black px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link className="flex shrink-0 items-center gap-2" href="/">
            <span className="text-sm font-semibold tracking-tight">Emergent</span>
          </Link>
        </div>

        <div className="hidden min-w-0 items-center gap-2 text-xs md:flex">
          <span className="inline-flex size-4 items-center justify-center rounded-full border border-dashed border-zinc-500">
            <SparklesIcon className="size-2.5 text-zinc-400" />
          </span>
          <span className="text-zinc-400">Drafts</span>
          <span className="text-zinc-700">/</span>
          <button className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-zinc-200 transition hover:bg-white/10">
            <span className="max-w-[28vw] truncate">{app?.title || `Project ${projectId}`}</span>
            <ChevronDownIcon className="size-3.5 text-zinc-500" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button aria-label="More actions" className="size-7 border-white/15 bg-zinc-950 text-zinc-200 hover:bg-zinc-900" size="icon" variant="outline">
            <MoreHorizontalIcon className="size-3.5" />
          </Button>
          {credits !== null && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              <SparklesIcon className="size-3" />
              {credits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          <Button asChild={Boolean(app?.previewUrl)} className="hidden h-7 gap-1.5 bg-white px-3 text-xs text-black hover:bg-zinc-200 sm:inline-flex" disabled={!app?.previewUrl} size="sm">
            {app?.previewUrl ? (
              <Link href={app.previewUrl} target="_blank">
                <GlobeIcon className="size-4" />
                Open
              </Link>
            ) : (
              <>
                <GlobeIcon className="size-4" />
                Open
              </>
            )}
          </Button>
          <UserMenu
            align="end"
            side="bottom"
            trigger={
              <button
                aria-label="Open user menu"
                className="rounded-full transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
                type="button"
              >
                <Avatar className="size-8 border border-amber-400/40 bg-zinc-900">
                  <AvatarImage alt={displayName} src={user.profilePictureUrl || ""} />
                  <AvatarFallback className="bg-zinc-900 text-[10px] text-amber-300">{initials}</AvatarFallback>
                </Avatar>
              </button>
            }
            user={{
              name: displayName,
              email: user.email || "",
              avatar: user.profilePictureUrl || "",
            }}
          />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-2 lg:flex-row lg:p-3">
        {isRight ? workspacePanel : null}

        <aside className="flex min-h-[42vh] shrink-0 flex-col overflow-hidden bg-zinc-950 lg:min-h-0 lg:w-[340px] xl:w-[360px]">
          <div className="flex h-12 shrink-0 items-center justify-between px-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">Project chat</p>
              <p className="truncate font-mono text-[10px] text-zinc-500">{projectId}</p>
            </div>
            <Button aria-label="Chat options" className="size-8 text-zinc-400 hover:bg-zinc-900 hover:text-white" size="icon" variant="ghost">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 [&_[data-slot=input-group]]:border-white/10 [&_[data-slot=input-group]]:bg-zinc-900 [&_[data-slot=input-group]]:text-white [&_textarea]:min-h-12 [&_*]:scrollbar-hide">
            <ChatbotDemo chatId={projectId} />
          </div>
        </aside>

        {!isRight ? workspacePanel : null}
      </main>
    </div>
  )
}
