import { NextResponse } from "next/server";

import { assertAdminApiSession, unauthorizedJsonResponse } from "@/lib/auth";
import {
  assignAttendeesToTable,
  deleteTable,
  getOrganizerSnapshot,
  removeAttendeeFromTable,
} from "@/lib/event-data";
import { getErrorMessage } from "@/lib/errors";

interface RouteContext {
  params: Promise<{
    tableId: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await assertAdminApiSession();
    const body = await request.json();
    const { tableId } = await context.params;

    if (body.action === "assignAttendees") {
      await assignAttendeesToTable(tableId, body.attendeeIds ?? []);
    } else if (body.action === "removeAttendee") {
      await removeAttendeeFromTable(tableId, body.attendeeId);
    } else {
      throw new Error("Nepoznata akcija za stol.");
    }

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
    const { tableId } = await context.params;
    await deleteTable(tableId);
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
