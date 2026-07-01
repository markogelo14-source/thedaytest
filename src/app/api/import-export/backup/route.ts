import { NextResponse } from "next/server";

import { assertAdminApiSession, unauthorizedJsonResponse } from "@/lib/auth";
import { getOrganizerSnapshot } from "@/lib/event-data";
import { getErrorMessage } from "@/lib/errors";

export async function GET() {
  try {
    await assertAdminApiSession();
    const snapshot = await getOrganizerSnapshot();

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="theday-backup.json"',
      },
    });
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
