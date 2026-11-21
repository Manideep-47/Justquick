
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/server"
import { verifyDriverSession } from "@/lib/delivery-session"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const driverId = verifyDriverSession(req)

    if (!driverId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const supabase = getSupabaseAdmin()

    const { data: driver, error } = await supabase
      .from("delivery_boys")
      .select("id, name, is_available, total_commission")
      .eq("id", driverId)
      .maybeSingle()

    if (error) {
      console.error("Driver profile lookup failed:", error.message)
      return NextResponse.json(
        { error: "Unable to fetch driver profile" },
        { status: 500 }
      )
    }

    if (!driver) {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ driver })
  } catch (error) {
    console.error("Driver profile error:", error)
    return NextResponse.json(
      { error: "Failed to fetch driver profile" },
      { status: 500 }
    )
  }
}
