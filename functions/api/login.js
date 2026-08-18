import { jsonResponse } from "../_utils.js";

export async function onRequestPost(context) {

    const { request, env } = context;

    const body = await request.json();

    const username =
        String(body.username || "").trim();

    const password =
        String(body.password || "").trim();

    if (!username || !password) {
        return jsonResponse({
            success: false,
            error: "Username and password are required."
        }, 400);
    }

    // Find the user using the username/password
    const user = await env.DB
        .prepare(`
            SELECT id, username
            FROM users
            WHERE username = ?
            AND password = ?
        `)
        .bind(username, password)
        .first();

    if (!user) {
        return jsonResponse({
            success: false,
            error: "Invalid username or password."
        }, 401);
    }

    // Generate a unique session ID
    const sessionId = crypto.randomUUID();

    // Save the session in D1
    await env.DB
        .prepare(`
            INSERT INTO sessions (
                id,
                user_id,
                created_at
            )
            VALUES (?, ?, ?)
        `)
        .bind(
            sessionId,
            user.id,
            Date.now()
        )
        .run();

    // Give the browser a persistent authentication cookie
    return new Response(
        JSON.stringify({
            success: true,
            username: user.username
        }),
        {
            headers: {
                "Content-Type": "application/json",

                "Set-Cookie":
                    `session_id=${encodeURIComponent(sessionId)}; ` +
                    `Path=/; ` +
                    `HttpOnly; ` +
                    `Secure; ` +
                    `SameSite=Lax`
            }
        }
    );
}