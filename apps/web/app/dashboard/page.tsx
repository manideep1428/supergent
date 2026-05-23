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
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { ArrowUpRightIcon, CoinsIcon } from "lucide-react"

export const dynamic = "force-dynamic"

type Credits = {
  balance: number
  lifetimeUsed: number
  lifetimeIssued: number
  initialized: boolean
}

type UsageRow = {
  chatId: string
  modelId: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  credits: number
  createdAt: number
}

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL
  if (!url) return null
  return new ConvexHttpClient(url)
}

async function loadCreditsData(userId: string) {
  const convex = getConvexClient()
  if (!convex) {
    return {
      credits: {
        balance: 0,
        lifetimeUsed: 0,
        lifetimeIssued: 0,
        initialized: false,
      } as Credits,
      recent: [] as UsageRow[],
    }
  }
  try {
    const [credits, recent] = await Promise.all([
      convex.query(api.credits.getCredits, { userId }) as Promise<Credits>,
      convex.query(api.credits.recentUsage, { userId, limit: 25 }) as Promise<UsageRow[]>,
    ])
    return { credits, recent }
  } catch (error) {
    console.error("Could not load credits", error)
    return {
      credits: {
        balance: 0,
        lifetimeUsed: 0,
        lifetimeIssued: 0,
        initialized: false,
      } as Credits,
      recent: [] as UsageRow[],
    }
  }
}

const NUMBER_FMT_2 = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NUMBER_FMT_4 = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
})

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
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

export default async function DashboardPage() {
  const { user } = await withAuth()

  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="flex max-w-md w-full flex-col gap-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Emergent AI</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Sign in to see your credits.
          </p>
          <Button asChild className="w-full" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    )
  }

  const { credits, recent } = await loadCreditsData(user.id)
  const balance = Math.max(0, credits.balance)

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
            <span className="text-sm font-medium">Dashboard</span>
            <Badge className="font-mono text-[10px]" variant="secondary">
              credits
            </Badge>
          </div>
          <div className="ml-auto">
            <Button asChild size="sm" variant="outline">
              <Link href="/upgrade">
                <ArrowUpRightIcon className="mr-1.5 size-4" />
                Upgrade
              </Link>
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto w-full max-w-5xl space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Credits</h1>
              <p className="text-sm text-muted-foreground">
                Each chat call is billed by token usage. The balance below updates
                in real time as the agent works.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Balance</CardDescription>
                  <CardTitle className="flex items-baseline gap-2 text-3xl font-bold tracking-tight">
                    <CoinsIcon className="size-5 text-amber-400" />
                    {NUMBER_FMT_2.format(balance)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {credits.initialized
                    ? `Issued ${NUMBER_FMT_2.format(credits.lifetimeIssued)} · Used ${NUMBER_FMT_2.format(credits.lifetimeUsed)}`
                    : "No usage yet — your first chat will create your account ledger."}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Input pricing</CardDescription>
                  <CardTitle className="text-2xl font-semibold">1.00 / 300k tokens</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Charged per prompt + tool-call input streamed to the model.
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Output pricing</CardDescription>
                  <CardTitle className="text-2xl font-semibold">1.00 / 100k tokens</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Charged per token the model generates back to you.
                </CardContent>
              </Card>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium">Recent usage</h2>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {recent.length} {recent.length === 1 ? "call" : "calls"}
                </span>
              </div>

              {recent.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
                  No tokens charged yet. Send a message in any chat and it will show up here.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border bg-background">
                  <table className="w-full text-sm">
                    <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">When</th>
                        <th className="px-4 py-3 text-left font-medium">Model</th>
                        <th className="hidden px-4 py-3 text-right font-medium md:table-cell">
                          Input
                        </th>
                        <th className="hidden px-4 py-3 text-right font-medium md:table-cell">
                          Output
                        </th>
                        <th className="px-4 py-3 text-right font-medium">Credits</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((row) => (
                        <tr
                          className="border-b last:border-b-0 hover:bg-muted/30"
                          key={`${row.chatId}-${row.createdAt}`}
                        >
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatRelative(row.createdAt)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{row.modelId}</td>
                          <td className="hidden px-4 py-3 text-right font-mono text-xs text-muted-foreground md:table-cell">
                            {formatTokens(row.inputTokens)}
                          </td>
                          <td className="hidden px-4 py-3 text-right font-mono text-xs text-muted-foreground md:table-cell">
                            {formatTokens(row.outputTokens)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            -{NUMBER_FMT_4.format(row.credits)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/chat/${encodeURIComponent(row.chatId)}`}>
                                Open
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
