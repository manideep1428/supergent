"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavUser } from "@/components/nav-user"
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
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import {
  ChevronRightIcon,
  HomeIcon,
  LayoutGridIcon,
  MessageSquareIcon,
  SearchIcon,
  Settings2Icon,
  StarIcon,
  TerminalIcon,
} from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

const fallbackUser = {
  name: "shadcn",
  email: "m@example.com",
  avatar: "/avatars/shadcn.jpg",
}

type Project = {
  chatId: string
  title: string
  status: "creating" | "ready" | "error"
  updatedAt: number
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
  { title: "Settings", url: "/settings/keys", icon: <Settings2Icon className="size-4" /> },
]

function isActive(pathname: string, url: string) {
  if (url === "/") return pathname === "/"
  return pathname === url || pathname.startsWith(`${url}/`)
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user?: SidebarUser }) {
  const pathname = usePathname() ?? "/"
  const sidebarUser = user ?? fallbackUser

  const [query, setQuery] = React.useState("")
  const [recent, setRecent] = React.useState<Project[]>([])
  const [recentLoading, setRecentLoading] = React.useState(true)
  const [favorites, setFavorites] = React.useState<Favorite[]>([])
  const [favoritesLoading, setFavoritesLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    const loadRecent = async () => {
      try {
        const response = await fetch("/api/projects?limit=8", { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as { projects?: Project[] }
        if (!cancelled) setRecent(data.projects ?? [])
      } catch (error) {
        console.error(error)
      } finally {
        if (!cancelled) setRecentLoading(false)
      }
    }
    loadRecent()
    return () => {
      cancelled = true
    }
  }, [])

  const loadFavorites = React.useCallback(async () => {
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
  }, [])

  React.useEffect(() => {
    loadFavorites()
    const handler = () => {
      loadFavorites()
    }
    window.addEventListener("favoritesChanged", handler)
    return () => window.removeEventListener("favoritesChanged", handler)
  }, [loadFavorites])

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
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <TerminalIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Emergent</span>
                  <span className="truncate text-xs text-muted-foreground">Personal</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

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
                    <Link href={item.url}>
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-1.5">
            <StarIcon className="size-3.5" />
            Favorites
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {favoritesLoading ? (
              <div className="px-2 py-1 text-[11px] text-muted-foreground">Loading…</div>
            ) : favorites.length === 0 ? (
              <div className="rounded-md border border-dashed border-sidebar-border/70 px-3 py-3 text-[11px] leading-snug text-muted-foreground">
                Pin chats from the Projects page to see them here.
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
                          <StarIcon className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
                          <span className="truncate">{favorite.title || "Untitled"}</span>
                        </Link>
                      </SidebarMenuButton>
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
              <MessageSquareIcon className="size-3.5" />
              Recent chats
            </span>
            <Link
              className="flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
              href="/projects"
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
                  {query ? "No matches." : "No chats yet."}
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
                    </SidebarMenuItem>
                  )
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={sidebarUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
