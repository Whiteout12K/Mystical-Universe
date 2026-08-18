export async function onRequest() {

    return new Response(`
<!DOCTYPE html>

<html>

<head>

    <meta charset="UTF-8">

    <title>Dashboard</title>

</head>

<body>

    <h1>Dashboard</h1>

    <p>
        Logged in as:
        <strong id="username"></strong>
    </p>

    <h2>Your Save</h2>

    <textarea
        id="saveData"
        rows="20"
        cols="60"
    ></textarea>

    <br><br>

    <button id="save">
        Save
    </button>

    <button id="logout">
        Logout
    </button>

    <p id="message"></p>


<script>

async function load() {

    const response =
        await fetch("/api/me");

    if (!response.ok) {

        window.location.href =
            "/login.html";

        return;

    }


    const user =
        await response.json();


    document.getElementById(
        "username"
    ).textContent =
        user.username;


    const saveResponse =
        await fetch(
            "/api/user/" +
            encodeURIComponent(
                user.username
            )
        );


    const save =
        await saveResponse.json();


    document.getElementById(
        "saveData"
    ).value =
        JSON.stringify(
            save.data,
            null,
            2
        );
}


document
    .getElementById("save")
    .addEventListener(
        "click",
        async () => {

            const username =
                document.getElementById(
                    "username"
                ).textContent;


            const raw =
                document.getElementById(
                    "saveData"
                ).value;


            let data;


            try {

                data =
                    JSON.parse(raw);

            } catch {

                document.getElementById(
                    "message"
                ).textContent =
                    "Invalid JSON.";

                return;

            }


            const response =
                await fetch(
                    "/api/save",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            username,
                            data
                        })
                    }
                );


            const result =
                await response.json();


            document.getElementById(
                "message"
            ).textContent =
                result.success
                    ? "Saved!"
                    : result.error;

        }
    );


document
    .getElementById("logout")
    .addEventListener(
        "click",
        async () => {

            await fetch(
                "/api/logout",
                {
                    method: "POST"
                }
            );

            window.location.href =
                "/login.html";

        }
    );


load();

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