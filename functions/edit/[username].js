export async function onRequest(context) {

    const username =
        decodeURIComponent(
            context.params.username
        );


    return new Response(`
<!DOCTYPE html>

<html>

<head>

    <meta charset="UTF-8">

    <title>
        Edit ${escapeHtml(username)}
    </title>

</head>

<body>

    <h1>
        Edit ${escapeHtml(username)}
    </h1>


    <div id="login">

        <input
            id="password"
            type="password"
            maxlength="4"
            inputmode="numeric"
            placeholder="4 digit password"
        >

        <button id="unlock">
            Edit
        </button>

    </div>


    <div id="editor"
         style="display:none;">

        <textarea
            id="data"
            rows="25"
            cols="70"
        ></textarea>

        <br><br>

        <button id="save">
            Save
        </button>

        <p id="message"></p>

    </div>


<script>

const username =
    ${JSON.stringify(username)};


let password = "";


document
    .getElementById("unlock")
    .addEventListener(
        "click",
        async () => {

            password =
                document.getElementById(
                    "password"
                ).value;


            if (!/^\\\\d{4}$/.test(password)) {

                alert(
                    "Password must be 4 digits."
                );

                return;

            }


            const response =
                await fetch(
                    "/api/user/" +
                    encodeURIComponent(
                        username
                    ) +
                    "?password=" +
                    encodeURIComponent(
                        password
                    )
                );


            const result =
                await response.json();


            if (!response.ok) {

                alert(
                    result.error ||
                    "Invalid password."
                );

                return;

            }


            document.getElementById(
                "login"
            ).style.display =
                "none";


            document.getElementById(
                "editor"
            ).style.display =
                "block";


            document.getElementById(
                "data"
            ).value =
                JSON.stringify(
                    result.data,
                    null,
                    2
                );

        }
    );


document
    .getElementById("save")
    .addEventListener(
        "click",
        async () => {

            let data;


            try {

                data =
                    JSON.parse(
                        document.getElementById(
                            "data"
                        ).value
                    );

            } catch {

                document.getElementById(
                    "message"
                ).textContent =
                    "Invalid JSON.";

                return;

            }


            const response =
                await fetch(
                    "/api/user/" +
                    encodeURIComponent(
                        username
                    ),
                    {
                        method: "PUT",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            password,
                            data
                        })
                    }
                );


            const result =
                await response.json();


            document.getElementById(
                "message"
            ).textContent =
                response.ok
                    ? "Saved!"
                    : result.error;

        }
    );


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

</script>

</body>

</html>
`, {
        headers: {
            "Content-Type":
                "text/html; charset=UTF-8"
        }
    });
}