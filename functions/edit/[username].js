export async function onRequest(context) {

    const username =
        decodeURIComponent(
            context.params.username
        );

    const url =
        new URL(
            context.request.url
        );

    const password =
        url.searchParams.get(
            "password"
        );


    /*
     * ============================================================
     * DIRECT LINK EDITING
     *
     * Example:
     *
     * /edit/avery?password=1234&coin=500
     *
     * Sets coin to 500.
     *
     *
     * Example:
     *
     * /edit/avery?password=1234&coin_add=500
     *
     * Adds 500 to the existing coin value.
     *
     *
     * Example:
     *
     * /edit/avery?password=1234&coin_add=-200
     *
     * Removes 200 from the existing coin value.
     * ============================================================
     */

    if (password) {

        /*
         * Get user from database.
         */
        const user =
            await context.env.DB
                .prepare(`
                    SELECT *
                    FROM users
                    WHERE username = ?
                `)
                .bind(username)
                .first();


        /*
         * User doesn't exist.
         */
        if (!user) {

            return new Response(
                JSON.stringify({
                    success: false,
                    error:
                        "User not found."
                }),
                {
                    status: 404,

                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );

        }


        /*
         * Check password.
         */
        if (
            password !==
            user.password
        ) {

            return new Response(
                JSON.stringify({
                    success: false,
                    error:
                        "Invalid password."
                }),
                {
                    status: 401,

                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );

        }


        /*
         * Load existing JSON save.
         */
        let data;

        try {

            data =
                JSON.parse(
                    user.save_data
                );

        }

        catch {

            data = {};

        }


        /*
         * ========================================================
         * PROCESS URL PARAMETERS
         * ========================================================
         */

        for (
            const [key, value]
            of url.searchParams
        ) {

            /*
             * Never treat the password as save data.
             */
            if (
                key === "password"
            ) {

                continue;

            }


            /*
             * ====================================================
             * ADD / SUBTRACT
             *
             * Example:
             *
             * coin_add=500
             *
             * Existing:
             *
             * coin = 1000
             *
             * Result:
             *
             * coin = 1500
             * ====================================================
             */

            if (
                key.endsWith(
                    "_add"
                )
            ) {

                /*
                 * Remove "_add" from
                 * the parameter name.
                 *
                 * coin_add
                 *
                 * becomes:
                 *
                 * coin
                 */
                const actualKey =
                    key.slice(
                        0,
                        -4
                    );


                /*
                 * Convert amount to number.
                 */
                const amount =
                    Number(value);


                /*
                 * Make sure the
                 * supplied amount is valid.
                 */
                if (
                    isNaN(amount)
                ) {

                    return new Response(
                        JSON.stringify({
                            success: false,
                            error:
                                `"${key}" must be a number.`
                        }),
                        {
                            status: 400,

                            headers: {
                                "Content-Type":
                                    "application/json"
                            }
                        }
                    );

                }


                /*
                 * Get existing value.
                 *
                 * If the value doesn't
                 * exist, treat it as 0.
                 */
                const existingValue =
                    Number(
                        data[actualKey] || 0
                    );


                /*
                 * Add the new amount.
                 *
                 * Negative values
                 * automatically subtract.
                 */
                data[actualKey] =
                    existingValue +
                    amount;


                /*
                 * Move to next parameter.
                 */
                continue;

            }


            /*
             * ====================================================
             * SET VALUE
             *
             * Example:
             *
             * coin=500
             *
             * Sets:
             *
             * coin = 500
             * ====================================================
             */


            /*
             * Boolean TRUE
             */
            if (
                value === "true"
            ) {

                data[key] =
                    true;

            }


            /*
             * Boolean FALSE
             */
            else if (
                value === "false"
            ) {

                data[key] =
                    false;

            }


            /*
             * Number
             */
            else if (
                value !== "" &&
                !isNaN(value)
            ) {

                data[key] =
                    Number(value);

            }


            /*
             * String
             */
            else {

                data[key] =
                    value;

            }

        }


        /*
         * ========================================================
         * SAVE UPDATED DATA
         * ========================================================
         */

        try {

            await context.env.DB
                .prepare(`
                    UPDATE users
                    SET
                        save_data = ?,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = ?
                `)
                .bind(
                    JSON.stringify(
                        data
                    ),
                    user.id
                )
                .run();

        }

        catch (error) {

            console.error(
                error
            );


            return new Response(
                JSON.stringify({
                    success: false,
                    error:
                        "Could not save user data."
                }),
                {
                    status: 500,

                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );

        }


        /*
         * ========================================================
         * RETURN UPDATED DATA
         * ========================================================
         */

        return new Response(
            JSON.stringify(
                {
                    success: true,
                    username,
                    data
                },
                null,
                2
            ),
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );

    }


    /*
     * ============================================================
     * NORMAL EDITOR PAGE
     *
     * /edit/avery
     *
     * ============================================================
     */

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


    <!-- =====================================================
         LOGIN
         ===================================================== -->

    <div id="login">

        <input
            id="password"
            type="password"
            maxlength="4"
            inputmode="numeric"
            placeholder="4 digit password"
        >

        <button
            id="unlock"
        >
            Edit
        </button>

    </div>


    <!-- =====================================================
         EDITOR
         ===================================================== -->

    <div
        id="editor"
        style="display:none;"
    >

        <textarea
            id="data"
            rows="25"
            cols="70"
        ></textarea>

        <br>

        <br>

        <button
            id="save"
        >
            Save
        </button>

        <p
            id="message"
        ></p>

    </div>


<script>


/*
 * ============================================================
 * USERNAME
 * ============================================================
 */

const username =
    ${JSON.stringify(username)};


/*
 * Store password after login.
 */
let password = "";


/*
 * ============================================================
 * UNLOCK EDITOR
 * ============================================================
 */

document
    .getElementById(
        "unlock"
    )
    .addEventListener(
        "click",
        async () => {


            /*
             * Get password.
             */
            password =
                document
                    .getElementById(
                        "password"
                    )
                    .value;


            /*
             * Make sure password
             * is exactly 4 digits.
             */
            if (
                !/^\\\\d{4}$/.test(
                    password
                )
            ) {

                alert(
                    "Password must be 4 digits."
                );

                return;

            }


            /*
             * Authenticate.
             */
            const response =
                await fetch(
                    "/api/edit-login",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                username,
                                password
                            })
                    }
                );


            const result =
                await response.json();


            /*
             * Invalid login.
             */
            if (
                !response.ok
            ) {

                alert(
                    result.error ||
                    "Invalid password."
                );

                return;

            }


            /*
             * Hide login.
             */
            document
                .getElementById(
                    "login"
                )
                .style.display =
                    "none";


            /*
             * Show editor.
             */
            document
                .getElementById(
                    "editor"
                )
                .style.display =
                    "block";


            /*
             * Put JSON into textarea.
             */
            document
                .getElementById(
                    "data"
                )
                .value =
                    JSON.stringify(
                        result.data,
                        null,
                        2
                    );

        }
    );


/*
 * ============================================================
 * SAVE JSON FROM NORMAL EDITOR
 * ============================================================
 */

document
    .getElementById(
        "save"
    )
    .addEventListener(
        "click",
        async () => {


            let data;


            /*
             * Parse JSON.
             */
            try {

                data =
                    JSON.parse(
                        document
                            .getElementById(
                                "data"
                            )
                            .value
                    );

            }

            catch {

                document
                    .getElementById(
                        "message"
                    )
                    .textContent =
                        "Invalid JSON.";

                return;

            }


            /*
             * Send updated JSON.
             */
            const response =
                await fetch(
                    "/api/user/" +
                    encodeURIComponent(
                        username
                    ),
                    {
                        method:
                            "PUT",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                password,
                                data
                            })
                    }
                );


            const result =
                await response.json();


            /*
             * Display result.
             */
            document
                .getElementById(
                    "message"
                )
                .textContent =
                    response.ok
                        ? "Saved!"
                        : result.error;

        }
    );


/*
 * ============================================================
 * ESCAPE HTML
 * ============================================================
 */

function escapeHtml(
    value
) {

    return String(
        value
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

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