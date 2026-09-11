import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin Sign In - Timetable Manager" },
      {
        name: "description",
        content:
          "Authorized admin sign-in to edit teacher timetables, mark leaves and assign substitute periods.",
      },
      { property: "og:title", content: "Admin Sign In - Timetable Manager" },
      {
        property: "og:description",
        content: "Admin access for editing schedules, leaves and substitutions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

// ── Allowlist ──────────────────────────────────────────────────────────────
// Only these two emails are permitted to sign in and make changes.
const ALLOWED_EMAILS: string[] = [
  (import.meta.env["VITE_ADMIN_EMAIL_1"] as string | undefined ?? "").toLowerCase().trim(),
  (import.meta.env["VITE_ADMIN_EMAIL_2"] as string | undefined ?? "").toLowerCase().trim(),
].filter(Boolean);

function isAllowed(email: string): boolean {
  return ALLOWED_EMAILS.includes(email.toLowerCase().trim());
}

// ──────────────────────────────────────────────────────────────────────────

type Mode = "signin" | "forgot" | "reset-sent";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // ── Sign In ──────────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      toast.error("Enter your email and password.");
      return;
    }
    if (!isAllowed(trimmed)) {
      toast.error("Access denied. This app is restricted to authorized admins only.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) throw error;
      toast.success("Signed in successfully");
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ── Forgot Password ──────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter your admin email address.");
      return;
    }
    if (!isAllowed(trimmed)) {
      toast.error("This email is not an authorized admin account.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setMode("reset-sent");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">

        {/* Header */}
        <div>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <span className="text-lg">🔐</span>
          </div>
          <h1 className="font-display text-xl font-bold">
            {mode === "forgot"
              ? "Reset password"
              : mode === "reset-sent"
              ? "Check your inbox"
              : "Admin sign in"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "forgot"
              ? "We'll send a reset link to your admin email."
              : mode === "reset-sent"
              ? `A password reset link has been sent to ${email}. Check your inbox (and spam folder).`
              : "Access is restricted to authorized admins only."}
          </p>
        </div>

        {/* ── Sign In form ── */}
        {mode === "signin" && (
          <>
            <Input
              type="email"
              placeholder="Admin email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
            />
            <Button className="w-full" onClick={handleSignIn} disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <button
              type="button"
              className="w-full text-xs text-muted-foreground underline hover:text-foreground transition-colors"
              onClick={() => {
                setPassword("");
                setMode("forgot");
              }}
            >
              Forgot password?
            </button>
          </>
        )}

        {/* ── Forgot Password form ── */}
        {mode === "forgot" && (
          <>
            <Input
              type="email"
              placeholder="Admin email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
            />
            <Button className="w-full" onClick={handleForgotPassword} disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
            <button
              type="button"
              className="w-full text-xs text-muted-foreground underline hover:text-foreground transition-colors"
              onClick={() => setMode("signin")}
            >
              Back to sign in
            </button>
          </>
        )}

        {/* ── Reset link sent confirmation ── */}
        {mode === "reset-sent" && (
          <>
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
              ✅ Reset link sent! Click the link in your email to set a new password, then sign in here.
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setMode("signin");
                setPassword("");
              }}
            >
              Back to sign in
            </Button>
          </>
        )}

        {/* Back to timetable (always visible) */}
        <button
          type="button"
          className="w-full text-xs text-muted-foreground underline hover:text-foreground transition-colors"
          onClick={() => navigate({ to: "/" })}
        >
          ← Back to timetable (view only)
        </button>
      </div>
    </main>
  );
}
