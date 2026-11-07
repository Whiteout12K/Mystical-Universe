window.username = null;
window.loggedIn = false;

window.loadSession = async function () {
    try {
        const response = await fetch("/api/me", {
            method: "GET",
            credentials: "include",
            cache: "no-store"
        });

        if (!response.ok) {
            window.username = null;
            window.loggedIn = false;
            updateSessionElements();
            return null;
        }

        const user = await response.json();

        if (user.authenticated && user.username) {
            window.username = user.username;
            window.loggedIn = true;
        } else {
            window.username = null;
            window.loggedIn = false;
        }

        updateSessionElements();

        return user;

    } catch (error) {
        console.error("Session error:", error);

        window.username = null;
        window.loggedIn = false;

        updateSessionElements();

        return null;
    }
};


function updateSessionElements() {
    document.querySelectorAll("[data-username]").forEach(element => {
        element.textContent =
            window.username || "";
    });

    document.querySelectorAll("[data-login]").forEach(element => {

        if (window.loggedIn) {
            element.textContent =
                "Logged in as " + window.username;

            element.href = "#";
        } else {
            element.textContent = "Login";
            element.href = "/mlg/login";
        }
    });
}


window.sessionReady =
    window.loadSession();