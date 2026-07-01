import { NextResponse } from "next/server";

import { getPublicRsvpSnapshot, submitPublicRsvp } from "@/lib/event-data";
import { getErrorMessage } from "@/lib/errors";

interface RouteContext {
  params: Promise<{
    token: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const snapshot = await getPublicRsvpSnapshot(token);

  if (!snapshot) {
    return NextResponse.json(
      { error: "Pozivnica nije pronadena." },
      { status: 404 },
    );
  }

  return NextResponse.json(snapshot);
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = await request.json();
    await submitPublicRsvp(token, body);
    const snapshot = await getPublicRsvpSnapshot(token);

    if (!snapshot) {
      return NextResponse.json(
        { error: "Pozivnica nije pronadena." },
        { status: 404 },
      );
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 400 },
    );
  }
}
