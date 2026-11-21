
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/server"
import { verifyDriverSession } from "@/lib/delivery-session"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const driverId = verifyDriverSession(req)
    const { id } = await params

    if (!driverId || driverId !== id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await req.json()

    if (typeof body.is_available !== "boolean") {
      return NextResponse.json(
        { error: "Invalid availability value" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from("delivery_boys")
      .update({ is_available: body.is_available })
      .eq("id", driverId)
      .select("id, name, is_available")
      .single()

    if (error) {
      console.error("Availability update failed:", error.message)
      return NextResponse.json(
        { error: "Unable to update availability" },
        { status: 500 }
      )
    }

    return NextResponse.json({ delivery_boy: data })
  } catch (error) {
    console.error("Availability API error:", error)
    return NextResponse.json(
      { error: "Unable to update availability" },
      { status: 500 }
    )
  }
}
