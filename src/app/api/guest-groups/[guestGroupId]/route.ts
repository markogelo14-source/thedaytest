import { NextResponse } from "next/server";

import { assertAdminApiSession, unauthorizedJsonResponse } from "@/lib/auth";
import {
  deleteGuestGroup,
  getOrganizerSnapshot,
  updateGuestGroupRsvp,
} from "@/lib/event-data";
import { getErrorMessage } from "@/lib/errors";

interface RouteContext {
  params: Promise<{
    guestGroupId: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await assertAdminApiSession();
    const body = await request.json();
    const { guestGroupId } = await context.params;
    await updateGuestGroupRsvp(guestGroupId, body);
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await assertAdminApiSession();
    const { guestGroupId } = await context.params;
    await deleteGuestGroup(guestGroupId);
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
