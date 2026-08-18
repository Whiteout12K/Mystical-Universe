import { jsonResponse } from "../_utils.js";

export async function onRequestPost(context) {

    const { request, env } = context;

    const body =
        await request.json();


    const username =
        String(
            body.username || ""
        ).trim();


    const password =
        String(
            body.password || ""
        ).trim();


    if (!username) {

        return jsonResponse({
            success: false,
            error: "Username is required."
        }, 400);

    }


    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return jsonResponse({
            success: false,
            error:
                "Username may only contain letters, numbers, _ and -."
        }, 400);
    }


    if (!/^\d{4}$/.test(password)) {
        return jsonResponse({
            success: false,
            error:
                "Password must be exactly 4 digits."
        }, 400);
    }


    if (username.length > 32) {
        return jsonResponse({
            success: false,
            error:
                "Username must be 32 characters or less."
        }, 400);
    }


    // FIRST CHECK:
    // Does this username already exist?

    const existing =
        await env.DB
            .prepare(`
                SELECT id
                FROM users
                WHERE username = ?
            `)
            .bind(username)
            .first();


    if (existing) {

        return jsonResponse({
            success: false,
            error:
                "That username already exists."
        }, 409);

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

        await env.DB
            .prepare(`
                INSERT INTO users
                (
                    username,
                    password,
                    save_data
                )
                VALUES (?, ?, ?)
            `)
            .bind(
                username,
                password,
                JSON.stringify(
                    initialData
                )
            )
            .run();


    } catch (error) {

        /*
         * The UNIQUE constraint on username
         * provides a second layer of protection.
         */

        if (
            error.message
                ?.toLowerCase()
                .includes("unique")
        ) {

            return jsonResponse({
                success: false,
                error:
                    "That username already exists."
            }, 409);

        }


        console.error(error);

        return jsonResponse({
            success: false,
            error:
                "Could not create user."
        }, 500);

    }


    return jsonResponse({
        success: true,
        username,
        data: initialData
    });
}