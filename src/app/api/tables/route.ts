import { NextResponse } from "next/server";

import { assertAdminApiSession, unauthorizedJsonResponse } from "@/lib/auth";
import { createTable, getOrganizerSnapshot } from "@/lib/event-data";
import { getErrorMessage } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    await assertAdminApiSession();
    const body = await request.json();
    await createTable(body);
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
