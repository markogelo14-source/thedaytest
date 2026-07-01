import { NextResponse } from "next/server";

import { assertAdminApiSession, unauthorizedJsonResponse } from "@/lib/auth";
import {
  exportGuestGroupsToCsv,
  getOrganizerSnapshot,
  importGuestGroupsFromCsv,
} from "@/lib/event-data";
import { getErrorMessage } from "@/lib/errors";

export async function GET() {
  try {
    await assertAdminApiSession();
    const csv = await exportGuestGroupsToCsv();

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="theday-guests.csv"',
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

export async function POST(request: Request) {
  try {
    await assertAdminApiSession();
    const body = (await request.json()) as {
      csvText?: string;
      mode?: "append" | "replace";
    };

    const result = await importGuestGroupsFromCsv(
      body.csvText ?? "",
      body.mode === "replace" ? "replace" : "append",
    );
    const snapshot = await getOrganizerSnapshot();

    return NextResponse.json({
      ...snapshot,
      importSummary: result,
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
