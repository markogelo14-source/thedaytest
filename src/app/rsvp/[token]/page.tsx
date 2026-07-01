import { notFound } from "next/navigation";

import { RsvpForm } from "@/components/rsvp/rsvp-form";
import { getPublicRsvpSnapshot } from "@/lib/event-data";

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function RsvpPage({ params }: PageProps) {
  const { token } = await params;
  const snapshot = await getPublicRsvpSnapshot(token);

  if (!snapshot) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#1f1d1c] p-3 sm:p-5 md:p-6">
      <div className="min-h-[calc(100vh-24px)] bg-[#fffdfa] sm:min-h-[calc(100vh-40px)] md:min-h-[calc(100vh-48px)]">
        <RsvpForm initialData={snapshot} />
      </div>
    </div>
  );
}
