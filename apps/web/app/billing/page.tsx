import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Separator } from "@workspace/ui/components/separator"
import { withAuth } from '@workos-inc/authkit-nextjs'
import { Button } from "@workspace/ui/components/button"
import { CreditCard, History, Wallet } from "lucide-react"

export default async function BillingPage() {
  const { user } = await withAuth()

  const invoices = [
    { id: "INV-2026-001", date: "May 1, 2026", amount: "$0.00", status: "Paid" },
    { id: "INV-2026-002", date: "April 1, 2026", amount: "$0.00", status: "Paid" },
    { id: "INV-2026-003", date: "March 1, 2026", amount: "$0.00", status: "Paid" },
  ]

  return (
    <SidebarProvider>
      <AppSidebar user={user ? {
        name: user.firstName || user.email || "User",
        email: user.email || "",
        avatar: user.profilePictureUrl || ""
      } : undefined} />
      <SidebarInset className="flex flex-col h-svh overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Billing & Subscriptions</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 bg-background">
          <div className="max-w-3xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Billing & Plans</h1>
              <p className="text-muted-foreground text-sm">
                Manage your payment information, subscriptions, and invoice history.
              </p>
            </div>

            <Separator />

            {/* Current Plan Section */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Wallet size={16} /> Subscription Plan
                </h3>
                <p className="text-muted-foreground text-xs mt-1">
                  Details about your active plan and upcoming billing cycles.
                </p>
              </div>
              <div className="md:col-span-2 border rounded-xl p-6 bg-card space-y-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-lg">Standard Plan</h4>
                    <p className="text-muted-foreground text-sm">You are currently on the free hobby tier.</p>
                  </div>
                  <div className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
                    Free
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-muted/20 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-foreground">Active (Free)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Renewal Date</span>
                    <span className="font-medium text-foreground">N/A</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button asChild className="flex-1">
                    <Link href="/upgrade">Upgrade Plan</Link>
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Payment Details Section */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <CreditCard size={16} /> Payment Method
                </h3>
                <p className="text-muted-foreground text-xs mt-1">
                  Card used for automated billing and pricing plan changes.
                </p>
              </div>
              <div className="md:col-span-2 border rounded-xl p-6 bg-card space-y-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-16 border rounded bg-muted/40 flex items-center justify-center font-mono font-bold text-xs text-muted-foreground tracking-widest">
                    CARD
                  </div>
                  <div>
                    <h5 className="font-medium text-sm">No payment method added</h5>
                    <p className="text-muted-foreground text-xs">Add a credit or debit card to configure premium plans.</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full">Add Card Detail</Button>
              </div>
            </div>

            <Separator />

            {/* Invoice History Section */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <History size={16} /> Billing History
                </h3>
                <p className="text-muted-foreground text-xs mt-1">
                  Past invoices and receipts of subscription transactions.
                </p>
              </div>
              <div className="md:col-span-2 border rounded-xl p-6 bg-card shadow-sm">
                <div className="space-y-4">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0 text-sm">
                      <div>
                        <p className="font-medium text-foreground">{inv.id}</p>
                        <p className="text-muted-foreground text-xs">{inv.date}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-foreground">{inv.amount}</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
