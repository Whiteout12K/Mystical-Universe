import {readAccountPreferences} from "../../../_account.js";
import {
    jsonResponse,
    getUser
} from "../../../_utils.js";


export async function onRequestGet(context) {

    const username =
        decodeURIComponent(
            context.params.username
        );


    const user =
        await getUser(
            context.env,
            username
        );


    if (!user) {

        return jsonResponse({
            error: "User not found."
        }, 404);

    }


    let data;

    try {

        data =
            JSON.parse(
                user.save_data
            );

    } catch {

        data = {};

    }


    if(!data||typeof data!=="object"||Array.isArray(data))data={};
    const preferences=await readAccountPreferences(context.env,user);
    data.avatar=preferences.avatar;
    data.bg=preferences.background;
    const response=jsonResponse({username,data});
    response.headers.set("Cache-Control","no-store");
    return response;
}


export async function onRequestPut(context) {

    const username =
        decodeURIComponent(
            context.params.username
        );


    const user =
        await getUser(
            context.env,
            username
        );


    if (!user) {

        return jsonResponse({
            error: "User not found."
        }, 404);

    }


    const body =
        await context.request.json();


    const password =
        String(
            body.password || ""
        ).trim();


    if (
        password !==
        user.password
    ) {

        return jsonResponse({
            error: "Invalid password."
        }, 401);

    }


    const data =
        body.data;


    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {

        return jsonResponse({
            error:
                "Data must be a JSON object."
        }, 400);

    }


    await context.env.DB
        .prepare(`
            UPDATE users
            SET
                save_data = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `)
        .bind(
            JSON.stringify(data),
            user.id
        )
        .run();


    return jsonResponse({
        success: true,
        data
    });
}