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

    return new Response(
        JSON.stringify({
            success: true,
            username: user.username
        }),
        {
            headers: {
                "Content-Type": "application/json",

                "Set-Cookie":
                    `username=${encodeURIComponent(user.username)}; ` +
                    `Path=/; SameSite=Lax`
            }
        }
    );
}