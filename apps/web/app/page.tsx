import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Separator } from "@workspace/ui/components/separator"
import { HomeChatBox } from "@/components/ai/home-chat-box"
import { withAuth } from '@workos-inc/authkit-nextjs'
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"

export default async function Page() {
  const { user } = await withAuth()

  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="flex max-w-md w-full flex-col gap-6 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Emergent AI</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Experience the next generation of AI-powered workflows.
              Sign in to start chatting and managing your projects.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="w-full">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button variant="outline" asChild size="lg" className="w-full">
              <Link href="/login?screen_hint=sign-up">Create an account</Link>
            </Button>
          </div>

          <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest">
            Powered by WorkOS AuthKit
          </div>
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar user={{
        name: user.firstName || user.email || "User",
        email: user.email || "",
        avatar: user.profilePictureUrl || ""
      }} />
      <SidebarInset className="flex flex-col h-svh overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Chat</span>
            <span className="text-muted-foreground text-xs px-1.5 py-0.5 bg-muted rounded-md font-mono">v1.0</span>
          </div>
        </header>
        <div className="flex-1 min-h-0 relative flex flex-col">
          <HomeChatBox />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
