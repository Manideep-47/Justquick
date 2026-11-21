
import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { getSupabaseAdmin } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const COOKIE_NAME = "jq_vendor_session"
const SESSION_DURATION = 12 * 60 * 60

function signShopId(shopId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!secret) {
    throw new Error("Server secret is not configured")
  }

  return createHmac("sha256", secret)
    .update(shopId)
    .digest("hex")
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const loginCode = String(body.loginCode || "").trim()

    if (!/^\d{6}$/.test(loginCode)) {
      return NextResponse.json(
        { error: "Enter a valid 6-digit shop code" },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: shop, error } = await supabaseAdmin
      .from("shops")
      .select("id, name")
      .eq("login_code", loginCode)
      .maybeSingle()

    if (error) {
      console.error("Vendor login lookup failed:", error.message)
      return NextResponse.json(
        { error: "Unable to verify shop login" },
        { status: 500 }
      )
    }

    if (!shop) {
      return NextResponse.json(
        { error: "Invalid shop login code" },
        { status: 401 }
      )
    }

    const token = `${shop.id}.${signShopId(shop.id)}`

    const response = NextResponse.json({
      success: true,
      shop: {
        id: shop.id,
        name: shop.name,
      },
    })

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION,
    })

    return response
  } catch (error) {
    console.error("Vendor login error:", error)

    return NextResponse.json(
      { error: "Vendor login failed" },
      { status: 500 }
    )
  }
}
