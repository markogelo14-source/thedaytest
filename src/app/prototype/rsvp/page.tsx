import { RsvpForm } from "@/components/rsvp/rsvp-form";
import type { PublicRsvpSnapshot } from "@/lib/types";

const demoSnapshot: PublicRsvpSnapshot = {
  event: {
    id: "demo-event",
    slug: "demo-rsvp",
    name: "Marko & Lucija",
    venue: "Lauba, Zagreb",
    date: "2026-09-01",
    dateLabel: "1. rujna 2026.",
    rsvpBasePath: "/prototype/rsvp",
  },
  guestGroup: {
    id: "demo-guest-group",
    name: "Marko Gelo",
    maxPeople: 4,
    contact: null,
    status: "confirmed",
    note: null,
    shareToken: "demo-token",
    createdAt: "2026-06-30T00:00:00.000Z",
    updatedAt: "2026-06-30T00:00:00.000Z",
    attendees: [],
    rsvpPath: "/prototype/rsvp",
  },
};

export default function PrototypeRsvpPage() {
  return (
    <div className="min-h-screen bg-[#1f1d1c] p-3 sm:p-5 md:p-6">
      <div className="min-h-[calc(100vh-24px)] bg-[#fffdfa] sm:min-h-[calc(100vh-40px)] md:min-h-[calc(100vh-48px)]">
        <RsvpForm initialData={demoSnapshot} mode="demo" showPresets />
      </div>
    </div>
  );
}
