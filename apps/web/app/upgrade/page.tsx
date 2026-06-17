"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleHelp,
  Crown,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react"

type CheckoutPlan =
  | "trial"
  | "pro-monthly"
  | "unlimited-monthly"
  | "pro-annual"
  | "unlimited-annual"

type Plan = {
  title: string
  description: string
  price: string
  period?: string
  originalPrice?: string
  savings?: string
  eyebrow?: string
  badge?: string
  checkoutPlan?: CheckoutPlan
  href?: string
  buttonText: string
  featured?: boolean
  features: string[]
  includedLabel: string
  detail?: string
}

const discount = 0.2

function annualPrice(monthlyPrice: number) {
  return Math.round(monthlyPrice * 12 * (1 - discount))
}

const monthlyPlans: Plan[] = [
  {
    title: "Starter",
    description: "Bring your own keys and keep the workspace available for light usage.",
    price: "$0",
    period: "/month",
    badge: "Free",
    href: "/settings/keys",
    buttonText: "Use Starter",
    includedLabel: "Starter includes",
    features: [
      "Bring your own API keys",
      "Chat with ads enabled",
      "Basic usage limits",
      "Model key settings",
      "Workspace access",
    ],
  },
  {
    title: "Trial",
    description: "A short paid test drive before moving to a production plan.",
    price: "$2",
    period: "for 10 days",
    eyebrow: "Then Pro",
    checkoutPlan: "trial",
    buttonText: "Start Trial",
    includedLabel: "Trial includes",
    features: [
      "10-day access",
      "5 included credits",
      "Ads included",
      "Option to upgrade to Pro",
    ],
  },
  {
    title: "Pro",
    description: "Higher limits and a cleaner daily workflow for regular AI work.",
    price: "$49",
    period: "/month",
    badge: "Most Popular",
    checkoutPlan: "pro-monthly",
    buttonText: "Get Pro",
    featured: true,
    includedLabel: "Everything in Starter, and",
    detail: "100 credits/month",
    features: [
      "100 credits per month",
      "Reduced ads",
      "Priority email support",
      "Higher usage limits",
      "Multi-model AI chat",
    ],
  },
  {
    title: "Unlimited",
    description: "Premium capacity for building and running more apps without usage friction.",
    price: "$999",
    period: "/month",
    checkoutPlan: "unlimited-monthly",
    buttonText: "Get Unlimited",
    includedLabel: "Everything in Pro, and",
    features: [
      "Unlimited app access",
      "Unlimited credits",
      "Dedicated support",
      "Premium support priority",
      "Unrestricted usage",
    ],
  },
]

const annualPlans: Plan[] = [
  {
    title: "Starter",
    description: "Keep the free workspace for testing and bring-your-own-key usage.",
    price: "$0",
    period: "/year",
    badge: "Free",
    href: "/settings/keys",
    buttonText: "Use Starter",
    includedLabel: "Starter includes",
    features: [
      "Bring your own API keys",
      "Chat with ads enabled",
      "No recurring billing",
      "Model key settings",
      "Workspace access",
    ],
  },
  {
    title: "Pro Annual",
    description: "The Pro plan billed yearly with the annual 20% discount applied.",
    price: `$${annualPrice(49)}`,
    period: "/year",
    originalPrice: "$588/year",
    savings: "Save 20%",
    badge: "Most Popular",
    checkoutPlan: "pro-annual",
    buttonText: "Get Pro Annual",
    featured: true,
    includedLabel: "Everything in Starter, and",
    detail: "$39.20/month equivalent",
    features: [
      "100 credits per month",
      "Reduced ads",
      "Priority email support",
      "Higher usage limits",
      "Multi-model AI chat",
    ],
  },
  {
    title: "Unlimited Annual",
    description: "Unlimited access billed once yearly with the same 20% annual discount.",
    price: `$${annualPrice(999).toLocaleString()}`,
    period: "/year",
    originalPrice: "$11,988/year",
    savings: "Save 20%",
    checkoutPlan: "unlimited-annual",
    buttonText: "Get Unlimited Annual",
    includedLabel: "Everything in Pro, and",
    detail: "$799.20/month equivalent",
    features: [
      "Unlimited app access",
      "Unlimited credits",
      "Dedicated support",
      "Premium support priority",
      "Unrestricted usage",
    ],
  },
]

function PlanAction({ plan, isActive, balance }: { plan: Plan; isActive?: boolean; balance?: number }) {
  if (isActive) {
    return (
      <Button className="w-full gap-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10 cursor-default" variant="outline" disabled>
        Current Plan {balance !== undefined ? `(${balance.toFixed(2)} credits)` : ""}
      </Button>
    )
  }

  if (plan.href) {
    return (
      <Button asChild className="w-full gap-2" variant={plan.featured ? "default" : "secondary"}>
        <Link href={plan.href}>
          {plan.buttonText}
          <ArrowRight size={16} />
        </Link>
      </Button>
    )
  }

  return (
    <form action="/api/polar/checkout" method="post" className="w-full">
      <input type="hidden" name="plan" value={plan.checkoutPlan} />
      <Button type="submit" className="w-full gap-2" variant={plan.featured ? "default" : "secondary"}>
        {plan.buttonText}
        <ArrowRight size={16} />
      </Button>
    </form>
  )
}

function PlanCard({ plan, isActive, balance }: { plan: Plan; isActive?: boolean; balance?: number }) {
  return (
    <Card
      className={
        isActive
          ? "relative flex h-full flex-col border-emerald-500/50 bg-emerald-500/[0.01] shadow-lg shadow-emerald-500/5"
          : plan.featured
            ? "relative flex h-full flex-col border-primary/55 bg-card shadow-lg shadow-primary/10"
            : "relative flex h-full flex-col border-border/80 bg-card shadow-sm"
      }
    >
      <CardHeader className="space-y-4">
        <div className="flex min-h-8 items-start justify-between gap-3">
          <div>
            {plan.eyebrow ? (
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {plan.eyebrow}
              </p>
            ) : null}
            <CardTitle className="text-xl font-semibold tracking-tight">{plan.title}</CardTitle>
          </div>
          {isActive ? (
            <Badge className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider" variant="secondary">
              Active
            </Badge>
          ) : plan.savings || plan.badge ? (
            <Badge className="rounded-full bg-cyan-50 px-3 py-1 text-cyan-700 hover:bg-cyan-50" variant="secondary">
              {plan.savings ?? plan.badge}
            </Badge>
          ) : null}
        </div>

        <CardDescription className="min-h-11 text-sm leading-6">{plan.description}</CardDescription>

        <div className="space-y-1">
          {plan.originalPrice ? (
            <p className="text-sm text-muted-foreground">
              <span className="line-through">{plan.originalPrice}</span>
              <span className="ml-2 font-medium text-cyan-700">20% off annual</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
            {plan.period ? <span className="pb-1 text-sm text-muted-foreground">{plan.period}</span> : null}
          </div>
          {plan.detail ? <p className="text-sm text-muted-foreground">{plan.detail}</p> : null}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-5">
        <PlanAction plan={plan} isActive={isActive} balance={balance} />

        <div className="space-y-3">
          <p className="text-sm font-medium">{plan.includedLabel}</p>
          <ul className="space-y-3 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="flex gap-3 leading-5">
                <Check className="mt-0.5 size-4 shrink-0 text-cyan-600" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

function TrustItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background px-3 py-2">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
        <Icon size={14} />
      </div>
      <div>
        <p className="text-xs font-semibold leading-tight">{value}</p>
        <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  const [credits, setCredits] = useState<{ balance: number; lifetimeIssued: number } | null>(null)

  useEffect(() => {
    fetch("/api/credits", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.credits) setCredits(data.credits)
      })
      .catch(() => { })
  }, [])

  const getActivePlan = (credits: { balance: number; lifetimeIssued: number }) => {
    if (credits.lifetimeIssued >= 1000) {
      return { name: "Unlimited Plan", desc: "unlimited credits" }
    }
    if (credits.lifetimeIssued >= 100) {
      return { name: "Pro Plan", desc: "100 credits per month" }
    }
    if (credits.lifetimeIssued >= 5) {
      return { name: "Trial Plan", desc: "5 included credits" }
    }
    return null
  }

  const activePlan = credits ? getActivePlan(credits) : null

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex h-svh flex-col overflow-hidden bg-background">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Pricing</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <section className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-end">
              <div className="space-y-5">
                <div className="max-w-3xl space-y-3">
                  <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Choose the right AI workspace plan</h1>
                  <p className="text-base leading-7 text-muted-foreground">
                    Start free with your own keys, test with a small paid trial, or move to higher limits with monthly and annual billing.
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <TrustItem icon={BadgeCheck} value="20% annual discount" label="Applied to paid yearly plans" />
                <TrustItem icon={Zap} value="Upgrade anytime" label="Monthly or annual paid plans" />
              </div>
            </section>

            <Tabs defaultValue="monthly" className="space-y-6 rounded-none">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Pricing plans</h2>
                  <p className="text-sm text-muted-foreground">
                    Annual paid plans are calculated at 12 months minus 20%.
                  </p>
                </div>
                <TabsList className="grid w-full grid-cols-2 bg-muted p-1 sm:w-[280px]">
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger value="annual">Annual - Save 20%</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="monthly" className="mt-0">
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  {monthlyPlans.map((plan) => {
                    const isActive = activePlan
                      ? activePlan.name.toLowerCase().includes(plan.title.toLowerCase())
                      : plan.title === "Starter";
                    return (
                      <PlanCard
                        key={plan.title}
                        plan={plan}
                        isActive={isActive}
                        balance={isActive ? credits?.balance : undefined}
                      />
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="annual" className="mt-0">
                <div className="grid gap-5 lg:grid-cols-3">
                  {annualPlans.map((plan) => {
                    const firstWord = plan.title.split(" ")[0];
                    const isActive = activePlan && firstWord
                      ? activePlan.name.toLowerCase().includes(firstWord.toLowerCase())
                      : false;
                    return (
                      <PlanCard
                        key={plan.title}
                        plan={plan}
                        isActive={isActive}
                        balance={isActive ? credits?.balance : undefined}
                      />
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>

            <Card className="bg-muted">
              <CardFooter className="flex flex-col p-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-center">
                <span className="flex items-center">
                  <CircleHelp size={16} />
                  FAQs
                </span>
                <span className="hidden h-4 w-px bg-border sm:block" />
                <span className="flex items-center gap-2">
                  <Zap size={16} />
                  Plan comparison
                </span>
                <span className="hidden h-4 w-px bg-border sm:block" />
                <span className="flex items-center gap-2">
                  <Crown size={16} />
                  Priority support on paid plans
                </span>
              </CardFooter>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
