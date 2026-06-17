"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@workos-inc/authkit-nextjs/components"

import { NavUser } from "@/components/nav-user"
import { Button } from "@workspace/ui/components/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import {
  ChevronRightIcon,
  HomeIcon,
  LayoutGridIcon,
  MessageSquareIcon,
  PencilIcon,
  SearchIcon,
  Settings2Icon,
  StarIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  ShareIcon,
  CopyIcon,
  LogInIcon,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

const fallbackUser = {
  name: "Guest",
  email: "",
  avatar: "",
}

type Project = {
  chatId: string
  title: string
  status: "creating" | "ready" | "error"
  updatedAt: number
  isFavorite: boolean
}

type Favorite = {
  chatId: string
  title: string
  status: "creating" | "ready" | "error"
  updatedAt: number
}

type SidebarUser = { name: string; email: string; avatar: string }

const primaryNav: { title: string; url: string; icon: React.ReactNode }[] = [
  { title: "Home", url: "/", icon: <HomeIcon className="size-4" /> },
  { title: "Projects", url: "/projects", icon: <LayoutGridIcon className="size-4" /> },
]

function isActive(pathname: string, url: string) {
  if (url === "/") return pathname === "/"
  return pathname === url || pathname.startsWith(`${url}/`)
}

export function AppSidebar({
  isSignedIn,
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { isSignedIn?: boolean; user?: SidebarUser }) {
  const { state, setOpen } = useSidebar()
  const { user: workosUser, loading: authLoading } = useAuth()
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const signedIn = isSignedIn ?? Boolean(workosUser)
  const sidebarUser = user ?? (workosUser ? {
    name: workosUser.firstName || workosUser.email || "User",
    email: workosUser.email || "",
    avatar: workosUser.profilePictureUrl || "",
  } : fallbackUser)

  const [query, setQuery] = React.useState("")
  const [recent, setRecent] = React.useState<Project[]>([])
  const [recentLoading, setRecentLoading] = React.useState(signedIn || authLoading)
  const [favorites, setFavorites] = React.useState<Favorite[]>([])
  const [favoritesLoading, setFavoritesLoading] = React.useState(signedIn || authLoading)

  const [projectToUnfavorite, setProjectToUnfavorite] = React.useState<string | null>(null)
  const [projectToDelete, setProjectToDelete] = React.useState<string | null>(null)
  const [projectToRename, setProjectToRename] = React.useState<string | null>(null)
  const [renameValue, setRenameValue] = React.useState("")
  const [renameLoading, setRenameLoading] = React.useState(false)
  const [sidebarFavoriteMutating, setSidebarFavoriteMutating] = React.useState(false)
  const [sidebarDeleteLoading, setSidebarDeleteLoading] = React.useState(false)

  // Silent background refetch — does NOT touch loading state so the list never flashes
  const silentRefreshRecent = React.useCallback(async () => {
    if (authLoading || !signedIn) return
    try {
      const response = await fetch("/api/projects?limit=8", { cache: "no-store" })
      if (!response.ok) return
      const data = (await response.json()) as { projects?: Project[] }
      setRecent(data.projects ?? [])
    } catch (error) {
      console.error(error)
    }
  }, [signedIn, authLoading])

  const silentRefreshFavorites = React.useCallback(async () => {
    if (authLoading || !signedIn) return
    try {
      const response = await fetch("/api/favorites?limit=20", { cache: "no-store" })
      if (!response.ok) return
      const data = (await response.json()) as { favorites?: Favorite[] }
      setFavorites(data.favorites ?? [])
    } catch (error) {
      console.error(error)
    }
  }, [signedIn, authLoading])

  // Initial load (shows "Loading…" only on first mount)
  const loadRecent = React.useCallback(async () => {
    if (authLoading) return
    if (!signedIn) {
      setRecent([])
      setRecentLoading(false)
      return
    }
    setRecentLoading(true)
    try {
      const response = await fetch("/api/projects?limit=8", { cache: "no-store" })
      if (!response.ok) return
      const data = (await response.json()) as { projects?: Project[] }
      setRecent(data.projects ?? [])
    } catch (error) {
      console.error(error)
    } finally {
      setRecentLoading(false)
    }
  }, [signedIn, authLoading])

  React.useEffect(() => {
    loadRecent()
  }, [loadRecent])

  const loadFavorites = React.useCallback(async () => {
    if (authLoading) return
    if (!signedIn) {
      setFavorites([])
      setFavoritesLoading(false)
      return
    }
    setFavoritesLoading(true)
    try {
      const response = await fetch("/api/favorites?limit=20", { cache: "no-store" })
      if (!response.ok) return
      const data = (await response.json()) as { favorites?: Favorite[] }
      setFavorites(data.favorites ?? [])
    } catch (error) {
      console.error(error)
    } finally {
      setFavoritesLoading(false)
    }
  }, [signedIn, authLoading])

  React.useEffect(() => {
    loadFavorites()
    // Listen for changes triggered by OTHER components (e.g. chat page favorite button)
    // but use silent refresh so the sidebar list doesn't flash
    const handler = () => {
      silentRefreshFavorites()
      silentRefreshRecent()
    }
    window.addEventListener("favoritesChanged", handler)
    return () => window.removeEventListener("favoritesChanged", handler)
  }, [loadFavorites, silentRefreshFavorites, silentRefreshRecent])

  const handleSidebarToggleFavorite = React.useCallback(async (chatId: string, currentIsFav: boolean) => {
    if (sidebarFavoriteMutating) return
    setSidebarFavoriteMutating(true)

    // --- Optimistic update ---
    if (currentIsFav) {
      // Remove from favorites list immediately
      setFavorites((prev) => prev.filter((f) => f.chatId !== chatId))
      // Mark as not-favorite in recent list immediately
      setRecent((prev) => prev.map((p) => p.chatId === chatId ? { ...p, isFavorite: false } : p))
    } else {
      // Mark as favorite in recent list immediately
      setRecent((prev) => prev.map((p) => p.chatId === chatId ? { ...p, isFavorite: true } : p))
      // Add to favorites list immediately (find from recent)
      setRecent((prev) => {
        const project = prev.find((p) => p.chatId === chatId)
        if (project) {
          setFavorites((favs) => {
            if (favs.some((f) => f.chatId === chatId)) return favs
            return [{ chatId: project.chatId, title: project.title, status: project.status, updatedAt: project.updatedAt }, ...favs]
          })
        }
        return prev
      })
    }

    try {
      const url = `/api/projects/${encodeURIComponent(chatId)}/favorite`
      const method = currentIsFav ? "DELETE" : "POST"
      const response = await fetch(url, { method })
      if (response.ok) {
        toast.success(currentIsFav ? "Removed from favorites" : "Added to favorites")
        // Silent background sync (no loading flash)
        silentRefreshFavorites()
        silentRefreshRecent()
        window.dispatchEvent(new Event("favoritesChanged"))
      } else {
        // Rollback optimistic update on failure
        toast.error("Failed to update favorite status")
        silentRefreshFavorites()
        silentRefreshRecent()
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to update favorite status")
      silentRefreshFavorites()
      silentRefreshRecent()
    } finally {
      setSidebarFavoriteMutating(false)
      setProjectToUnfavorite(null)
    }
  }, [sidebarFavoriteMutating, silentRefreshFavorites, silentRefreshRecent])

  const handleSidebarDelete = React.useCallback(async () => {
    if (!projectToDelete || sidebarDeleteLoading) return
    const deletedId = projectToDelete
    setSidebarDeleteLoading(true)

    // --- Optimistic update: remove from both lists immediately ---
    setRecent((prev) => prev.filter((p) => p.chatId !== deletedId))
    setFavorites((prev) => prev.filter((f) => f.chatId !== deletedId))

    try {
      const url = `/api/projects/${encodeURIComponent(deletedId)}`
      const response = await fetch(url, { method: "DELETE" })
      if (response.ok) {
        toast.success("Project deleted successfully")
        window.dispatchEvent(new Event("favoritesChanged"))
        const currentChatPath = `/chat/${encodeURIComponent(deletedId)}`
        if (pathname === currentChatPath) {
          router.push("/")
        }
      } else {
        const errData = await response.json().catch(() => ({}))
        toast.error(errData.error || "Failed to delete project")
        // Rollback: silent refresh to restore the item
        silentRefreshRecent()
        silentRefreshFavorites()
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete project")
      silentRefreshRecent()
      silentRefreshFavorites()
    } finally {
      setSidebarDeleteLoading(false)
      setProjectToDelete(null)
    }
  }, [projectToDelete, sidebarDeleteLoading, pathname, router, silentRefreshRecent, silentRefreshFavorites])

  const handleSidebarRename = React.useCallback(async () => {
    if (!projectToRename || renameLoading) return
    const newTitle = renameValue.trim()
    if (!newTitle) return
    setRenameLoading(true)
    // Optimistic update
    setRecent((prev) => prev.map((p) => p.chatId === projectToRename ? { ...p, title: newTitle } : p))
    setFavorites((prev) => prev.map((f) => f.chatId === projectToRename ? { ...f, title: newTitle } : f))
    try {
      const url = `/api/projects/${encodeURIComponent(projectToRename)}`
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      })
      if (response.ok) {
        toast.success("Project renamed")
        setProjectToRename(null)
        window.dispatchEvent(new Event("favoritesChanged"))
      } else {
        const errData = await response.json().catch(() => ({}))
        toast.error(errData.error || "Failed to rename project")
        silentRefreshRecent()
        silentRefreshFavorites()
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to rename project")
      silentRefreshRecent()
      silentRefreshFavorites()
    } finally {
      setRenameLoading(false)
    }
  }, [projectToRename, renameValue, renameLoading, silentRefreshRecent, silentRefreshFavorites])

  const filteredRecent = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recent
    return recent.filter(
      (project) =>
        project.title.toLowerCase().includes(q) ||
        project.chatId.toLowerCase().includes(q),
    )
  }, [query, recent])

  return (
    <Sidebar variant="inset" {...props} collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                  <Image src="/logo.png" alt="Supergent Logo" width={32} height={32} className="object-contain" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Supergent</span>
                  <span className="truncate text-xs text-muted-foreground">Personal</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {state === "collapsed" ? (
          <div className="flex justify-center py-1">
            <button
              onClick={() => setOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              title="Search chats"
            >
              <SearchIcon className="size-4" />
            </button>
          </div>
        ) : (
          <div className="relative px-1 pt-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <SidebarInput
              aria-label="Search recent chats"
              className="pl-8"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chats..."
              value={query}
            />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(pathname, item.url)}
                    tooltip={item.title}
                  >
                    <Link
                      href={
                        signedIn || item.url === "/"
                          ? item.url
                          : `/login?returnTo=${encodeURIComponent(item.url)}`
                      }
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {state !== "collapsed" && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-1.5">
                Favorites
              </SidebarGroupLabel>
              <SidebarGroupContent>
                {favoritesLoading ? (
                  <div className="px-2 py-1 text-[11px] text-muted-foreground">Loading…</div>
                ) : favorites.length === 0 ? (
                  <div className="rounded-md  border-sidebar-border/70 px-3 py-3 text-[11px] leading-snug text-muted-foreground">
                    {signedIn
                      ? "Pin chats from the Projects page to see them here."
                      : "Sign in to see favorite chats."}
                  </div>
                ) : (
                  <SidebarMenu>
                    {favorites.map((favorite) => {
                      const href = `/chat/${encodeURIComponent(favorite.chatId)}`
                      return (
                        <SidebarMenuItem key={favorite.chatId}>
                          <SidebarMenuButton
                            asChild
                            isActive={pathname === href}
                            tooltip={favorite.title}
                          >
                            <Link href={href}>
                              <span className="truncate">{favorite.title || "Untitled"}</span>
                            </Link>
                          </SidebarMenuButton>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuAction showOnHover className="aria-expanded:bg-muted text-zinc-400 hover:text-white">
                                <MoreHorizontalIcon className="size-3.5" />
                                <span className="sr-only">More</span>
                              </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 bg-zinc-950 border border-white/10 text-white">
                              <DropdownMenuItem
                                onClick={() => setProjectToUnfavorite(favorite.chatId)}
                                className="cursor-pointer hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
                              >
                                <StarIcon className="mr-2 size-4 fill-amber-400 text-amber-400" />
                                <span>Remove from favorites</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setRenameValue(favorite.title || "")
                                  setProjectToRename(favorite.chatId)
                                }}
                                className="cursor-pointer hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
                              >
                                <PencilIcon className="mr-2 size-4" />
                                <span>Rename</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled
                                className="cursor-pointer hover:bg-white/10 focus:bg-white/10 text-zinc-500 focus:text-zinc-500 opacity-50"
                              >
                                <ShareIcon className="mr-2 size-4" />
                                <span>Share</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled
                                className="cursor-pointer hover:bg-white/10 focus:bg-white/10 text-zinc-500 focus:text-zinc-500 opacity-50"
                              >
                                <CopyIcon className="mr-2 size-4" />
                                <span>Clone</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuItem
                                onSelect={() => setProjectToDelete(favorite.chatId)}
                                className="cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10"
                              >
                                <Trash2Icon className="mr-2 size-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                )}
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  Recent chats
                </span>
                <Link
                  className="flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                  href={signedIn ? "/projects" : "/login?returnTo=/projects"}
                >
                  All
                  <ChevronRightIcon className="size-3" />
                </Link>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {recentLoading ? (
                    <li className="px-2 py-1 text-[11px] text-muted-foreground">Loading…</li>
                  ) : filteredRecent.length === 0 ? (
                    <li className="px-2 py-1 text-[11px] text-muted-foreground">
                      {!signedIn ? "Sign in to see recent chats." : query ? "No matches." : "No chats yet."}
                    </li>
                  ) : (
                    filteredRecent.map((project) => {
                      const href = `/chat/${encodeURIComponent(project.chatId)}`
                      return (
                        <SidebarMenuItem key={project.chatId}>
                          <SidebarMenuButton asChild isActive={pathname === href} tooltip={project.title}>
                            <Link href={href}>
                              <span
                                aria-hidden
                                className={cn("size-1.5 rounded-full", {
                                  "bg-emerald-400": project.status === "ready",
                                  "bg-amber-400": project.status === "creating",
                                  "bg-red-400": project.status === "error",
                                })}
                              />
                              <span className="truncate">{project.title || "Untitled"}</span>
                            </Link>
                          </SidebarMenuButton>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuAction showOnHover className="aria-expanded:bg-muted text-zinc-400 hover:text-white">
                                <MoreHorizontalIcon className="size-3.5" />
                                <span className="sr-only">More</span>
                              </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 bg-zinc-950 border border-white/10 text-white">
                              <DropdownMenuItem
                                onClick={() => {
                                  if (project.isFavorite) {
                                    setProjectToUnfavorite(project.chatId)
                                  } else {
                                    handleSidebarToggleFavorite(project.chatId, false)
                                  }
                                }}
                                className="cursor-pointer hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
                              >
                                {project.isFavorite ? (
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
                                onClick={() => {
                                  setRenameValue(project.title || "")
                                  setProjectToRename(project.chatId)
                                }}
                                className="cursor-pointer hover:bg-white/10 focus:bg-white/10 text-white focus:text-white"
                              >
                                <PencilIcon className="mr-2 size-4" />
                                <span>Rename</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled
                                className="cursor-pointer hover:bg-white/10 focus:bg-white/10 text-zinc-500 focus:text-zinc-500 opacity-50"
                              >
                                <ShareIcon className="mr-2 size-4" />
                                <span>Share</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled
                                className="cursor-pointer hover:bg-white/10 focus:bg-white/10 text-zinc-500 focus:text-zinc-500 opacity-50"
                              >
                                <CopyIcon className="mr-2 size-4" />
                                <span>Clone</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuItem
                                onSelect={() => setProjectToDelete(project.chatId)}
                                className="cursor-pointer text-red-400 focus:text-red-400 hover:bg-red-500/10 focus:bg-red-500/10"
                              >
                                <Trash2Icon className="mr-2 size-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </SidebarMenuItem>
                      )
                    })
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        {/* Settings — always fixed above the avatar */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive(pathname, "/settings/keys")}
              tooltip="Settings"
            >
              <Link
                href={
                  signedIn
                    ? "/settings/keys"
                    : `/login?returnTo=${encodeURIComponent("/settings/keys")}`
                }
              >
                <Settings2Icon className="size-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {signedIn ? (
          <NavUser user={sidebarUser} />
        ) : authLoading ? (
          <div className="px-2 py-1 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">Loading…</div>
        ) : state === "collapsed" ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Sign in"
              >
                <Link href="/login?returnTo=/">
                  <LogInIcon className="size-4" />
                  <span>Sign in</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <div className="grid gap-2 p-1">
            <Button asChild size="sm">
              <Link href="/login?returnTo=/">Sign in</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/login?screen_hint=sign-up&returnTo=/">Create account</Link>
            </Button>
          </div>
        )}
      </SidebarFooter>

      <Dialog open={projectToDelete !== null} onOpenChange={(open) => { if (!open) setProjectToDelete(null) }}>
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
              onClick={() => setProjectToDelete(null)}
              disabled={sidebarDeleteLoading}
              className="text-zinc-400 hover:text-white hover:bg-white/10 border-white/10"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSidebarDelete}
              disabled={sidebarDeleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {sidebarDeleteLoading ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={projectToUnfavorite !== null} onOpenChange={(open) => { if (!open) setProjectToUnfavorite(null) }}>
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
              onClick={() => setProjectToUnfavorite(null)}
              disabled={sidebarFavoriteMutating}
              className="text-zinc-400 hover:text-white hover:bg-white/10 border-white/10"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (projectToUnfavorite) {
                  handleSidebarToggleFavorite(projectToUnfavorite, true)
                }
              }}
              disabled={sidebarFavoriteMutating}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {sidebarFavoriteMutating ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={projectToRename !== null} onOpenChange={(open) => { if (!open) setProjectToRename(null) }}>
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
                  handleSidebarRename()
                }
              }}
              placeholder="Project name"
              value={renameValue}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setProjectToRename(null)}
              disabled={renameLoading}
              className="text-zinc-400 hover:text-white hover:bg-white/10 border-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSidebarRename}
              disabled={renameLoading || !renameValue.trim()}
              className="bg-white text-black hover:bg-zinc-200"
            >
              {renameLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>

  )
}
