
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/server"
import { verifyDriverSession } from "@/lib/delivery-session"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const driverId = verifyDriverSession(request)

    if (!driverId) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in again." },
        { status: 401 }
      )
    }

    const { id } = await params
    const supabase = getSupabaseAdmin()

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, delivery_boy_id, timeline")
      .eq("id", id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    if (order.delivery_boy_id !== driverId) {
      return NextResponse.json(
        { error: "You are not assigned to deliver this order" },
        { status: 403 }
      )
    }

    if (order.status !== "ready") {
      return NextResponse.json(
        { error: `Order must be ready to pick up (current: ${order.status})` },
        { status: 400 }
      )
    }

    const timeline = Array.isArray(order.timeline) ? order.timeline : []

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "picked_up",
        timeline: [
          ...timeline,
          {
            status: "picked_up",
            action: "Order Picked Up",
            description: "Delivery partner has picked up the order",
            timestamp: new Date().toISOString(),
            actor: "delivery",
            actor_id: driverId,
            metadata: { otp_verified: false },
          },
        ],
      })
      .eq("id", id)
      .eq("delivery_boy_id", driverId)
      .eq("status", "ready")
      .select()
      .maybeSingle()

    if (updateError) {
      console.error("Pickup update failed:", updateError.message)
      return NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 }
      )
    }

    if (!updatedOrder) {
      return NextResponse.json(
        { error: "Order state changed. Refresh and try again." },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: "Order marked as picked up successfully",
    })
  } catch (error) {
    console.error("Pickup error:", error)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}
