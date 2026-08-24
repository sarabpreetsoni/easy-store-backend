import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In - Timetable Manager" },
      {
        name: "description",
        content:
          "Sign in to edit teacher timetables, mark leaves and assign substitute periods in Timetable Manager.",
      },
      { property: "og:title", content: "Staff Sign In - Timetable Manager" },
      {
        property: "og:description",
        content: "Staff access for editing schedules, leaves and substitutions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      toast.error("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("Signed in");
        navigate({ to: "/" });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <h1 className="font-display text-xl font-bold">Staff sign in</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Anyone can view the timetable. Sign in to make changes.
          </p>
        </div>
        <Input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button className="w-full" onClick={submit} disabled={busy}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </Button>
        <button
          type="button"
          className="w-full text-xs text-muted-foreground underline"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "Need an account? Sign up"}
        </button>
        <button
          type="button"
          className="w-full text-xs text-muted-foreground underline"
          onClick={() => navigate({ to: "/" })}
        >
          Back to timetable
        </button>
      </div>
    </main>
  );
}
