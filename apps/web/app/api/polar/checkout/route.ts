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
  const formData = await request.formData()
  const plan = formData.get("plan")

  if (!isPlanKey(plan)) {
    return NextResponse.redirect(new URL("/upgrade?checkout=invalid_plan", request.url), 303)
  }

  const { user } = await withAuth()

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 303)
  }

  const accessToken = process.env.POLAR_ACCESS_TOKEN
  const productId = process.env[planProductEnv[plan]]

  if (!accessToken || !productId) {
    return NextResponse.redirect(new URL("/upgrade?checkout=missing_polar_config", request.url), 303)
  }

  const successUrl = getAbsoluteUrl(
    request,
    process.env.POLAR_SUCCESS_URL,
    "/billing?checkout_id={CHECKOUT_ID}",
  )
  const returnUrl = getAbsoluteUrl(request, process.env.POLAR_RETURN_URL, "/upgrade")
  const customerName = [user.firstName, user.lastName].filter(Boolean).join(" ")

  const response = await fetch(`${getPolarBaseUrl()}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      products: [productId],
      success_url: successUrl,
      return_url: returnUrl,
      external_customer_id: user.id,
      customer_email: user.email,
      customer_name: customerName || user.email,
      metadata: {
        plan,
        plan_label: planLabels[plan],
        app: "supergent",
      },
      customer_metadata: {
        workos_user_id: user.id,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("Polar checkout creation failed", {
      status: response.status,
      body: errorText,
      plan,
    })

    return NextResponse.redirect(new URL("/upgrade?checkout=polar_error", request.url), 303)
  }

  const checkout = (await response.json()) as { url?: string }

  if (!checkout.url) {
    return NextResponse.redirect(new URL("/upgrade?checkout=missing_checkout_url", request.url), 303)
  }

  return NextResponse.redirect(checkout.url, 303)
}
