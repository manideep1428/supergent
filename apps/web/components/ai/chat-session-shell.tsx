"use client"

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react"
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
  ChevronRightIcon,
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
  Files as FilesIcon,
  Search as SearchIcon,
  GitBranch as GitBranchIcon,
  Play as PlayIcon,
  Blocks as BlocksIcon,
  User as UserIcon,
  X as XIcon,
  Settings as SettingsIcon,
} from "lucide-react"
import ChatbotDemo from "@/components/ai/chat-page"
import { CodeViewer } from "@/components/ai/code-viewer"
import { FileExplorer, getFileIcon } from "@/components/ai/file-explorer"
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

// How often to ping the sandbox so Vercel doesn't auto-expire it (1 min)
const SANDBOX_KEEPALIVE_MS = 1 * 60 * 1000
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

  // VS Code style tab and sidebar state
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [activeSidebarTab, setActiveSidebarTab] = useState<"explorer" | "search" | "git" | "debug" | "extensions">("explorer")
  const [openEditorsCollapsed, setOpenEditorsCollapsed] = useState(false)
  const [projectFilesCollapsed, setProjectFilesCollapsed] = useState(false)

  // Filter open tabs to keep only those that still exist.
  // Auto-select the first file when it shows up.
  useEffect(() => {
    if (files.length === 0) {
      setSelectedPath(null)
      setOpenTabs([])
      return
    }

    setOpenTabs((prev) => {
      const valid = prev.filter((t) => files.includes(t))
      if (valid.length === 0 && files[0]) {
        return [files[0]]
      }
      return valid
    })

    if (!selectedPath || !files.includes(selectedPath)) {
      setSelectedPath(files[0] ?? null)
    }
  }, [files, selectedPath])

  // Sync openTabs whenever selectedPath changes (ensure selectedPath is in tabs)
  useEffect(() => {
    if (selectedPath && !openTabs.includes(selectedPath)) {
      setOpenTabs((prev) => [...prev, selectedPath])
    }
  }, [selectedPath, openTabs])

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

  const handleSelectFile = (path: string) => {
    setSelectedPath(path)
  }

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const nextTabs = openTabs.filter((t) => t !== path)
    setOpenTabs(nextTabs)
    if (selectedPath === path) {
      setSelectedPath(nextTabs[nextTabs.length - 1] ?? null)
    }
  }

  if (files.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-4 bg-[#1e1e1e]">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500 bg-[#252526]/50">
            No files have been generated yet. Ask the agent to scaffold an app and the generated
            files will appear here in a VS Code-style viewer.
          </div>
        </div>
      </div>
    )
  }

  // Helper to parse filename from path
  const getFileName = (path: string) => {
    return path.split(/[\\/]+/).pop() ?? path
  }

  // Breadcrumbs data
  const breadcrumbs = selectedPath ? selectedPath.split("/") : []
  const activeLang = selectedPath ? selectedPath.split(".").pop() ?? "text" : "text"

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#1e1e1e] select-none text-zinc-300">
      {/* Main Workspace Row */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 1. Activity Bar */}
        <aside className="w-12 shrink-0 bg-[#181818] border-r border-white/5 flex flex-col items-center py-2 justify-between z-10">
          <div className="flex flex-col gap-1 w-full items-center">
            {[
              { id: "explorer", icon: FilesIcon, label: "Explorer" },
              { id: "search", icon: SearchIcon, label: "Search" },
              { id: "git", icon: GitBranchIcon, label: "Source Control" },
              { id: "debug", icon: PlayIcon, label: "Run & Debug" },
              { id: "extensions", icon: BlocksIcon, label: "Extensions" },
            ].map((tab) => {
              const Icon = tab.icon
              const isTabActive = activeSidebarTab === tab.id && sidebarExpanded
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (activeSidebarTab === tab.id) {
                      setSidebarExpanded(!sidebarExpanded)
                    } else {
                      setActiveSidebarTab(tab.id as any)
                      setSidebarExpanded(true)
                    }
                  }}
                  title={tab.label}
                  className="w-full h-12 flex items-center justify-center relative transition-colors group"
                >
                  {/* Left Indicator Bar */}
                  {isTabActive ? (
                    <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#007acc]" />
                  ) : null}
                  <Icon
                    className={`size-6 transition-colors duration-150 ${
                      isTabActive
                        ? "text-white"
                        : "text-zinc-500 group-hover:text-zinc-300"
                    }`}
                  />
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 w-full items-center">
            <button title="Account" className="w-full h-10 flex items-center justify-center text-zinc-500 hover:text-zinc-300">
              <UserIcon className="size-5" />
            </button>
            <button title="Settings" className="w-full h-10 flex items-center justify-center text-zinc-500 hover:text-zinc-300">
              <SettingsIcon className="size-5" />
            </button>
          </div>
        </aside>

        {/* 2. Sidebar Panel */}
        {sidebarExpanded ? (
          <aside className="w-56 shrink-0 bg-[#252526] border-r border-white/5 flex flex-col overflow-hidden z-10">
            {/* Sidebar Title */}
            <div className="shrink-0 h-9 px-3 flex items-center justify-between border-b border-white/5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {activeSidebarTab === "explorer"
                  ? "Explorer: Workspace"
                  : activeSidebarTab === "search"
                    ? "Search"
                    : activeSidebarTab === "git"
                      ? "Source Control"
                      : activeSidebarTab === "debug"
                        ? "Run and Debug"
                        : "Extensions"}
              </span>
            </div>

            {/* Sidebar Content */}
            {activeSidebarTab === "explorer" ? (
              <div className="min-h-0 flex-1 flex flex-col overflow-auto text-xs">
                {/* Section A: Open Editors */}
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => setOpenEditorsCollapsed(!openEditorsCollapsed)}
                    className="h-[22px] px-1 bg-white/[0.02] border-b border-white/[0.04] flex items-center gap-1 w-full text-left font-semibold text-[10px] uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
                  >
                    {openEditorsCollapsed ? (
                      <ChevronRightIcon className="size-3 text-zinc-500" />
                    ) : (
                      <ChevronDownIcon className="size-3 text-zinc-500" />
                    )}
                    Open Editors
                  </button>
                  {!openEditorsCollapsed && (
                    <div className="py-1 flex flex-col max-h-[160px] overflow-y-auto">
                      {openTabs.map((tabPath) => {
                        const tabName = getFileName(tabPath)
                        const { Icon, color } = getFileIcon(tabName)
                        const isTabSelected = selectedPath === tabPath
                        return (
                          <div
                            key={tabPath}
                            onClick={() => handleSelectFile(tabPath)}
                            className={`flex items-center justify-between px-3 py-1 cursor-pointer font-mono hover:bg-[#2a2d2e] relative group ${
                              isTabSelected ? "bg-[#37373d] text-white" : "text-zinc-400"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <Icon className={`size-3.5 shrink-0 ${color}`} />
                              <span className="truncate">{tabName}</span>
                            </div>
                            <button
                              onClick={(e) => handleCloseTab(tabPath, e)}
                              className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-sm p-0.5 transition-opacity duration-150"
                            >
                              <XIcon className="size-3 text-zinc-400" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Section B: Project Files */}
                <div className="flex flex-col flex-1 min-h-0 border-t border-white/5">
                  <button
                    onClick={() => setProjectFilesCollapsed(!projectFilesCollapsed)}
                    className="h-[22px] px-1 bg-white/[0.02] border-b border-white/[0.04] flex items-center gap-1 w-full text-left font-semibold text-[10px] uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
                  >
                    {projectFilesCollapsed ? (
                      <ChevronRightIcon className="size-3 text-zinc-500" />
                    ) : (
                      <ChevronDownIcon className="size-3 text-zinc-500" />
                    )}
                    Files
                  </button>
                  {!projectFilesCollapsed && (
                    <div className="min-h-0 flex-1 overflow-auto">
                      <FileExplorer
                        files={files}
                        onSelect={handleSelectFile}
                        selectedPath={selectedPath}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 text-xs text-zinc-500 text-center">
                This panel is simplified for preview. Check the files list under the Explorer tab.
              </div>
            )}
          </aside>
        ) : null}

        {/* 3. Editor Pane (Tabs, Breadcrumbs, CodeViewer) */}
        <div className="flex-grow flex flex-col min-w-0 bg-[#1e1e1e] relative">
          {selectedPath ? (
            <>
              {/* VS Code Tab Bar */}
              <div className="h-[35px] bg-[#252526] border-b border-white/5 flex items-center justify-between overflow-hidden shrink-0">
                <div className="flex flex-1 items-center h-full overflow-x-auto scrollbar-none scroll-smooth">
                  {openTabs.map((tabPath) => {
                    const tabName = getFileName(tabPath)
                    const { Icon, color } = getFileIcon(tabName)
                    const isTabSelected = selectedPath === tabPath
                    return (
                      <div
                        key={tabPath}
                        onClick={() => handleSelectFile(tabPath)}
                        className={`h-full flex items-center gap-2 px-3 border-r border-white/5 cursor-pointer font-mono text-xs relative group transition-colors duration-150 shrink-0 ${
                          isTabSelected
                            ? "bg-[#1e1e1e] text-white border-t-[2px] border-t-[#007acc] h-full"
                            : "bg-[#2d2d2d] text-zinc-400 hover:bg-[#2b2b2b] hover:text-zinc-200"
                        }`}
                      >
                        <Icon className={`size-3.5 shrink-0 ${color}`} />
                        <span className="truncate max-w-[120px]">{tabName}</span>
                        <button
                          onClick={(e) => handleCloseTab(tabPath, e)}
                          className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-sm p-0.5 transition-all"
                        >
                          <XIcon className="size-3 text-zinc-400" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Right side tab icons */}
                <div className="flex items-center gap-1.5 px-3 border-l border-white/5 h-full text-zinc-400 shrink-0 bg-[#252526]">
                  <button title="Split Editor Right" className="hover:text-zinc-200 p-1">
                    <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M1 2v12h14V2H1zm13 1v10H8.5V3H14zM7.5 13H2V3h5.5v10z"/>
                    </svg>
                  </button>
                  <button title="More Actions" className="hover:text-zinc-200 p-1">
                    <MoreHorizontalIcon className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* VS Code Breadcrumbs */}
              <div className="h-[22px] bg-[#1e1e1e] border-b border-white/[0.04] px-4 flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono shrink-0">
                <span className="hover:text-zinc-300 cursor-pointer">workspace</span>
                {breadcrumbs.map((segment, index) => {
                  const isLast = index === breadcrumbs.length - 1
                  return (
                    <Fragment key={index}>
                      <ChevronRightIcon className="size-3 shrink-0 text-zinc-600" />
                      {isLast ? (
                        <div className="flex items-center gap-1 text-zinc-300">
                          {(() => {
                            const { Icon, color } = getFileIcon(segment)
                            return <Icon className={`size-3 shrink-0 ${color}`} />
                          })()}
                          <span className="hover:text-zinc-100 cursor-pointer font-semibold">{segment}</span>
                        </div>
                      ) : (
                        <span className="hover:text-zinc-300 cursor-pointer">{segment}</span>
                      )}
                    </Fragment>
                  )
                })}
              </div>

              {/* Main Code View Area */}
              <div className="flex-1 min-h-0">
                <CodeViewer
                  content={content}
                  error={contentError}
                  loading={contentLoading}
                  path={selectedPath}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col h-full items-center justify-center text-xs text-zinc-500 gap-2 bg-[#1e1e1e]">
              <svg className="size-12 opacity-20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9 1H2v14h12V6L9 1zm4 13H3V2h5.5l4.5 4.5V14z"/>
              </svg>
              <span>Select a file from the explorer to begin viewing code.</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. VS Code Status Bar */}
      <footer className="h-[22px] shrink-0 bg-[#007acc] text-white flex items-center justify-between px-2 text-[11px] font-sans font-normal overflow-hidden select-none z-20">
        <div className="flex items-center gap-3 h-full">
          {/* Remote Container Badge */}
          <div className="bg-[#167c50] hover:bg-[#1f9362] cursor-pointer h-full px-2.5 flex items-center gap-1 transition-colors duration-150">
            <svg className="size-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 2L1 6.5l4.5 4.5v-3H9v-3H5.5V2zm5 12l4.5-4.5-4.5-4.5v3H7v3h3.5v3z"/>
            </svg>
            <span className="font-semibold">Sandbox: {sandboxId ? sandboxId.slice(0, 8) : "offline"}</span>
          </div>

          {/* Git Branch */}
          <div className="flex items-center gap-1 hover:bg-white/10 cursor-pointer h-full px-1.5 transition-colors duration-150">
            <GitBranchIcon className="size-3 shrink-0" />
            <span>main</span>
            <svg className="size-2.5 opacity-80" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14 7.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-7-4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM1.5 10a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zm6.5 1.5c-1.38 0-2.5-1.12-2.5-2.5v-.5A1.5 1.5 0 0 1 4 7H2a.5.5 0 0 1 0-1h2c1.38 0 2.5 1.12 2.5 2.5v.5A1.5 1.5 0 0 1 8 10h2a.5.5 0 0 1 0 1H8v.5z"/>
            </svg>
          </div>

          {/* Sync status */}
          <div className="flex items-center gap-1 hover:bg-white/10 cursor-pointer h-full px-1.5 transition-colors duration-150" title="Synchronized">
            <svg className="size-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
              <path d="M8 4.5a.5.5 0 0 1-.5-.5V1a.5.5 0 0 1 1 0v3a.5.5 0 0 1-.5.5z"/>
            </svg>
          </div>

          {/* Problems Indicator */}
          <div className="flex items-center gap-1 hover:bg-white/10 cursor-pointer h-full px-1.5 transition-colors duration-150">
            <svg className="size-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM7 4h2v5H7V4zm0 6h2v2H7v-2z"/>
            </svg>
            <span>0</span>
            <svg className="size-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.002 1.25a.75.75 0 0 1 1.38-.02l6.25 11.25A.75.75 0 0 1 13.973 13.5H1.41a.75.75 0 0 1-.659-1.077l6.25-11.173zM2.518 12h10.347L7.691 3.518 2.518 12zM7 6h2v3H7V6zm0 4h2v2H7v-2z"/>
            </svg>
            <span>0</span>
          </div>
        </div>

        <div className="flex items-center gap-3 h-full">
          {/* Cursor info */}
          <span className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors duration-150">
            Ln 1, Col 1
          </span>
          {/* Indentation */}
          <span className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors duration-150">
            Spaces: 2
          </span>
          {/* Encoding */}
          <span className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors duration-150">
            UTF-8
          </span>
          {/* EOL */}
          <span className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors duration-150">
            LF
          </span>
          {/* Language Mode */}
          <span className="hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-colors duration-150 font-medium">
            {activeLang === "tsx"
              ? "TypeScript JSX"
              : activeLang === "ts"
                ? "TypeScript"
                : activeLang === "jsx"
                  ? "JavaScript JSX"
                  : activeLang === "js"
                    ? "JavaScript"
                    : activeLang.toUpperCase()}
          </span>
          {/* Prettier Badge */}
          <span className="hover:bg-white/10 px-2 py-0.5 flex items-center gap-1 cursor-pointer transition-colors duration-150 text-[10px]">
            <svg className="size-2.5 text-[#51ff00]" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-5.446z"/>
            </svg>
            Prettier
          </span>
        </div>
      </footer>
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
  // Runs every 1 minute while the tab is open and the sandbox is running.
  useEffect(() => {
    if (typeof window === "undefined") return

    const ping = async () => {
      const status = sandboxStatusRef.current
      if (!status || status.status !== "running" || !status.sandboxId) return
      try {
        await fetch("/api/sandboxes/keepalive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: projectId }),
        });
      } catch {
        // ignore
      }
    }

    const interval = window.setInterval(ping, SANDBOX_KEEPALIVE_MS)
    return () => window.clearInterval(interval)
  }, [projectId])

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
