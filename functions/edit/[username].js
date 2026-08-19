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

    function setNestedValue(object, path, value) {
        const keys = path.split(".");
        let current = object;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];

            if (
                typeof current[key] !== "object" ||
                current[key] === null ||
                Array.isArray(current[key])
            ) {
                current[key] = {};
            }

            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
    }

    function getNestedValue(object, path) {
        const keys = path.split(".");
        let current = object;

        for (const key of keys) {
            if (
                current === null ||
                typeof current !== "object" ||
                !(key in current)
            ) {
                return undefined;
            }

            current = current[key];
        }

        return current;
    }

    for (const [key, value] of url.searchParams) {
        if (key === "password") continue;

        if (key.endsWith("_add")) {
            const actualPath = key.slice(0, -4);
            const amount = Number(value);

            if (isNaN(amount)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `"${key}" must be a number.`
                }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const existingValue = getNestedValue(data, actualPath);
            const currentValue = Number(existingValue || 0);

            if (isNaN(currentValue)) {
                return new Response(JSON.stringify({
                    success: false,
                    error: `"${actualPath}" is not a number.`
                }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }

            setNestedValue(
                data,
                actualPath,
                currentValue + amount
            );

            continue;
        }

        let parsedValue;

        try {
            parsedValue = JSON.parse(value);
        } catch {
            parsedValue = value;
        }

        setNestedValue(data, key, parsedValue);
    }

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
            headers: { "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify({
        success: true,
        username,
        data
    }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}