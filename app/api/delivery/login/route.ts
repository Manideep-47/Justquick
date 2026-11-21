
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/server"
import {
  createDriverSession,
  COOKIE_NAME,
} from "@/lib/delivery-session"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const loginCode = String(body.loginCode || "").trim()

    if (!/^\d{6}$/.test(loginCode)) {
      return NextResponse.json(
        { error: "Enter a valid 6-digit code" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    const { data: driver, error } = await supabase
      .from("delivery_boys")
      .select("id, name")
      .eq("login_code", loginCode)
      .maybeSingle()

    if (error) {
      console.error("Driver login lookup failed:", error.message)
      return NextResponse.json(
        { error: "Unable to verify login" },
        { status: 500 }
      )
    }

    if (!driver) {
      return NextResponse.json(
        { error: "Invalid delivery login code" },
        { status: 401 }
      )
    }

    const session = createDriverSession(driver.id)

    const response = NextResponse.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
      },
    })

    response.cookies.set(COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: session.maxAge,
    })

    return response
  } catch (error) {
    console.error("Driver login error:", error)
    return NextResponse.json(
      { error: "Driver login failed" },
      { status: 500 }
    )
  }
}
