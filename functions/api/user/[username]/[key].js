import {
    jsonResponse,
    getUser
} from "../../../_utils.js";


export async function onRequestGet(context) {

    const username =
        decodeURIComponent(
            context.params.username
        );

    const key =
        decodeURIComponent(
            context.params.key
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

        return jsonResponse({
            error: "Invalid save data."
        }, 500);

    }


    if (
        !Object.prototype.hasOwnProperty
            .call(data, key)
    ) {

        return jsonResponse({
            error:
                `Save field "${key}" does not exist.`
        }, 404);

    }


    return jsonResponse({
        username,
        key,
        value: data[key]
    });
}