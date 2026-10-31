const encoder = new TextEncoder();

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64url(value) {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - value.length % 4) % 4);

  const binary = atob(padded);

  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function signingKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(user, secret) {
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured.");
  }

  const now = Math.floor(Date.now() / 1000);

  const header = base64url(
    encoder.encode(
      JSON.stringify({ alg: "HS256", typ: "JWT" })
    )
  );

  const payload = base64url(
    encoder.encode(
      JSON.stringify({
        sub: String(user.id),
        username: user.username,
        role: user.role,
        iat: now,
        exp: now + 8 * 60 * 60
      })
    )
  );

  const unsigned = `${header}.${payload}`;

  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    encoder.encode(unsigned)
  );

  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || !secret) return null;

  try {
    const parts = token.split(".");

    if (parts.length !== 3) return null;

    const unsigned = `${parts[0]}.${parts[1]}`;

    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      decodeBase64url(parts[2]),
      encoder.encode(unsigned)
    );

    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(
        decodeBase64url(parts[1])
      )
    );

    const now = Math.floor(Date.now() / 1000);

    if (
      !payload.sub ||
      !payload.role ||
      !payload.exp ||
      payload.exp <= now
    ) {
      return null;
    }

    return payload;

  } catch {
    return null;
  }
}
