
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server"
import { verifyDriverSession } from "@/lib/delivery-session"

export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const driverId = verifyDriverSession(req)

    const supabaseAuth = await getSupabaseServer()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    const isAdmin = user?.app_metadata?.role === "admin"

    if (!isAdmin && driverId !== id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from("delivery_boys")
      .select("id, name, contact, total_commission, is_available")
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: "Delivery partner not found" }, { status: 404 })
    }

    return NextResponse.json({ delivery_boy: data })
  } catch (error) {
    console.error("Delivery partner GET error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseAuth = await getSupabaseServer()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    if (user?.app_metadata?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { id } = await params
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from("delivery_boys")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Delivery partner deletion failed:", error.message)
      return NextResponse.json({ error: "Unable to delete delivery partner" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delivery partner DELETE error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
