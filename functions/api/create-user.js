import { jsonResponse } from "../_utils.js";


/*
 * Shared function that actually creates the user.
 * Both GET and POST use this.
 */
async function createUser(env, username, password) {

    username = String(username || "").trim();
    password = String(password || "").trim();


    // Username required
    if (!username) {

        return jsonResponse({
            success: false,
            error: "Username is required."
        }, 400);

    }


    // Username characters
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {

        return jsonResponse({
            success: false,
            error:
                "Username may only contain letters, numbers, _ and -."
        }, 400);

    }


    // Username length
    if (username.length > 32) {

        return jsonResponse({
            success: false,
            error:
                "Username must be 32 characters or less."
        }, 400);

    }


    // Password must be exactly 4 digits
    if (!/^\d{4}$/.test(password)) {

        return jsonResponse({
            success: false,
            error:
                "Password must be exactly 4 digits."
        }, 400);

    }


    /*
     * Check if username already exists.
     */
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


    /*
     * Default save data for new users.
     */
    const initialData = {
        coin: 0,
        level: 1,
        xp: 0,
        health: 100,
        mana: 100,
        items: [],
        flags: {}
    };


    /*
     * Create the user.
     */
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
                JSON.stringify(initialData)
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


    /*
     * Successful creation.
     */
    return jsonResponse({

        success: true,

        message:
            "User created successfully.",

        username,

        data: initialData

    });

}


/*
 * EXISTING HTML FORM
 *
 * POST /api/create-user
 */
export async function onRequestPost(context) {

    const { request, env } = context;

    const body =
        await request.json();


    const username =
        body.username;


    const password =
        body.password;


    return createUser(
        env,
        username,
        password
    );

}


/*
 * LINK CREATION
 *
 * GET /api/create-user?username=avery&password=1234
 */
export async function onRequestGet(context) {

    const { request, env } = context;

    const url =
        new URL(request.url);


    const username =
        url.searchParams.get(
            "username"
        );


    const password =
        url.searchParams.get(
            "password"
        );


    return createUser(
        env,
        username,
        password
    );

}