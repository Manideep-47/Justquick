
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { createHmac, timingSafeEqual } from "crypto"

export const dynamic = "force-dynamic"

const VENDOR_COOKIE = "jq_vendor_session"

function verifyVendorSession(token: string | undefined) {
  if (!token) return null

  const parts = token.split(".")
  if (parts.length !== 2) return null

  const [shopId, suppliedSignature] = parts

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !shopId || !suppliedSignature) return null

  const expectedSignature = createHmac("sha256", secret)
    .update(shopId)
    .digest("hex")

  const supplied = Buffer.from(suppliedSignature, "hex")
  const expected = Buffer.from(expectedSignature, "hex")

  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null
  }

  return shopId
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { status, reason } = body

    if (!id || !status) {
      return NextResponse.json(
        { error: "Order ID and status are required" },
        { status: 400 }
      )
    }

    const allowedStatuses = ["accepted", "rejected", "ready"]

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Allowed: accepted, rejected, ready" },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch {
              // Cookies may not be writable in this context.
            }
          },
        },
      }
    )

    // Check whether the requester is an authenticated admin.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isAdmin = user?.app_metadata?.role === "admin"


    // Otherwise, check the signed vendor session cookie.
    const vendorShopId = verifyVendorSession(
      cookieStore.get(VENDOR_COOKIE)?.value
    )

    if (!isAdmin && !vendorShopId) {
      return NextResponse.json(
        { error: "Authentication required. Please log in again." },
        { status: 401 }
      )
    }

    // Use the service role only on the server, after authorization.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Fetch the order.
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (orderError) {
      console.error("Order lookup failed:", orderError)
      return NextResponse.json(
        { error: "Could not retrieve order" },
        { status: 500 }
      )
    }

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // A vendor can only update orders belonging to their own shop.
    if (!isAdmin && order.shop_id !== vendorShopId) {
      return NextResponse.json(
        { error: "You are not authorized to update this order" },
        { status: 403 }
      )
    }

    // Only admins or the order's own vendor can use this route.
    const currentStatus = order.status

    const validTransitions: Record<string, string[]> = {
      pending: ["accepted", "rejected"],
      accepted: ["ready"],
      ready: [],
    }

    const allowedNextStatuses = validTransitions[currentStatus] || []

    if (!allowedNextStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: "Invalid status transition",
          details: `Cannot change order from ${currentStatus} to ${status}`,
        },
        { status: 400 }
      )
    }

    const actorType = isAdmin ? "admin" : "vendor"
    const actorId = isAdmin ? user!.id : vendorShopId

    const actorName = isAdmin
      ? user!.user_metadata?.name || "Admin"
      : "Shop Vendor"

    let action = ""
    let description = ""

    switch (status) {
      case "accepted":
        action = "Order Accepted"
        description = "Shop has accepted the order and started preparing"
        break

      case "rejected":
        action = "Order Rejected"
        description = reason || "Shop has rejected the order"
        break

      case "ready":
        action = "Order Ready"
        description = "Order is ready for pickup"
        break
    }

    const timelineEntry = {
      status,
      action,
      description,
      timestamp: new Date().toISOString(),
      actor: actorType,
      actor_id: actorId,
      actor_name: actorName,
    }

    const existingTimeline = Array.isArray(order.timeline)
      ? order.timeline
      : []

    const { data: updatedOrder, error: updateError } = await adminClient
      .from("orders")
      .update({
        status,
        timeline: [...existingTimeline, timelineEntry],
      })
      .eq("id", id)
      .eq("status", currentStatus)
      .select()
      .single()

    if (updateError) {
      console.error("Order status update failed:", updateError)
      return NextResponse.json(
        { error: "Failed to update order status" },
        { status: 500 }
      )
    }

    console.log(
      `${actorType} updated order ${id}: ${currentStatus} -> ${status}`
    )

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Order status updated to ${status}`,
    })
  } catch (error) {
    console.error("Status update error:", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
