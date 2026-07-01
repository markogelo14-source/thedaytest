import { notFound } from "next/navigation";
import { ChevronRight, Sparkles } from "lucide-react";

import { getEventLandingSnapshot } from "@/lib/event-data";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function EventLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const snapshot = await getEventLandingSnapshot(slug);

  if (!snapshot) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(201,149,106,0.18),transparent_30%),linear-gradient(180deg,#fdfbf8_0%,#f7f0e9_100%)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[40px] border border-white/70 bg-white/90 p-8 shadow-[0_30px_90px_rgba(28,25,23,0.08)] backdrop-blur sm:p-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-2 text-sm text-[color:var(--muted-foreground)]">
          <Sparkles size={16} />
          Stranica događaja
        </div>
        <h1 className="mt-8 font-display text-6xl leading-none text-[color:var(--foreground)] sm:text-7xl">
          {snapshot.event.name}
        </h1>
        <p className="mt-6 text-lg leading-8 text-[color:var(--muted-foreground)]">
          {snapshot.event.dateLabel} · {snapshot.event.venue}
        </p>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[30px] border border-[color:var(--border)] bg-[color:var(--panel)] p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
              Dobrodošli
            </p>
            <p className="mt-4 text-base leading-8 text-[color:var(--muted-foreground)]">
              Ako ste gost, za potvrdu dolaska koristite personalizirani RSVP link koji ste dobili uz pozivnicu.
              Organizator kroz taj link prati točan broj osoba koje dolaze, djecu, napomene i raspored sjedenja.
            </p>
          </div>

          <div className="rounded-[30px] border border-[color:var(--border)] bg-white p-6 shadow-[0_16px_40px_rgba(28,25,23,0.06)]">
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
              Kako odgovoriti
            </p>
            <div className="mt-4 space-y-3">
              {[
                "Otvorite personalizirani link iz svoje pozivnice.",
                "Odaberite dolazite li na događaj.",
                "Ako dolazite, upišite sve osobe koje dolaze s vama.",
                "Dodajte napomene poput alergija ili potreba za dječjom stolicom.",
              ].map((step) => (
                <div key={step} className="flex items-start gap-3 text-sm text-[color:var(--muted-foreground)]">
                  <ChevronRight size={16} className="mt-1 text-[color:var(--accent)]" />
                  <span className="leading-7">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
