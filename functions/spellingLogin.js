import { neon } from "@neondatabase/serverless";
import { createSessionToken } from "./_shared/auth.js";

export async function onRequest(context) {
  try {
    if (!context.env.NEON_URL) {
      return Response.json(
        {
          success: false,
          error: "Database is not configured."
        },
        { status: 503 }
      );
    }

    if (!context.env.AUTH_SECRET) {
      return Response.json(
        {
          success: false,
          error: "Login is temporarily unavailable: AUTH_SECRET is not configured."
        },
        { status: 503 }
      );
    }

    const body = await context.request.json();

    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return Response.json(
        {
          success: false,
          error: "Username and password are required."
        },
        { status: 400 }
      );
    }

    const sql = neon(context.env.NEON_URL);

    const users = await sql`
      SELECT id, full_name, username, password, role
      FROM users
      WHERE username = ${username}
      LIMIT 1
    `;

    if (!users.length || users[0].password !== password) {
      return Response.json(
        {
          success: false,
          error: "Invalid username or password."
        },
        { status: 401 }
      );
    }

    const dbUser = users[0];

    if (!["teacher", "judge", "timekeeper"].includes(dbUser.role)) {
      return Response.json(
        {
          success: false,
          error: "This account does not have access to this system."
        },
        { status: 403 }
      );
    }

    const user = {
      id: dbUser.id,
      full_name: dbUser.full_name,
      username: dbUser.username,
      role: dbUser.role
    };

    const token = await createSessionToken(
      user,
      context.env.AUTH_SECRET
    );

    return Response.json({
      success: true,
      user,
      token,
      expires_in: 28800
    });

  } catch (error) {
    console.error(
      "Login failed:",
      error?.message || error
    );

    return Response.json(
      {
        success: false,
        error: "Unable to sign in. Please try again."
      },
      { status: 500 }
    );
  }
}
