import { NextResponse } from "next/server";

import { createAdminSession } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };

    await createAdminSession({
      username: body.username ?? "",
      password: body.password ?? "",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 401 },
    );
  }
}
