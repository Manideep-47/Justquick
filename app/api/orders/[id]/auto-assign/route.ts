
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest) {
  try {
    const authClient = await getSupabaseServer()
    const { data: { user }, error: authError } =
      await authClient.auth.getUser()

    if (authError || user?.app_metadata?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, status, delivery_boy_id, timeline")
      .in("status", ["accepted", "ready"])
      .is("delivery_boy_id", null)

    if (ordersError) {
      console.error("Auto-assign order fetch failed:", ordersError.message)
      return NextResponse.json({ error: "Unable to fetch orders" }, { status: 500 })
    }

    if (!orders?.length) {
      return NextResponse.json({ ok: true, assigned: 0 })
    }

    const { data: drivers, error: driversError } = await supabase
      .from("delivery_boys")
      .select("id")
      .eq("is_available", true)

    if (driversError) {
      console.error("Auto-assign driver fetch failed:", driversError.message)
      return NextResponse.json({ error: "Unable to fetch drivers" }, { status: 500 })
    }

    if (!drivers?.length) {
      return NextResponse.json({ ok: true, assigned: 0 })
    }

    let assigned = 0

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i]
      const driver = drivers[i % drivers.length]
      const timeline = Array.isArray(order.timeline) ? order.timeline : []

      const { data, error } = await supabase
        .from("orders")
        .update({
          delivery_boy_id: driver.id,

          timeline: [
            ...timeline,
            {
              action: "Delivery Assigned",
              actor: "admin",
              status: "ready",
              timestamp: new Date().toISOString(),
              metadata: { driver_id: driver.id },
            },
          ],
        })
        .eq("id", order.id)
        .in("status", ["accepted", "ready"])
        .is("delivery_boy_id", null)
        .select("id")
        .maybeSingle()

      if (error) {
        console.error("Auto-assign update failed:", error.message)
        continue
      }

      if (data) assigned++
    }

    return NextResponse.json({ ok: true, assigned })
  } catch (error) {
    console.error("Auto-assign error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
