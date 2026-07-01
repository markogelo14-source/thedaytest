import { requireGuestPageSession } from "@/lib/auth";

import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  await requireGuestPageSession();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(201,149,106,0.16),transparent_34%),linear-gradient(180deg,#fdfbf8_0%,#f6efe8_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[40px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(249,247,245,0.94))] p-8 shadow-[0_30px_90px_rgba(28,25,23,0.08)] sm:p-10">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Organizer Access
          </p>
          <h1 className="mt-6 font-display text-6xl leading-none text-[color:var(--foreground)] sm:text-7xl">
            TheDay
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-[color:var(--muted-foreground)] sm:text-lg">
            Siguran organizer pristup za upravljanje gostima, RSVP odgovorima i rasporedom sjedenja.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "Gosti",
                description: "Dodavanje, filtriranje, ručne RSVP izmjene i personalizirani linkovi.",
              },
              {
                title: "Stolovi",
                description: "Raspoređivanje stvarnih potvrđenih osoba i pregled slobodnih mjesta.",
              },
              {
                title: "Postavke",
                description: "Osnovni podaci događaja, import/export i deployment priprema.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(28,25,23,0.06)]"
              >
                <p className="font-display text-3xl text-[color:var(--foreground)]">
                  {item.title}
                </p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <SignInForm />
      </div>
    </div>
  );
}
