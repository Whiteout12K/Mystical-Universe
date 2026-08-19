function loadComponent(id, file) {
  fetch(file)
    .then(res => res.text())
    .then(data => {
      document.getElementById(id).innerHTML = data;

      if (id === "header-placeholder" ||
          id === "subheader-placeholder" ||
          id === "sub4header-placeholder") {
        loadLoggedInUser();
        setupNavbarLogin();
      }
    });
}

async function loadLoggedInUser() {
  const loginUser = document.getElementById("loginUser");
  const loginMenu = document.getElementById("loginMenu");
  const userMenu = document.getElementById("userMenu");
  const profileImage = document.getElementById("profileImage");
  const usernameText = document.getElementById("usernameText");

  if (!loginUser || !loginMenu || !userMenu) return;

  try {
    const response = await fetch("/api/me");

    if (!response.ok) {
      loginMenu.style.display = "";
      userMenu.style.display = "none";

      if (profileImage) {
        profileImage.style.display = "none";
      }

      return;
    }

    const user = await response.json();

    if (user.authenticated && user.username) {
      usernameText.textContent = user.username;

      loginMenu.style.display = "none";
      userMenu.style.display = "";

      if (profileImage) {
        profileImage.style.display = "";
      }

      setupLogout();
    } else {
      loginMenu.style.display = "";
      userMenu.style.display = "none";

      if (profileImage) {
        profileImage.style.display = "none";
      }
    }
  } catch (error) {
    console.error("Unable to load logged in user:", error);

    loginMenu.style.display = "";
    userMenu.style.display = "none";

    if (profileImage) {
      profileImage.style.display = "none";
    }
  }
}

function setupNavbarLogin() {
  const form = document.getElementById("navbarLoginForm");
  const dropdown = document.getElementById("loginDropdown");
  const message = document.getElementById("navbarLoginMessage");

  if (!form || !dropdown || !message) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const username =
      document.getElementById("navbarUsername").value.trim();

    const password =
      document.getElementById("navbarPassword").value;

    message.textContent = "";
    message.classList.remove("show");

    try {
      const response = await fetch(
        "/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username,
            password
          })
        }
      );

      const result = await response.json();

      if (response.ok) {
        window.location.reload();
        return;
      }

      message.textContent =
        result.error || "Username or password is incorrect.";

      message.classList.add("show");

      const dropdownInstance =
        bootstrap.Dropdown.getOrCreateInstance(dropdown);

      dropdownInstance.show();

    } catch (error) {
      console.error("Login failed:", error);

      message.textContent =
        "Unable to connect to login service.";

      const dropdownInstance =
        bootstrap.Dropdown.getOrCreateInstance(dropdown);

      dropdownInstance.show();
    }
  });
}

function setupLogout() {
  const logoutButton =
    document.getElementById("logoutButton");

  if (!logoutButton) return;

  logoutButton.addEventListener("click", async () => {
    try {
      await fetch(
        "/api/logout",
        {
          method: "POST"
        }
      );
    } catch (error) {
      console.error("Logout failed:", error);
    }

    window.location.reload();
  });
}

loadComponent("header-placeholder", "index/header.html");
loadComponent("footer-placeholder", "index/footer.html");

loadComponent("subheader-placeholder", "../index/header.html");
loadComponent("subfooter-placeholder", "../index/footer.html");

loadComponent("sub4header-placeholder", "../../../../index/header.html");
loadComponent("sub4footer-placeholder", "../../../../index/footer.html");