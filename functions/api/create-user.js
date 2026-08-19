import { jsonResponse } from "../_utils.js";

const REGISTRATION_LIMIT = 3;
const REGISTRATION_WINDOW = 15 * 60;

async function checkRegistrationLimit(env, ip) {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - REGISTRATION_WINDOW;

    const row = await env.DB.prepare("SELECT window_start, account_count FROM registration_limits WHERE ip = ?").bind(ip).first();

    if (!row) {
        await env.DB.prepare("INSERT INTO registration_limits (ip, window_start, account_count) VALUES (?, ?, 1)").bind(ip, now).run();
        return true;
    }

    if (row.window_start <= windowStart) {
        await env.DB.prepare("UPDATE registration_limits SET window_start = ?, account_count = 1 WHERE ip = ?").bind(now, ip).run();
        return true;
    }

    if (row.account_count >= REGISTRATION_LIMIT) {
        return false;
    }

    await env.DB.prepare("UPDATE registration_limits SET account_count = account_count + 1 WHERE ip = ?").bind(ip).run();

    return true;
}

async function createUser(env, username, password, ip) {
    username = String(username || "").trim();
    password = String(password || "").trim();

    if (!username) {
        return jsonResponse({ success: false, error: "Username is required." }, 400);
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return jsonResponse({ success: false, error: "Username may only contain letters, numbers, _ and -." }, 400);
    }

    if (username.length > 32) {
        return jsonResponse({ success: false, error: "Username must be 32 characters or less." }, 400);
    }

    if (!/^\d{4}$/.test(password)) {
        return jsonResponse({ success: false, error: "Password must be exactly 4 digits." }, 400);
    }

    const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();

    if (existing) {
        return jsonResponse({ success: false, error: "That username already exists." }, 409);
    }

    const allowed = await checkRegistrationLimit(env, ip);

    if (!allowed) {
        return jsonResponse({ success: false, error: "Too many accounts created. Please try again in 15 minutes." }, 429);
    }

    const initialData = {
        coin: 0,
        level: 1,
        xp: 0,
        health: 100,
        mana: 100,
        items: [],
        flags: {}
    };

    try {
        await env.DB.prepare("INSERT INTO users (username, password, save_data) VALUES (?, ?, ?)").bind(username, password, JSON.stringify(initialData)).run();
    } catch (error) {
        console.error("Create user error:", error);

        if (error.message?.toLowerCase().includes("unique")) {
            return jsonResponse({ success: false, error: "That username already exists." }, 409);
        }

        return jsonResponse({ success: false, error: "Could not create user." }, 500);
    }

    return jsonResponse({
        success: true,
        message: "User created successfully.",
        username,
        data: initialData
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;

    let body;

    try {
        body = await request.json();
    } catch {
        return jsonResponse({ success: false, error: "Invalid request." }, 400);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    return createUser(env, body.username, body.password, ip);
}