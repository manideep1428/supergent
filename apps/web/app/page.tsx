import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { HomeChatBox } from "@/components/ai/home-chat-box"
import { withAuth } from '@workos-inc/authkit-nextjs'
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"

export default async function Page() {
  const { user } = await withAuth()

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar
        isSignedIn={Boolean(user)}
        user={
          user
            ? {
              name: user.firstName || user.email || "User",
              email: user.email || "",
              avatar: user.profilePictureUrl || "",
            }
            : undefined
        }
      />
      <SidebarInset className="flex flex-col h-svh overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
          </div>
          {!user ? (
            <Button asChild size="sm">
              <Link href="/login?returnTo=/">Sign in</Link>
            </Button>
          ) : null}
        </header>
        <div className="flex-1 min-h-0 relative flex flex-col">
          <HomeChatBox isSignedIn={Boolean(user)} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
