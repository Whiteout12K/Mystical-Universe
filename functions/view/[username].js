import {
    getUser
} from "../_utils.js";


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


export async function onRequest(context) {

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

        return new Response(
            "User not found.",
            {
                status: 404
            }
        );

    }


    const data =
        JSON.parse(
            user.save_data
        );


    return new Response(`
<!DOCTYPE html>

<html>

<head>

    <meta charset="UTF-8">

    <title>
        ${escapeHtml(user.username)}
    </title>

</head>

<body>

    <h1>
        ${escapeHtml(user.username)}
    </h1>

    <pre>
${escapeHtml(
    JSON.stringify(
        data,
        null,
        2
    )
)}
    </pre>

</body>

</html>
`, {
        headers: {
            "Content-Type":
                "text/html; charset=UTF-8"
        }
    });
}