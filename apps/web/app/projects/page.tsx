import Link from "next/link"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { ConvexHttpClient } from "convex/browser"
import { api } from "backend/convex/_generated/api"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { FolderOpenIcon, PlusIcon } from "lucide-react"
import { ProjectsTable, type Project } from "./projects-table"

export const dynamic = "force-dynamic"

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL
  if (!url) return null
  return new ConvexHttpClient(url)
}

async function loadProjects(userId: string): Promise<Project[]> {
  const convex = getConvexClient()
  if (!convex) return []
  try {
    return (await convex.query(api.chats.listByUser, {
      userId,
      limit: 100,
    })) as Project[]
  } catch (error) {
    console.error("Could not load projects", error)
    return []
  }
}

export default async function ProjectsPage() {
  const { user } = await withAuth()

  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="flex max-w-md w-full flex-col gap-6 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Emergent AI</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Sign in to see your projects.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button asChild className="w-full" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const projects = await loadProjects(user.id)

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar
        user={{
          name: user.firstName || user.email || "User",
          email: user.email || "",
          avatar: user.profilePictureUrl || "",
        }}
      />
      <SidebarInset className="flex h-svh flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Projects</span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {projects.length}
            </span>
          </div>
          <div className="ml-auto">
            <Button asChild size="sm">
              <Link href="/">
                <PlusIcon className="mr-1.5 size-4" />
                New project
              </Link>
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto w-full max-w-5xl space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
              <p className="text-sm text-muted-foreground">
                Every chat starts a sandbox project. Click a row to open it.
              </p>
            </div>

            {projects.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <FolderOpenIcon className="size-8 text-muted-foreground" />
                </EmptyHeader>
                <EmptyContent>
                  <EmptyTitle>No projects yet</EmptyTitle>
                  <EmptyDescription>
                    Start a new chat from the home page and the agent will create a sandbox project for you.
                  </EmptyDescription>
                </EmptyContent>
              </Empty>
            ) : (
              <ProjectsTable initialProjects={projects} />
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
