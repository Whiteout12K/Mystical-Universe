import { jsonResponse } from "../_utils.js";
import {createInitialData, registrationError} from "../../data/player-registration.mjs";

const REGISTRATION_LIMIT = 3;
const REGISTRATION_WINDOW = 15 * 60;

async function checkRegistrationLimit(env, deviceId) {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - REGISTRATION_WINDOW;

    const row = await env.DB
        .prepare(
            `SELECT window_start, account_count
             FROM registration_limits
             WHERE ip = ?`
        )
        .bind(deviceId)
        .first();

    if (!row) {
        await env.DB
            .prepare(
                `INSERT INTO registration_limits
                 (ip, window_start, account_count)
                 VALUES (?, ?, 1)`
            )
            .bind(deviceId, now)
            .run();

        return true;
    }

    if (row.window_start <= windowStart) {
        await env.DB
            .prepare(
                `UPDATE registration_limits
                 SET window_start = ?, account_count = 1
                 WHERE ip = ?`
            )
            .bind(now, deviceId)
            .run();

        return true;
    }

    if (row.account_count >= REGISTRATION_LIMIT) {
        return false;
    }

    await env.DB
        .prepare(
            `UPDATE registration_limits
             SET account_count = account_count + 1
             WHERE ip = ?`
        )
        .bind(deviceId)
        .run();

    return true;
}

function getDeviceId(request) {
    const cookie = request.headers.get("Cookie") || "";

    const match = cookie.match(
        /(?:^|;\s*)registration_id=([^;]+)/
    );

    if (!match) {
        return null;
    }

    try {
        return decodeURIComponent(match[1]);
    } catch {
        return null;
    }
}

function createDeviceId() {
    return crypto.randomUUID();
}




async function createUser(env, username, password, deviceId) {
    username = String(username ?? "").trim();
    password = String(password ?? "").trim();

    const validationError = registrationError(username, password);
    if (validationError) return jsonResponse({success: false, error: validationError}, 400);

    // Check whether username already exists
    const existing = await env.DB
        .prepare(
            "SELECT id FROM users WHERE username = ? LIMIT 1"
        )
        .bind(username)
        .first();

    if (existing) {
        return jsonResponse({
            success: false,
            error: "That username already exists."
        }, 409);
    }

    // Check registration limit
    const allowed = await checkRegistrationLimit(
        env,
        deviceId
    );

    if (!allowed) {
        return jsonResponse({
            success: false,
            error:
                "You have created a maximum of 3 accounts. Please try again in 15 minutes."
        }, 429);
    }

    // Create initial account data
    const initialData = createInitialData();
    const saveData = JSON.stringify(initialData);

    try {
        // Create user in database
        await env.DB
            .prepare(
                `INSERT INTO users
                 (username, password, save_data)
                 VALUES (?, ?, ?)`
            )
            .bind(
                username,
                password,
                saveData
            )
            .run();

    } catch (error) {
        console.error("Create user error:", error);

        // Handle username collision caused by simultaneous requests
        if (
            error?.message
                ?.toLowerCase()
                .includes("unique")
        ) {
            return jsonResponse({
                success: false,
                error: "That username already exists."
            }, 409);
        }

        return jsonResponse({
            success: false,
            error: "Could not create user."
        }, 500);
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

    try {
        let body;

        // Read request body
        try {
            body = await request.json();
        } catch {
            return jsonResponse({
                success: false,
                error: "Invalid request."
            }, 400);
        }

        // Make sure request body is an object
        if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body)
        ) {
            return jsonResponse({
                success: false,
                error: "Invalid request."
            }, 400);
        }

        // Get existing device ID
        let deviceId = getDeviceId(request);
        let newDevice = false;

        // Create device ID if one does not exist
        if (!deviceId) {
            deviceId = createDeviceId();
            newDevice = true;
        }

        // Create user
        const response = await createUser(
            env,
            body.username,
            body.password,
            deviceId
        );

        // Set registration cookie for new devices
        if (newDevice) {
            response.headers.append(
                "Set-Cookie",
                `registration_id=${encodeURIComponent(deviceId)}; ` +
                "Max-Age=31536000; " +
                "Path=/; " +
                "SameSite=Lax; " +
                "HttpOnly; " +
                "Secure"
            );
        }

        return response;

    } catch (error) {
        console.error(
            "Create-user request error:",
            error
        );

        return jsonResponse({
            success: false,
            error: "Server error."
        }, 500);
    }
}