import { NextResponse } from "next/server";

import { assertAdminApiSession, unauthorizedJsonResponse } from "@/lib/auth";
import { getOrganizerSnapshot, updateEventSettings } from "@/lib/event-data";
import { getErrorMessage } from "@/lib/errors";

export async function GET() {
  try {
    await assertAdminApiSession();
  } catch {
    return unauthorizedJsonResponse();
  }

  const snapshot = await getOrganizerSnapshot();
  return NextResponse.json(snapshot);
}

export async function PUT(request: Request) {
  try {
    await assertAdminApiSession();
    const body = await request.json();
    await updateEventSettings(body);
    const snapshot = await getOrganizerSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return unauthorizedJsonResponse();
    }

    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
