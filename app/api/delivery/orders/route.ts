
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/server"
import { verifyDriverSession } from "@/lib/delivery-session"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const driverId = verifyDriverSession(req)

    if (!driverId) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in again." },
        { status: 401 }
      )
    }

    const supabase = getSupabaseAdmin()

    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("delivery_boy_id", driverId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Delivery orders fetch failed:", error.message)
      return NextResponse.json(
        { error: "Unable to fetch orders" },
        { status: 500 }
      )
    }

    return NextResponse.json({ orders: orders || [] })
  } catch (error) {
    console.error("Delivery orders error:", error)
    return NextResponse.json(
      { error: "Unable to fetch delivery orders" },
      { status: 500 }
    )
  }
}
