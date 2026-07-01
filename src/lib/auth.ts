import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

const COOKIE_NAME = "theday_admin_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

interface SessionPayload {
  username: string;
  exp: number;
}

function getBaseUrlSafeValue(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBaseUrlSafeValue(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getAuthConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const username = process.env.ADMIN_USERNAME ?? (isProduction ? undefined : "admin");
  const password = process.env.ADMIN_PASSWORD ?? (isProduction ? undefined : "theday-demo");
  const sessionSecret =
    process.env.SESSION_SECRET ??
    (isProduction ? undefined : "theday-dev-session-secret-change-me");

  if (!username || !password || !sessionSecret) {
    throw new Error(
      "ADMIN_USERNAME, ADMIN_PASSWORD i SESSION_SECRET moraju biti postavljeni.",
    );
  }

  return { username, password, sessionSecret };
}

function signValue(payload: string) {
  const { sessionSecret } = getAuthConfig();
  return createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

function createToken(username: string) {
  const payload: SessionPayload = {
    username,
    exp: Date.now() + SESSION_DURATION_MS,
  };
  const encodedPayload = getBaseUrlSafeValue(JSON.stringify(payload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token: string | undefined): SessionPayload | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBaseUrlSafeValue(encodedPayload)) as SessionPayload;

    if (!parsed.username || typeof parsed.exp !== "number" || parsed.exp < Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifyToken(cookieStore.get(COOKIE_NAME)?.value) !== null;
}

export async function requireAdminPageSession() {
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    redirect("/sign-in");
  }
}

export async function requireGuestPageSession() {
  const isAuthenticated = await isAdminAuthenticated();

  if (isAuthenticated) {
    redirect("/");
  }
}

export async function assertAdminApiSession() {
  const isAuthenticated = await isAdminAuthenticated();

  if (!isAuthenticated) {
    throw new Error("UNAUTHORIZED");
  }
}

export async function createAdminSession(input: {
  username: string;
  password: string;
}) {
  const { username, password } = getAuthConfig();

  const usernameOk = safeEquals(input.username.trim(), username);
  const passwordOk = safeEquals(input.password, password);

  if (!usernameOk || !passwordOk) {
    throw new Error("Neispravno korisnicko ime ili lozinka.");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createToken(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function unauthorizedJsonResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
