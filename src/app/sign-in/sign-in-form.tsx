"use client";

import { useState, useTransition } from "react";
import { LockKeyhole, LogIn } from "lucide-react";

import { getErrorMessage } from "@/lib/errors";

export function SignInForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Prijava nije uspjela.");
        }

        window.location.href = "/";
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      }
    });
  }

  return (
    <section className="rounded-[40px] border border-white/70 bg-white/92 p-8 shadow-[0_30px_90px_rgba(28,25,23,0.08)] sm:p-10">
      <div className="inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--panel)] p-3 text-[color:var(--foreground)]">
        <LockKeyhole size={20} />
      </div>
      <h2 className="mt-6 font-display text-5xl text-[color:var(--foreground)]">
        Prijava
      </h2>
      <p className="mt-4 text-base leading-8 text-[color:var(--muted-foreground)]">
        Unesite organizer podatke za pristup administracijskom dijelu aplikacije.
      </p>

      <div className="mt-8 space-y-5">
        <label className="block">
          <span className="mb-3 block text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Korisničko ime
          </span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            className="w-full rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4 text-base outline-none transition focus:border-[color:var(--accent)]"
            placeholder="admin"
          />
        </label>

        <label className="block">
          <span className="mb-3 block text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Lozinka
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="w-full rounded-[24px] border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-4 text-base outline-none transition focus:border-[color:var(--accent)]"
            placeholder="••••••••"
          />
        </label>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!username.trim() || !password || isPending}
        onClick={submit}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--foreground)] px-6 py-4 text-base text-[color:var(--background)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <LogIn size={18} />
        {isPending ? "Prijavljujem..." : "Prijavi se"}
      </button>

      <p className="mt-5 text-sm leading-7 text-[color:var(--muted-foreground)]">
        Lokalno, bez dodatnih varijabli, možete se prijaviti s <code>admin</code> / <code>theday-demo</code>. U produkciji obavezno postavite vlastite vrijednosti.
      </p>
    </section>
  );
}
