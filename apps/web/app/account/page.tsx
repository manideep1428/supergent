import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Separator } from "@workspace/ui/components/separator"
import { withAuth } from '@workos-inc/authkit-nextjs'
import { Button } from "@workspace/ui/components/button"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { ShieldCheck, User2, BadgeCheck } from "lucide-react"

export default async function AccountPage() {
  const { user } = await withAuth()

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
            <span className="text-sm font-medium">Account Settings</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 bg-background">
          <div className="max-w-3xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Account Profile</h1>
              <p className="text-muted-foreground text-sm">
                Manage your profile, login details, and security configurations.
              </p>
            </div>

            <Separator />

            {/* Profile Info Section */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <User2 size={16} /> Profile Details
                </h3>
                <p className="text-muted-foreground text-xs mt-1">
                  Your identity details synced via WorkOS SSO.
                </p>
              </div>
              <div className="md:col-span-2 border rounded-xl p-6 bg-card space-y-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 rounded-xl border">
                    <AvatarImage src={user?.profilePictureUrl || ""} alt={user?.firstName || "User"} />
                    <AvatarFallback className="rounded-xl font-bold text-lg">
                      {user?.firstName?.slice(0, 2).toUpperCase() || "US"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold text-lg flex items-center gap-1.5">
                      {user?.firstName} {user?.lastName}
                      <BadgeCheck size={16} className="text-primary fill-primary/10" />
                    </h4>
                    <p className="text-muted-foreground text-sm">{user?.email}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">First Name</span>
                    <div className="px-3 py-2 border rounded-md bg-muted/30 text-sm font-medium">
                      {user?.firstName || "Not provided"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Last Name</span>
                    <div className="px-3 py-2 border rounded-md bg-muted/30 text-sm font-medium">
                      {user?.lastName || "Not provided"}
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email Address</span>
                    <div className="px-3 py-2 border rounded-md bg-muted/30 text-sm font-medium">
                      {user?.email}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Security Section */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <ShieldCheck size={16} /> Security & Session
                </h3>
                <p className="text-muted-foreground text-xs mt-1">
                  Security configurations and single sign-on providers.
                </p>
              </div>
              <div className="md:col-span-2 border rounded-xl p-6 bg-card space-y-6 shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div>
                      <h5 className="font-medium text-sm">SSO Connection</h5>
                      <p className="text-muted-foreground text-xs">Your account is connected using WorkOS Enterprise SSO.</p>
                    </div>
                    <div className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
                      Connected
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-sm">Account Type</h5>
                      <p className="text-muted-foreground text-xs">Authorized permissions level.</p>
                    </div>
                    <div className="px-2.5 py-0.5 rounded-full border text-xs font-semibold tracking-wide">
                      Standard User
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
