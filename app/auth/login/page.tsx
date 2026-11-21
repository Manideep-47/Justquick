
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, Loader2, UserPlus, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), type: "login" }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.details || data.error || "Failed to send sign-in link")
      }

      setSent(true)
    } catch (err: any) {
      setError(err.message || "Unable to send sign-in link")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-white via-slate-50 to-slate-100">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-600 mb-4">
            <span className="text-white font-bold text-lg">Q</span>
          </div>
        </div>

        <Card className="border-slate-200 bg-white shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-slate-900">
              {sent ? "Check Your Email" : "Welcome Back"}
            </CardTitle>
            <p className="text-slate-600 mt-2">
              {sent
                ? "We've sent a sign-in link to:"
                : "Fast, safe delivery at your doorstep"}
            </p>
          </CardHeader>

          <CardContent>
            {sent ? (
              <div className="space-y-5 text-center">
                <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto" />
                <p className="font-semibold text-emerald-700 break-all">{email}</p>
                <p className="text-sm text-slate-600">
                  Open the latest email from JustQuick/Supabase and click its sign-in link.
                  You will be redirected back to JustQuick.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSent(false)}
                >
                  Back to Login
                </Button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSendLink} className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-2 block">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        className="pl-11 h-11"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-5 w-5 mr-2" />
                        Send Sign-in Link
                      </>
                    )}
                  </Button>
                </form>

                <div className="text-center mt-6 space-y-3">
                  <p className="text-sm text-slate-600">New to JustQuick?</p>
                  <Link href="/auth/register">
                    <Button variant="outline" className="w-full">
                      <UserPlus className="h-5 w-5 mr-2" />
                      Create Account
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
