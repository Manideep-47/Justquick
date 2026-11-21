
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const authClient = await getSupabaseServer()
    const { data: { user }, error: authError } = await authClient.auth.getUser()

    if (authError || user?.app_metadata?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const deliveryBoyId = String(body.delivery_boy_id || "").trim()

    if (!deliveryBoyId) {
      return NextResponse.json(
        { error: "delivery_boy_id required" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Verify the delivery partner exists
    const { data: driver, error: driverError } = await supabase
      .from("delivery_boys")
      .select("id, name")
      .eq("id", deliveryBoyId)
      .single()

    if (driverError || !driver) {
      return NextResponse.json(
        { error: "Delivery partner not found" },
        { status: 404 }
      )
    }

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, delivery_boy_id, timeline")
      .eq("id", id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.delivery_boy_id) {
      return NextResponse.json(
        { error: "Order already assigned" },
        { status: 409 }
      )
    }

    const timeline = Array.isArray(order.timeline) ? order.timeline : []

    // Conditional update prevents simultaneous duplicate assignments
    const { data, error } = await supabase
      .from("orders")
      .update({
        delivery_boy_id: driver.id,
        status: "ready",
        timeline: [
          ...timeline,
          {
            status: "ready",
            action: "Delivery Assigned",
            description: `Assigned to ${driver.name}`,
            timestamp: new Date().toISOString(),
            actor: "admin",
          },
        ],
      })
      .eq("id", id)
      .is("delivery_boy_id", null)
      .select()
      .maybeSingle()

    if (error) {
      console.error("Order assignment failed:", error.message)
      return NextResponse.json(
        { error: "Unable to assign delivery partner" },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: "Order was already assigned or changed" },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, order: data })
  } catch (error) {
    console.error("Order assignment error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
