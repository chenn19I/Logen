import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  CHALLENGE_COOKIE_NAME,
  ChallengeCookiePayload,
  LOUNGE_RECIPIENT,
  signHmacToken,
} from "@/lib/gate/session";

export async function POST() {
  const nonceBytes = crypto.randomBytes(32);
  const nonceHex = nonceBytes.toString("hex");
  const nonceBase64 = nonceBytes.toString("base64");
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + 5 * 60 * 1000; // 5 minutes TTL
  const message = `Logen Kraton Lounge Authentication · Issued ${new Date(
    issuedAtMs
  ).toISOString()}`;

  const payload: ChallengeCookiePayload = {
    nonceHex,
    recipient: LOUNGE_RECIPIENT,
    message,
    issuedAtMs,
    expiresAtMs,
  };

  const challengeToken = signHmacToken(payload);

  const res = NextResponse.json({
    nonceBase64,
    nonceHex,
    recipient: LOUNGE_RECIPIENT,
    message,
    issuedAtMs,
    expiresAtMs,
    challengeToken,
  });

  res.cookies.set(CHALLENGE_COOKIE_NAME, challengeToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });

  return res;
}
