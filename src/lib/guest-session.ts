import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { readServerSupabaseEnv } from "@/lib/env";

export const GUEST_SESSION_COOKIE = "katamino_guest_id";

function createGuestId() {
  return crypto.randomUUID();
}

function signGuestId(guestId: string, secret: string) {
  return createHmac("sha256", secret).update(guestId).digest("hex");
}

function encodeGuestSession(guestId: string, secret: string) {
  return `${guestId}.${signGuestId(guestId, secret)}`;
}

export function verifyGuestSessionValue(value: string, secret: string) {
  const [guestId, signature] = value.split(".");

  if (!guestId || !signature) {
    return null;
  }

  const expectedSignature = signGuestId(guestId, secret);
  const givenSignature = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (givenSignature.length !== expectedSignatureBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(givenSignature, expectedSignatureBuffer)) {
    return null;
  }

  return guestId;
}

export async function getGuestSessionId() {
  const env = readServerSupabaseEnv();

  if (!env?.serviceRoleKey) {
    return null;
  }

  const cookieStore = await cookies();
  const rawValue = cookieStore.get(GUEST_SESSION_COOKIE)?.value;

  if (!rawValue) {
    return null;
  }

  return verifyGuestSessionValue(rawValue, env.serviceRoleKey);
}

export async function ensureGuestSessionId() {
  const env = readServerSupabaseEnv();

  if (!env?.serviceRoleKey) {
    return null;
  }

  const cookieStore = await cookies();
  const existingGuestId = await getGuestSessionId();

  if (existingGuestId) {
    return existingGuestId;
  }

  const nextGuestId = createGuestId();

  cookieStore.set(GUEST_SESSION_COOKIE, encodeGuestSession(nextGuestId, env.serviceRoleKey), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return nextGuestId;
}
