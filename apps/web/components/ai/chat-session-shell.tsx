"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "backend/convex/_generated/api"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import {
  ChevronDownIcon,
  Code2Icon,
  Coins,
  DatabaseIcon,
  EyeIcon,
  ExternalLinkIcon,
  GlobeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  SparklesIcon,
  StarIcon,
  TerminalIcon,
  Trash2Icon,
} from "lucide-react"
import ChatbotDemo from "@/components/ai/chat-page"
import { CodeViewer } from "@/components/ai/code-viewer"
import { FileExplorer } from "@/components/ai/file-explorer"
import { UserMenu } from "@/components/user-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { toast } from "sonner"

const STORAGE_KEY = "chat_position"
const STORAGE_EVENT = "chatPositionChanged"

// How often to ping the sandbox so Vercel doesn't auto-expire it (4 min)
const SANDBOX_KEEPALIVE_MS = 4 * 60 * 1000
// Grace period before sleeping when the tab goes to background (30 min)
const SANDBOX_BG_GRACE_MS = 30 * 60 * 1000
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
  isFavorite?: boolean
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

      ; (async () => {
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

export function ChatSessionShell({ projectId, user }: { projectId: string; user: { id?: string | null; profilePictureUrl?: string | null; firstName?: string | null; email?: string | null } }) {
  const [chatPosition, setChatPosition] = useState<ChatPosition>("right")
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("preview")
  const [credits, setCredits] = useState<number | null>(null)
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatusPayload | null>(null)
  const [waking, setWaking] = useState(false)
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [unfavoriteDialogOpen, setUnfavoriteDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [renameLoading, setRenameLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [favoriteMutating, setFavoriteMutating] = useState(false)

  // Tracks background-grace timer (fires when tab stays hidden too long)
  const bgGraceTimerRef = useRef<number | null>(null)
  const sleepInFlightRef = useRef(false)
  const wakeInFlightRef = useRef(false)
  const lastWakeAtRef = useRef(0)
  // Ref so the keepalive / pagehide handlers can read the latest status
  // without going stale inside closures.
  const sandboxStatusRef = useRef<SandboxStatusPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/credits", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { credits?: { balance: number } } | null) => {
        if (!cancelled && data?.credits?.balance != null) setCredits(data.credits.balance)
      })
      .catch(() => { })
    return () => { cancelled = true }
  }, [])

  const chatData = useQuery(
    api.chats.list,
    user.id ? { chatId: projectId, userId: user.id } : "skip"
  )
  const app = chatData?.app ?? null

  const toggleFavorite = useCallback(async () => {
    if (!app || favoriteMutating) return
    setFavoriteMutating(true)
    try {
      const isFav = app.isFavorite
      const url = `/api/projects/${encodeURIComponent(projectId)}/favorite`
      const method = isFav ? "DELETE" : "POST"
      const response = await fetch(url, { method })
      if (response.ok) {
        toast.success(isFav ? "Removed from favorites" : "Added to favorites")
        window.dispatchEvent(new Event("favoritesChanged"))
      } else {
        toast.error("Failed to update favorite status")
      }
    } catch (err) {
      console.error("Failed to toggle favorite", err)
      toast.error("Failed to update favorite status")
    } finally {
      setFavoriteMutating(false)
    }
  }, [app, projectId, favoriteMutating])

  const handleRename = useCallback(async () => {
    const newTitle = renameValue.trim()
    if (!newTitle) return
    setRenameLoading(true)
    try {
      const url = `/api/projects/${encodeURIComponent(projectId)}`
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      })
      if (response.ok) {
        toast.success("Project renamed")
        setRenameDialogOpen(false)
        window.dispatchEvent(new Event("favoritesChanged"))
      } else {
        const errData = await response.json().catch(() => ({}))
        toast.error(errData.error || "Failed to rename project")
      }
    } catch (err) {
      console.error("Failed to rename project", err)
      toast.error("Failed to rename project")
    } finally {
      setRenameLoading(false)
    }
  }, [projectId, renameValue])

  const handleDelete = useCallback(async () => {
    setDeleteLoading(true)
    try {
      const url = `/api/projects/${encodeURIComponent(projectId)}`
      const response = await fetch(url, { method: "DELETE" })
      if (response.ok) {
        toast.success("Project deleted successfully")
        window.dispatchEvent(new Event("favoritesChanged"))
        router.push("/")
      } else {
        const errData = await response.json().catch(() => ({}))
        toast.error(errData.error || "Failed to delete project")
      }
    } catch (err) {
      console.error("Failed to delete project", err)
      toast.error("Failed to delete project")
    } finally {
      setDeleteLoading(false)
      setDeleteDialogOpen(false)
    }
  }, [projectId, router])

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
    const status = sandboxStatusRef.current
    if (!status || !status.sandboxId || status.status !== "running") return

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSandboxStatus, projectId])

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
        await fetchSandboxStatus()
      }
    } catch (error) {
      console.error("Failed to wake sandbox", error)
    } finally {
      wakeInFlightRef.current = false
      setWaking(false)
    }
  }, [fetchSandboxStatus, projectId, sandboxStatus])

  // Keep sandboxStatusRef in sync so closures always see the latest value.
  useEffect(() => {
    sandboxStatusRef.current = sandboxStatus
  }, [sandboxStatus])

  // ── Keepalive ping: prevent Vercel from auto-expiring the sandbox ─────────
  // Runs every 4 minutes while the tab is open and the sandbox is running.
  useEffect(() => {
    if (typeof window === "undefined") return

    const ping = async () => {
      const status = sandboxStatusRef.current
      if (!status || status.status !== "running" || !status.sandboxId) return
      try {
        // Refresh status — this is cheap and acts as the keepalive signal.
        await fetchSandboxStatus()
      } catch {
        // ignore
      }
    }

    const interval = window.setInterval(ping, SANDBOX_KEEPALIVE_MS)
    return () => window.clearInterval(interval)
  }, [fetchSandboxStatus])

  // ── Tab visibility: wake on return, grace-sleep when backgrounded ─────────
  useEffect(() => {
    if (typeof window === "undefined") return

    const clearBgGrace = () => {
      if (bgGraceTimerRef.current !== null) {
        window.clearTimeout(bgGraceTimerRef.current)
        bgGraceTimerRef.current = null
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // Tab went to background — start grace period before sleeping.
        // If the user comes back within 30 min, we cancel and stay alive.
        bgGraceTimerRef.current = window.setTimeout(() => {
          sleepSandbox()
        }, SANDBOX_BG_GRACE_MS)
      } else {
        // Tab came back — cancel grace sleep, refresh, wake if needed.
        clearBgGrace()
        fetchSandboxStatus()
        wakeSandbox()
      }
    }

    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      clearBgGrace()
    }
  }, [fetchSandboxStatus, sleepSandbox, wakeSandbox])

  // ── Tab / window close: sleep sandbox immediately (keepalive fetch) ────────
  // `pagehide` fires reliably on mobile + bfcache; `beforeunload` is the
  // desktop fallback. fetch with keepalive:true survives page unload AND
  // correctly sends session cookies (unlike sendBeacon).
  useEffect(() => {
    if (typeof window === "undefined") return

    const onClose = () => {
      const status = sandboxStatusRef.current
      if (!status || !status.sandboxId || status.status !== "running") return
      // keepalive lets the browser finish the request even after the page unloads.
      fetch("/api/sandboxes/sleep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: projectId }),
        keepalive: true,
      }).catch(() => {/* ignore - page is closing */})
    }

    window.addEventListener("pagehide", onClose)
    window.addEventListener("beforeunload", onClose)
    return () => {
      window.removeEventListener("pagehide", onClose)
      window.removeEventListener("beforeunload", onClose)
    }
  }, [projectId])

  // ── Wake sandbox when user sends a chat message ────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    const onChatActivity = () => wakeSandbox()
    window.addEventListener("supergent:chat-message-sent", onChatActivity)
    return () => window.removeEventListener("supergent:chat-message-sent", onChatActivity)
  }, [wakeSandbox])

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
      <div className="flex h-11 shrink-0 items-center justify-between border-white/10 border-b px-3">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-950 p-1">
          <Button
            aria-label="Preview"
            className={`size-7 rounded-md ${activeTab === "preview" ? "bg-zinc-800 text-white" : "text-zinc-400"} hover:bg-zinc-800 hover:text-white`}
            onClick={() => setActiveTab("preview")}
            size="icon"
            variant="ghost"
          >
            <EyeIcon className="size-3.5" />
          </Button>
          <Button
            aria-label="Files"
            className={`size-7 rounded-md ${activeTab === "files" ? "bg-zinc-800 text-white" : "text-zinc-400"} hover:bg-zinc-800 hover:text-white`}
            onClick={() => setActiveTab("files")}
            size="icon"
            variant="ghost"
          >
            <Code2Icon className="size-3.5" />
          </Button>
          <Button
            aria-label="Data"
            className={`size-7 rounded-md ${activeTab === "data" ? "bg-zinc-800 text-white" : "text-zinc-400"} hover:bg-zinc-800 hover:text-white`}
            onClick={() => setActiveTab("data")}
            size="icon"
            variant="ghost"
          >
            <DatabaseIcon className="size-3.5" />
          </Button>
        </div>

        <div className="hidden h-7 min-w-0 items-center rounded-lg border border-white/10 bg-zinc-950 text-zinc-400 sm:flex">
          <span
            aria-live="polite"
            className="flex shrink-0 items-center gap-1 px-2 text-[10px] font-medium text-zinc-300"
            title={
              sandboxStatus?.sandboxId
                ? `Sandbox ${sandboxStatus.sandboxId}`
                : sandboxStatus?.hasSnapshot
                  ? "Sandbox snapshotted - resumes on next activity"
                  : "No sandbox yet"
            }
          >
            <span className="relative flex size-1.5">
              {sandboxIndicator.pulse ? (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${sandboxIndicator.color}`}
                />
              ) : null}
              <span
                className={`relative inline-flex size-1.5 rounded-full ${sandboxIndicator.color}`}
              />
            </span>
            {sandboxIndicator.label}
          </span>
          <Separator className="h-4 bg-white/10" orientation="vertical" />
          <span className="max-w-[180px] sm:max-w-[220px] truncate px-2 font-mono text-[10px]">
            {app?.previewUrl || app?.sandboxId || "Sandbox not ready"}
          </span>
          <Separator className="h-4 bg-white/10" orientation="vertical" />
          <Button
            aria-label="Open preview"
            asChild={Boolean(app?.previewUrl)}
            className="size-7 text-zinc-400 hover:bg-zinc-900 hover:text-white"
            disabled={!app?.previewUrl}
            size="icon"
            variant="ghost"
          >
            {app?.previewUrl ? (
              <Link href={app.previewUrl} target="_blank">
                <ExternalLinkIcon className="size-3.5" />
              </Link>
            ) : (
              <ExternalLinkIcon className="size-3.5" />
            )}
          </Button>
          <Button
            aria-label="Refresh app state"
            className="size-7 text-zinc-400 hover:bg-zinc-900 hover:text-white"
            onClick={() => {
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
            <RefreshCwIcon className="size-3.5" />
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
      <header className="relative flex h-11 shrink-0 items-center justify-between border-white/10 border-b bg-black px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link className="flex shrink-0 items-center gap-2" href="/">
            <Image src="/logo.png" alt="Supergent Logo" width={20} height={20} className="object-contain" />
            <span className="text-sm font-semibold tracking-tight">Supergent</span>
          </Link>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden min-w-0 items-center gap-2 text-xs md:flex">
          <button
            className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-zinc-200 transition hover:bg-white/10"
            onClick={() => {
              setRenameValue(app?.title || "")
              setRenameDialogOpen(true)
            }}
            title="Click to rename"
          >
            <span className="max-w-[28vw] truncate">{app?.title || `Project ${projectId}`}</span>
            <PencilIcon className="size-3 text-zinc-600 hover:text-zinc-300" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            aria-label={app?.isFavorite ? "Remove from favorites" : "Add to favorites"}
            className="size-7 border-white/15 bg-zinc-950 text-zinc-200 hover:bg-zinc-900"
            size="icon"
            variant="outline"
            onClick={app?.isFavorite ? () => setUnfavoriteDialogOpen(true) : toggleFavorite}
            disabled={favoriteMutating}
          >
            <StarIcon className={`size-3.5 ${app?.isFavorite ? "fill-amber-400 text-amber-400" : ""}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="More actions" className="size-7 border-white/15 bg-zinc-950 text-zinc-200 hover:bg-zinc-900" size="icon" variant="outline">
                <MoreHorizontalIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-zinc-950 border border-white/10 text-white">
              <DropdownMenuItem
                onClick={app?.isFavorite ? () => setUnfavoriteDialogOpen(true) : toggleFavorite}
                className="cursor-pointer hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
              >
                {app?.isFavorite ? (
                  <>
                    <StarIcon className="mr-2 size-4 fill-amber-400 text-amber-400" />
                    <span>Remove from favorites</span>
                  </>
                ) : (
                  <>
                    <StarIcon className="mr-2 size-4" />
                    <span>Add to favorites</span>
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setRenameValue(app?.title || "")
                  setRenameDialogOpen(true)
                }}
                className="cursor-pointer hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
              >
                <PencilIcon className="mr-2 size-4" />
                <span>Rename</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setDeleteDialogOpen(true)}
                className="cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10"
              >
                <Trash2Icon className="mr-2 size-4" />
                <span>Delete project</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {credits !== null && (
            <Link
              href="/upgrade"
              className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500 hover:bg-amber-500/20 transition-colors"
            >
              <Coins className="size-3" />
              {credits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Link>
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
          <div className="flex min-h-0 flex-1 flex-col [&_[data-slot=input-group]]:border-white/10 [&_[data-slot=input-group]]:bg-zinc-900 [&_[data-slot=input-group]]:text-white [&_textarea]:min-h-12 [&_*]:scrollbar-hide">
            <ChatbotDemo
              chatId={projectId}
              userId={user.id}
              sandboxStatus={sandboxStatus}
              waking={waking}
              onReconnectSandbox={wakeSandbox}
            />
          </div>
        </aside>

        {!isRight ? workspacePanel : null}
      </main>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-950 border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">Delete Project</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Are you sure you want to delete this project? This will permanently delete all messages, sandbox files, and saved snapshots. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
              className="text-zinc-400 hover:text-white hover:bg-white/10 border-white/10"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteLoading ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unfavoriteDialogOpen} onOpenChange={setUnfavoriteDialogOpen}>
        <DialogContent className="bg-zinc-950 border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">Remove from Favorites</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Are you sure you want to remove this project from your favorites?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setUnfavoriteDialogOpen(false)}
              disabled={favoriteMutating}
              className="text-zinc-400 hover:text-white hover:bg-white/10 border-white/10"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await toggleFavorite()
                setUnfavoriteDialogOpen(false)
              }}
              disabled={favoriteMutating}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {favoriteMutating ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={(open) => { if (!open) setRenameDialogOpen(false) }}>
        <DialogContent className="bg-zinc-950 border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">Rename Project</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              Enter a new name for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              className="bg-zinc-900 border-white/10 text-white placeholder:text-zinc-500 focus-visible:ring-white/20"
              disabled={renameLoading}
              maxLength={64}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleRename()
                }
              }}
              placeholder="Project name"
              value={renameValue}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRenameDialogOpen(false)}
              disabled={renameLoading}
              className="text-zinc-400 hover:text-white hover:bg-white/10 border-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={renameLoading || !renameValue.trim()}
              className="bg-white text-black hover:bg-zinc-200"
            >
              {renameLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  )
}
