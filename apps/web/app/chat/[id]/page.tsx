import { Button } from "@workspace/ui/components/button"
import { withAuth } from "@workos-inc/authkit-nextjs"
import Link from "next/link"
import { ChatSessionShell } from "@/components/ai/chat-session-shell"

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { user } = await withAuth()
  const { id } = await params

  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col gap-6 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Emergent AI</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Experience the next generation of AI-powered workflows. Sign in to start chatting
              and managing your projects.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button asChild className="w-full" size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="w-full" size="lg" variant="outline">
              <Link href="/login?screen_hint=sign-up">Create an account</Link>
            </Button>
          </div>

          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            Powered by WorkOS AuthKit
          </div>
        </div>
      </div>
    )
  }

  return (
    <ChatSessionShell
      projectId={id}
      user={{
        profilePictureUrl: user.profilePictureUrl || null,
        firstName: user.firstName || null,
        email: user.email || null,
      }}
    />
  )
}
