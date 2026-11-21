
import { NextRequest } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"

const COOKIE_NAME = "jq_driver_session"
const SESSION_DURATION = 12 * 60 * 60

function getSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Server secret is not configured")
  return secret
}

export function createDriverSession(driverId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION
  const payload = `${driverId}.${expiresAt}`

  const signature = createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex")

  return {
    token: `${payload}.${signature}`,
    maxAge: SESSION_DURATION,
  }
}

export function verifyDriverSession(req: NextRequest): string | null {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null

  const parts = token.split(".")
  if (parts.length !== 3) return null

  const [driverId, expiryText, suppliedSignature] = parts
  const expiresAt = Number(expiryText)

  if (
    !driverId ||
    !/^\d+$/.test(expiryText) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return null
  }

  const payload = `${driverId}.${expiryText}`
  const expectedSignature = createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex")

  const supplied = Buffer.from(suppliedSignature, "hex")
  const expected = Buffer.from(expectedSignature, "hex")

  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null
  }

  return driverId
}

export { COOKIE_NAME, SESSION_DURATION }
