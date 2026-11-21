
import { NextResponse } from "next/server"
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server"
import { commissionFromDistanceKm, haversineKm } from "@/lib/geo"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const authClient = await getSupabaseServer()
    const { data: { user }, error: authError } =
      await authClient.auth.getUser()

    if (authError || user?.app_metadata?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()

    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, delivery_boy_id, shop_lat, shop_lng, buyer_lat, buyer_lng")
      .eq("status", "delivered")
      .not("delivery_boy_id", "is", null)

    if (error) {
      console.error("Commission order fetch failed:", error.message)
      return NextResponse.json({ error: "Unable to fetch delivered orders" }, { status: 500 })
    }

    let recalculated = 0

    for (const order of orders || []) {
      const coordinates = [
        order.shop_lat,
        order.shop_lng,
        order.buyer_lat,
        order.buyer_lng,
      ]

      if (!coordinates.every(
        (value) => typeof value === "number" && Number.isFinite(value)
      )) {
        continue
      }

      const km = haversineKm(
        { lat: order.shop_lat, lng: order.shop_lng },
        { lat: order.buyer_lat, lng: order.buyer_lng }
      )

      const amount = commissionFromDistanceKm(km)

      // Update the amount without changing paid_status.
      const { error: updateError } = await supabase
        .from("commissions")
        .update({ amount })
        .eq("order_id", order.id)

      if (updateError) {
        console.error("Commission update failed:", updateError.message)
        continue
      }

      recalculated++
    }

    return NextResponse.json({ ok: true, recalculated })
  } catch (error) {
    console.error("Commission recalculation error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
