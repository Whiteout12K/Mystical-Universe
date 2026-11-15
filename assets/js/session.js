window.username = null;
window.loggedIn = false;

window.loadSession = async function () {
    try {
        const {loadPlayerSession} = await import("./player-data.js");
        const user = await loadPlayerSession();

        if (user?.authenticated && user.username) {
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
            element.href = "/webpages/account.html";
        }
    });
}


window.sessionReady =
    window.loadSession();