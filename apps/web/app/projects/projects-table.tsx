"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  FilterIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  StarIcon,
  StarOffIcon,
  Trash2Icon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

export type Project = {
  chatId: string
  title: string
  modelId: string | null
  status: "creating" | "ready" | "error"
  sandboxId: string | null
  previewUrl: string | null
  generatedFilesCount: number
  createdAt: number
  updatedAt: number
  isFavorite: boolean
}

type StatusFilter = "all" | Project["status"]
type SortKey = "updated" | "created" | "name"

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "All statuses",
  ready: "Ready",
  creating: "Creating",
  error: "Error",
}

const SORT_LABEL: Record<SortKey, string> = {
  updated: "Updated",
  created: "Created",
  name: "Name",
}

function formatRelative(timestamp: number) {
  const now = Date.now()
  const diff = now - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return "just now"
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function StatusBadge({ status }: { status: Project["status"] }) {
  if (status === "ready") {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400" variant="outline">
        ready
      </Badge>
    )
  }
  if (status === "error") {
    return (
      <Badge className="border-red-500/30 bg-red-500/10 text-red-400" variant="outline">
        error
      </Badge>
    )
  }
  return (
    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-400" variant="outline">
      creating
    </Badge>
  )
}

export function ProjectsTable({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter()

  const [projects, setProjects] = React.useState<Project[]>(initialProjects)
  const [query, setQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
  const [sort, setSort] = React.useState<SortKey>("updated")

  const [pendingDelete, setPendingDelete] = React.useState<Project | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [pendingRename, setPendingRename] = React.useState<Project | null>(null)
  const [renameValue, setRenameValue] = React.useState("")
  const [renaming, setRenaming] = React.useState(false)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    let result = projects
    if (q) {
      result = result.filter(
        (project) =>
          project.title.toLowerCase().includes(q) ||
          project.chatId.toLowerCase().includes(q) ||
          (project.modelId?.toLowerCase().includes(q) ?? false),
      )
    }
    if (statusFilter !== "all") {
      result = result.filter((project) => project.status === statusFilter)
    }
    return [...result].sort((a, b) => {
      if (sort === "updated") return b.updatedAt - a.updatedAt
      if (sort === "created") return b.createdAt - a.createdAt
      return a.title.localeCompare(b.title)
    })
  }, [projects, query, statusFilter, sort])

  const handleOpen = (chatId: string) => {
    router.push(`/chat/${encodeURIComponent(chatId)}`)
  }

  const handleToggleFavorite = async (project: Project) => {
    const next = !project.isFavorite
    // Optimistic update
    setProjects((prev) =>
      prev.map((p) =>
        p.chatId === project.chatId ? { ...p, isFavorite: next } : p,
      ),
    )
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.chatId)}/favorite`,
        { method: next ? "POST" : "DELETE" },
      )
      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: string }))
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }
      window.dispatchEvent(new CustomEvent("favoritesChanged"))
      toast.success(next ? "Added to favorites" : "Removed from favorites", {
        description: project.title,
      })
    } catch (error: any) {
      // Revert
      setProjects((prev) =>
        prev.map((p) =>
          p.chatId === project.chatId
            ? { ...p, isFavorite: project.isFavorite }
            : p,
        ),
      )
      toast.error("Could not update favorite", {
        description: error?.message ?? "Unknown error",
      })
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(pendingDelete.chatId)}`,
        { method: "DELETE" },
      )
      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: string }))
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }
      setProjects((prev) => prev.filter((p) => p.chatId !== pendingDelete.chatId))
      toast.success("Project deleted", {
        description: `“${pendingDelete.title}” has been removed.`,
      })
      setPendingDelete(null)
      router.refresh()
    } catch (error: any) {
      toast.error("Could not delete project", {
        description: error?.message ?? "Unknown error",
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleRename = async () => {
    if (!pendingRename) return
    const newTitle = renameValue.trim()
    if (!newTitle) return
    setRenaming(true)
    // Optimistic update
    setProjects((prev) =>
      prev.map((p) => p.chatId === pendingRename.chatId ? { ...p, title: newTitle } : p)
    )
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(pendingRename.chatId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        }
      )
      if (!response.ok) {
        const body = await response.json().catch(() => ({} as { error?: string }))
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }
      window.dispatchEvent(new CustomEvent("favoritesChanged"))
      toast.success("Project renamed", { description: newTitle })
      setPendingRename(null)
    } catch (error: any) {
      // Revert
      setProjects((prev) =>
        prev.map((p) =>
          p.chatId === pendingRename.chatId ? { ...p, title: pendingRename.title } : p
        )
      )
      toast.error("Could not rename project", {
        description: error?.message ?? "Unknown error",
      })
    } finally {
      setRenaming(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search projects"
            className="h-11 rounded-lg bg-muted/40 pl-9 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects, chat ids, models..."
            value={query}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-9 rounded-lg" size="sm" variant="outline">
              <FilterIcon className="mr-1.5 size-4" />
              Filter
              {statusFilter !== "all" ? (
                <Badge className="ml-2 capitalize" variant="secondary">
                  {statusFilter}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.entries(STATUS_LABEL) as [StatusFilter, string][]).map(([value, label]) => (
              <DropdownMenuItem
                className={cn({ "bg-accent": statusFilter === value })}
                key={value}
                onSelect={() => setStatusFilter(value)}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-9 rounded-lg" size="sm" variant="ghost">
                Sort: {SORT_LABEL[sort]}
                <ChevronDownIcon className="ml-1 size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {(Object.entries(SORT_LABEL) as [SortKey, string][]).map(([value, label]) => (
                <DropdownMenuItem
                  className={cn({ "bg-accent": sort === value })}
                  key={value}
                  onSelect={() => setSort(value)}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <SearchIcon className="size-8 text-muted-foreground" />
          </EmptyHeader>
          <EmptyContent>
            <EmptyTitle>No projects match</EmptyTitle>
            <EmptyDescription>
              Try a different search term or clear the status filter.
            </EmptyDescription>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Files</th>
                <th className="px-4 py-3 text-right font-medium">{SORT_LABEL[sort]}</th>
                <th aria-hidden className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((project) => (
                <tr
                  className="cursor-pointer border-b last:border-b-0 hover:bg-muted/30"
                  key={project.chatId}
                  onClick={() => handleOpen(project.chatId)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-medium hover:underline">
                      {project.isFavorite ? (
                        <StarIcon
                          aria-label="Favorite"
                          className="size-3.5 shrink-0 fill-amber-400 text-amber-400"
                        />
                      ) : null}
                      <span>{project.title || "Untitled project"}</span>
                    </div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                      {project.chatId}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={project.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {project.generatedFilesCount}
                  </td>

                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {formatRelative(
                      sort === "created" ? project.createdAt : project.updatedAt,
                    )}
                  </td>
                  <td
                    className="px-2 py-3 text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label="Project actions"
                          className="size-8"
                          size="icon"
                          variant="ghost"
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => handleOpen(project.chatId)}>
                          <MessageSquareIcon className="mr-2 size-4" />
                          Open chat
                        </DropdownMenuItem>
                        {project.previewUrl ? (
                          <DropdownMenuItem asChild>
                            <Link
                              href={project.previewUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <ExternalLinkIcon className="mr-2 size-4" />
                              Open preview
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          onSelect={() => handleToggleFavorite(project)}
                        >
                          {project.isFavorite ? (
                            <>
                              <StarOffIcon className="mr-2 size-4" />
                              Remove from favorites
                            </>
                          ) : (
                            <>
                              <StarIcon className="mr-2 size-4" />
                              Add to favorites
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setRenameValue(project.title || "")
                            setPendingRename(project)
                          }}
                        >
                          <PencilIcon className="mr-2 size-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-500 focus:bg-red-500/10 focus:text-red-500"
                          onSelect={() => setPendingDelete(project)}
                        >
                          <Trash2Icon className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes
              {pendingDelete ? ` "${pendingDelete.title}" ` : " this project "}
              along with its chat history and saved snapshots. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-600/90"
              disabled={deleting}
              onClick={handleDelete}
              type="button"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingRename)}
        onOpenChange={(open) => {
          if (!open && !renaming) setPendingRename(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename project</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              disabled={renaming}
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
          <AlertDialogFooter>
            <Button
              disabled={renaming}
              onClick={() => setPendingRename(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={renaming || !renameValue.trim()}
              onClick={handleRename}
              type="button"
            >
              {renaming ? "Saving..." : "Save"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
