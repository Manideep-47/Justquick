
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/server"
import { verifyDriverSession } from "@/lib/delivery-session"
import { commissionFromDistanceKm, haversineKm } from "@/lib/geo"

export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const driverId = verifyDriverSession(req)

    if (!driverId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const otp = String(body.otp ?? "")

    if (!/^\d{4,6}$/.test(otp)) {
      return NextResponse.json({ error: "Enter a valid OTP" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    if (order.delivery_boy_id !== driverId) {
      return NextResponse.json(
        { error: "This order is not assigned to you" },
        { status: 403 }
      )
    }

    if (order.status !== "picked_up") {
      return NextResponse.json(
        { error: "Order must be picked up before delivery" },
        { status: 400 }
      )
    }

    if (String(order.otp) !== otp) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 })
    }

    const km = haversineKm(
      { lat: order.shop_lat, lng: order.shop_lng },
      { lat: order.buyer_lat, lng: order.buyer_lng }
    )

    const amount = commissionFromDistanceKm(km)
    const timeline = Array.isArray(order.timeline) ? order.timeline : []

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "delivered",
        timeline: [
          ...timeline,
          {
            action: "Delivery Completed",
            actor: "delivery_boy",
            status: "delivered",
            timestamp: new Date().toISOString(),
          },
        ],
      })
      .eq("id", id)
      .eq("delivery_boy_id", driverId)
      .eq("status", "picked_up")
      .select("id")
      .maybeSingle()

    if (updateError) {
      console.error("Order delivery update failed:", updateError.message)
      return NextResponse.json(
        { error: "Unable to update order" },
        { status: 500 }
      )
    }

    if (!updatedOrder) {
      return NextResponse.json(
        { error: "Order status changed. Please refresh and try again." },
        { status: 409 }
      )
    }

    const { error: commissionError } = await supabase
      .from("commissions")
      .insert({
        delivery_boy_id: driverId,
        order_id: id,
        amount,
        paid_status: "unpaid",
      })

    if (commissionError) {
      console.error("Commission creation failed:", commissionError.message)
      return NextResponse.json(
        { error: "Order delivered, but commission creation failed" },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, amount })
  } catch (error) {
    console.error("OTP verification error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
