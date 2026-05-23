"use client"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import {
  ChevronsUpDown,
  Coins,
  ExternalLink,
  Gift,
  Laptop,
  LogOut,
  Moon,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

export type UserMenuUser = {
  name: string
  email: string
  avatar?: string
}

type Side = "top" | "right" | "bottom" | "left"

type Props = {
  user: UserMenuUser
  trigger: React.ReactNode
  side?: Side
  align?: "start" | "center" | "end"
  /**
   * Pass `false` to skip wiring the chat-position toggle (useful when the menu
   * is rendered on a page that has no sandbox preview pane).
   */
  showChatPosition?: boolean
}

export function UserMenu({
  user,
  trigger,
  side = "right",
  align = "end",
  showChatPosition = true,
}: Props) {
  const { theme, setTheme } = useTheme()
  const [chatPosition, setChatPosition] = useState<"left" | "right">("right")
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem("chat_position")
    if (stored === "left" || stored === "right") {
      setChatPosition(stored)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch("/api/credits", { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as { credits?: { balance: number } }
        if (!cancelled && typeof data.credits?.balance === "number") {
          setCredits(data.credits.balance)
        }
      } catch (error) {
        console.error(error)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleChatPosition = () => {
    const next = chatPosition === "right" ? "left" : "right"
    setChatPosition(next)
    window.localStorage.setItem("chat_position", next)
    window.dispatchEvent(new CustomEvent("chatPositionChanged", { detail: next }))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-64 rounded-xl border bg-popover p-1.5 shadow-lg"
        side={side}
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="mb-1 flex flex-col border-b px-3 py-2 pb-2.5 text-left">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              Account
            </span>
            <span className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {user.email || user.name}
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuGroup className="space-y-0.5">
          <DropdownMenuItem asChild className="rounded-lg px-3 py-1.5">
            <Link href="/account">
              <Settings className="mr-2 text-muted-foreground" size={14} />
              <span>Account Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-lg px-3 py-1.5">
            <Link href="/upgrade">
              <Sparkles className="mr-2 text-muted-foreground" size={14} />
              <span>Pricing</span>
              <ExternalLink className="ml-auto text-muted-foreground/50" size={10} />
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="rounded-lg px-3 py-1.5">
            <Gift className="mr-2 text-muted-foreground" size={14} />
            <span>Refer</span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-lg px-3 py-1.5">
            <Link href="/dashboard">
              <Coins className="mr-2 text-muted-foreground" size={14} />
              <span>Credits</span>
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {credits === null
                  ? "—"
                  : credits.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              </span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1.5" />

        <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Preferences
        </div>

        <div className="space-y-1.5 py-1">
          <div className="flex items-center justify-between px-3 py-1 text-sm">
            <span className="font-medium text-muted-foreground">Theme</span>
            <div className="flex rounded-lg border border-muted/80 bg-muted/40 p-0.5">
              <button
                aria-label="System theme"
                className={cn(
                  "rounded-md p-1 transition-all",
                  theme === "system"
                    ? "scale-105 border border-border/20 bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTheme("system")}
                type="button"
              >
                <Laptop size={13} />
              </button>
              <button
                aria-label="Light theme"
                className={cn(
                  "rounded-md p-1 transition-all",
                  theme === "light"
                    ? "scale-105 border border-border/20 bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTheme("light")}
                type="button"
              >
                <Sun size={13} />
              </button>
              <button
                aria-label="Dark theme"
                className={cn(
                  "rounded-md p-1 transition-all",
                  theme === "dark"
                    ? "scale-105 border border-border/20 bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTheme("dark")}
                type="button"
              >
                <Moon size={13} />
              </button>
            </div>
          </div>

          {showChatPosition ? (
            <div className="flex items-center justify-between px-3 py-1 text-sm">
              <span className="font-medium text-muted-foreground">Chat Position</span>
              <button
                className="flex select-none items-center gap-1 rounded border border-muted/80 bg-muted px-2 py-1 text-xs font-semibold transition-colors hover:bg-muted/80"
                onClick={toggleChatPosition}
                type="button"
              >
                {chatPosition === "right" ? "Right" : "Left"}
                <ChevronsUpDown className="opacity-60" size={10} />
              </button>
            </div>
          ) : null}
        </div>

        <DropdownMenuSeparator className="my-1.5" />

        <DropdownMenuItem
          asChild
          className="rounded-lg px-3 py-1.5 text-red-500 hover:bg-red-500/10 hover:text-red-500 focus:bg-red-500/10 focus:text-red-500"
        >
          <a href="/logout">
            <LogOut className="mr-2" size={14} />
            <span>Sign Out</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
