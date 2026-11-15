import { jsonResponse } from "../_utils.js";
import { createPlayerSession, sameOrigin } from "../_player-session.js";

export async function onRequestPost(context) {

    const { request, env } = context;

    if (!sameOrigin(request)) return jsonResponse({success: false, error: "Use the same website to sign in."}, 403);

    const body = await request.json().catch(() => null);

    const username =
        String(body?.username || "").trim();

    const password =
        String(body?.password || "").trim();

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

    const headers = new Headers({"Content-Type": "application/json", "Cache-Control": "no-store"});
    headers.append("Set-Cookie", `username=${encodeURIComponent(user.username)}; Path=/; SameSite=Lax`);
    headers.append("Set-Cookie", await createPlayerSession(request, env, user.id));
    return new Response(JSON.stringify({success: true, username: user.username}), {headers});
}
