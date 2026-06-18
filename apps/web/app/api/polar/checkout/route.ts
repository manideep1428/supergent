import { NextResponse } from "next/server"
import { withAuth } from "@workos-inc/authkit-nextjs"

type PlanKey =
  | "trial"
  | "pro-monthly"
  | "unlimited-monthly"
  | "pro-annual"
  | "unlimited-annual"

const planProductEnv: Record<PlanKey, string> = {
  trial: "POLAR_PRODUCT_ID_TRIAL",
  "pro-monthly": "POLAR_PRODUCT_ID_PRO_MONTHLY",
  "unlimited-monthly": "POLAR_PRODUCT_ID_UNLIMITED_MONTHLY",
  "pro-annual": "POLAR_PRODUCT_ID_PRO_ANNUAL",
  "unlimited-annual": "POLAR_PRODUCT_ID_UNLIMITED_ANNUAL",
}

const planLabels: Record<PlanKey, string> = {
  trial: "Trial",
  "pro-monthly": "Pro Monthly",
  "unlimited-monthly": "Unlimited Monthly",
  "pro-annual": "Pro Annual",
  "unlimited-annual": "Unlimited Annual",
}

function isPlanKey(plan: FormDataEntryValue | null): plan is PlanKey {
  return typeof plan === "string" && plan in planProductEnv
}

function getPolarBaseUrl() {
  const server = process.env.POLAR_SERVER?.toLowerCase() ?? "sandbox"

  if (server === "production") {
    return "https://api.polar.sh/v1"
  }

  return "https://sandbox-api.polar.sh/v1"
}

function getAbsoluteUrl(request: Request, envUrl: string | undefined, fallbackPath: string) {
  if (envUrl) {
    return envUrl
  }

  return new URL(fallbackPath, request.url).toString()
}

export async function POST(request: Request) {
  return NextResponse.redirect(new URL("/upgrade?checkout=coming_soon", request.url), 303)
}
