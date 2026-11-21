
import { NextResponse } from "next/server"
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server"
import { generateLoginCode } from "@/lib/utils/generate-code"

export const dynamic = "force-dynamic"

async function isAdmin() {
  const supabase = await getSupabaseServer()
  const { data: { user }, error } = await supabase.auth.getUser()

  return !error && user?.app_metadata?.role === "admin"
}

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from("delivery_boys")
      .select("id, name, contact, total_commission, is_available")
      .order("name")

    if (error) {
      console.error("Delivery partner list failed:", error.message)
      return NextResponse.json({ error: "Unable to fetch delivery partners" }, { status: 500 })
    }

    return NextResponse.json({ delivery_boys: data || [] })
  } catch (error) {
    console.error("Delivery partner GET error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const payload = await req.json()
    const name = String(payload.name || "").trim()
    const contact = String(payload.contact || "").trim()

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    let loginCode = ""
    let uniqueCodeFound = false

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateLoginCode()

      const { data: existing, error: lookupError } = await supabase
        .from("delivery_boys")
        .select("id")
        .eq("login_code", candidate)
        .maybeSingle()

      if (lookupError) {
        console.error("Login code lookup failed:", lookupError.message)
        return NextResponse.json({ error: "Unable to generate login code" }, { status: 500 })
      }

      if (!existing) {
        loginCode = candidate
        uniqueCodeFound = true
        break
      }
    }

    if (!uniqueCodeFound) {
      return NextResponse.json({ error: "Could not generate a unique login code" }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("delivery_boys")
      .insert({
        name,
        contact: contact || null,
        total_commission: 0,
        login_code: loginCode,
        is_available: false,
      })
      .select("id, name, contact, total_commission, is_available, login_code")
      .single()

    if (error) {
      console.error("Delivery partner creation failed:", error.message)
      return NextResponse.json({ error: "Unable to register delivery partner" }, { status: 500 })
    }

    return NextResponse.json({ delivery_boy: data })
  } catch (error) {
    console.error("Delivery partner POST error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
