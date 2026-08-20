export async function onRequest(context) {
    const username = decodeURIComponent(context.params.username);
    const url = new URL(context.request.url);
    const password = url.searchParams.get("password");

    if (!password) {
        return new Response(JSON.stringify({
            success: false,
            error: "Password required."
        }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    const user = await context.env.DB.prepare(`
        SELECT * FROM users WHERE username = ?
    `).bind(username).first();

    if (!user) {
        return new Response(JSON.stringify({
            success: false,
            error: "User not found."
        }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
        });
    }

    if (password !== user.password) {
        return new Response(JSON.stringify({
            success: false,
            error: "Invalid password."
        }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    let data;

    try {
        data = JSON.parse(user.save_data);
    } catch {
        data = {};
    }

    /*
     * Sets a normal nested value.
     *
     * Example:
     * setNestedValue(data, "premium.ruby_tablet", 10)
     *
     * Also supports array indexes:
     *
     * setNestedValue(data, "c_owned.0", 1)
     *
     * which changes:
     *
     * c_owned[0] = 1
     */
    function setNestedValue(object, path, value) {
        const keys = path.split(".");
        let current = object;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];

            if (
                current[key] === undefined ||
                current[key] === null ||
                typeof current[key] !== "object"
            ) {
                // If the next key is a number, create an array.
                if (!isNaN(Number(keys[i + 1]))) {
                    current[key] = [];
                } else {
                    current[key] = {};
                }
            }

            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
    }

    /*
     * Gets a nested value.
     *
     * Supports both objects and arrays.
     */
    function getNestedValue(object, path) {
        const keys = path.split(".");
        let current = object;

        for (const key of keys) {
            if (
                current === null ||
                current === undefined ||
                typeof current !== "object"
            ) {
                return undefined;
            }

            if (!(key in current)) {
                return undefined;
            }

            current = current[key];
        }

        return current;
    }

    /*
     * Converts the new URL syntax:
     *
     * c_owned_0
     *
     * into:
     *
     * c_owned.0
     *
     * This allows array indexes to be modified directly
     * from URL parameters.
     *
     * Example:
     *
     * c_owned_0=1
     *
     * becomes:
     *
     * c_owned[0] = 1
     *
     * Nested example:
     *
     * c_skill1_owned_2_5=1
     *
     * becomes:
     *
     * c_skill1_owned[2][5] = 1
     */
    function convertArrayPath(key) {
        const parts = key.split("_");

        if (parts.length < 2) {
            return key;
        }

        let splitIndex = parts.length;

        /*
         * Work backwards and identify numeric portions.
         *
         * c_owned_0
         *            ^ numeric array index
         *
         * c_skill1_owned_2_5
         *                    ^ numeric
         *                  ^ numeric
         */

        while (
            splitIndex > 1 &&
            /^\d+$/.test(parts[splitIndex - 1])
        ) {
            splitIndex--;
        }

        if (splitIndex === parts.length) {
            return key;
        }

        const base = parts.slice(0, splitIndex).join("_");
        const indexes = parts.slice(splitIndex);

        return base + "." + indexes.join(".");
    }

    /*
     * Process every URL parameter.
     */
    for (const [key, value] of url.searchParams) {

        // Password is authentication only.
        if (key === "password") {
            continue;
        }

        /*
         * -----------------------------------------
         * ADD VALUE
         * -----------------------------------------
         *
         * Example:
         *
         * silver_coin_add=100
         *
         * premium.ruby_tablet_add=50
         *
         * c_owned_0_add=1
         */
        if (key.endsWith("_add")) {
            const rawPath = key.slice(0, -4);

            const actualPath = convertArrayPath(rawPath);

            const amount = Number(value);

            if (isNaN(amount)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `"${key}" must be a number.`
                }), {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
            }

            const existingValue =
                getNestedValue(data, actualPath);

            const currentValue =
                Number(existingValue ?? 0);

            if (isNaN(currentValue)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `"${actualPath}" is not a number.`
                }), {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
            }

            setNestedValue(
                data,
                actualPath,
                currentValue + amount
            );

            continue;
        }

        /*
         * -----------------------------------------
         * NORMAL VALUE / ARRAY VALUE
         * -----------------------------------------
         *
         * Examples:
         *
         * silver_coin=100
         *
         * c_owned_0=1
         *
         * c_owned_3=0
         *
         * c_skill1_owned_2_5=1
         *
         * premium.ruby_tablet=100
         */

        const actualPath = convertArrayPath(key);

        let parsedValue;

        try {
            parsedValue = JSON.parse(value);
        } catch {
            parsedValue = value;
        }

        setNestedValue(
            data,
            actualPath,
            parsedValue
        );
    }

    /*
     * Save updated data.
     */
    try {
        await context.env.DB.prepare(`
            UPDATE users
            SET save_data = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(
            JSON.stringify(data),
            user.id
        ).run();

    } catch (error) {
        console.error(error);

        return new Response(JSON.stringify({
            success: false,
            error: "Could not save user data."
        }), {
            status: 500,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }

    return new Response(JSON.stringify({
        success: true,
        username,
        data
    }, null, 2), {
        status: 200,
        headers: {
            "Content-Type": "application/json"
        }
    });
}