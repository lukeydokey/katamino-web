import { cookies } from "next/headers";

export const GUEST_SESSION_COOKIE = "katamino_guest_id";

function createGuestId() {
  return crypto.randomUUID();
}

export async function getGuestSessionId() {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_SESSION_COOKIE)?.value ?? null;
}

export async function ensureGuestSessionId() {
  const cookieStore = await cookies();
  const existingGuestId = cookieStore.get(GUEST_SESSION_COOKIE)?.value;

  if (existingGuestId) {
    return existingGuestId;
  }

  const nextGuestId = createGuestId();

  cookieStore.set(GUEST_SESSION_COOKIE, nextGuestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return nextGuestId;
}
