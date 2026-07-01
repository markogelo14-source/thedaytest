import { OrganizerApp } from "@/components/organizer/organizer-app";
import { requireAdminPageSession } from "@/lib/auth";
import { getOrganizerSnapshot } from "@/lib/event-data";

export default async function Home() {
  await requireAdminPageSession();
  const snapshot = await getOrganizerSnapshot();
  return <OrganizerApp initialData={snapshot} />;
}
