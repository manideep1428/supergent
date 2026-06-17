import type { Metadata } from "next"
import { Geist, Geist_Mono, Nunito_Sans } from "next/font/google"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { ConvexClientProvider } from "@/components/convex-provider"

export const metadata: Metadata = {
  title: "Supergent",
  description: "Personal AI Agent Sandbox",
  icons: {
    icon: "/logo.png",
  },
}

const nunitoSans = Nunito_Sans({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased h-svh overflow-hidden", fontMono.variable, "font-sans", nunitoSans.variable)}
    >
      <body className="h-svh overflow-hidden">
        <ThemeProvider>
          <AuthKitProvider>
            <ConvexClientProvider>
              <TooltipProvider>
                {children}
              </TooltipProvider>
            </ConvexClientProvider>
          </AuthKitProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
