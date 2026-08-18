import {
    jsonResponse,
    getUser
} from "../_utils.js";


function getCookie(request, name) {

    const cookies =
        request.headers.get("Cookie") || "";


    for (
        const cookie of cookies.split(";")
    ) {

        const [key, ...value] =
            cookie.trim().split("=");


        if (key === name) {

            return decodeURIComponent(
                value.join("=")
            );

        }
    }


    return null;
}


export async function onRequestPost(context) {

    const { request, env } =
        context;


    const username =
        getCookie(
            request,
            "username"
        );


    if (!username) {

        return jsonResponse({
            success: false,
            error: "Not logged in."
        }, 401);

    }


    const user =
        await getUser(
            env,
            username
        );


    if (!user) {

        return jsonResponse({
            success: false,
            error: "User not found."
        }, 404);

    }


    const body =
        await request.json();


    const data =
        body.data;


    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {

        return jsonResponse({
            success: false,
            error:
                "Save data must be a JSON object."
        }, 400);

    }


    await env.DB
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