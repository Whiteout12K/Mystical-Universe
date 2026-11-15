import {accountUsername} from "./_account.js";

const cookieName = "jscratch_session";
const lifetimeSeconds = 60 * 60 * 24 * 30;

export async function digest(value) {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

function sessionToken(request) {
    const entry = (request.headers.get("Cookie") || "").split(";")
        .map(part => part.trim()).find(part => part.startsWith(cookieName + "="));
    const token = entry?.slice(cookieName.length + 1);
    return /^[0-9a-f-]{36}$/.test(token ?? "") ? token : null;
}

function sessionCookie(request, value, seconds) {
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure}`;
}

export function sameOrigin(request) {
    const origin = request.headers.get("Origin");
    return !origin || origin === new URL(request.url).origin;
}

export async function createPlayerSession(request, env, userId) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS jscratch_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
    )`).run();
    const token = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const current = sessionToken(request);
    await env.DB.prepare("DELETE FROM jscratch_sessions WHERE expires_at <= ? OR token_hash = ?")
        .bind(now, current ? await digest(current) : "").run();
    await env.DB.prepare("INSERT INTO jscratch_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
        .bind(await digest(token), userId, now + lifetimeSeconds).run();
    return sessionCookie(request, token, lifetimeSeconds);
}

export async function deletePlayerSession(request, env) {
    const token = sessionToken(request);
    if (token && env.DB) {
        await env.DB.prepare("DELETE FROM jscratch_sessions WHERE token_hash = ?").bind(await digest(token)).run();
    }
    return sessionCookie(request, "", 0);
}

export async function currentPlayerUser(request, env) {
    const token = sessionToken(request);
    if (!token) return null;
    return env.DB.prepare(`SELECT users.id, users.username, users.save_data FROM jscratch_sessions
        JOIN users ON users.id = jscratch_sessions.user_id
        WHERE token_hash = ? AND expires_at > ? AND users.username = ?`)
        .bind(await digest(token), Math.floor(Date.now() / 1000), accountUsername(request)).first();
}

export function playerResponse(payload, status = 200) {
    return Response.json(payload, {status, headers: {"Cache-Control": "no-store", Vary: "Cookie"}});
}
