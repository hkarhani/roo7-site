document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    showError("You are not logged in.");
    redirectToLogin();
    return;
  }

  try {
    const response = await fetch("https://api.roo7.site/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("Failed to authenticate");
    }

    const user = await response.json();

    // Check email_verified
    if (!user.email_verified) {
      showError("Email not verified. Please check your inbox.");
      localStorage.removeItem("token");
      redirectToLogin();
      return;
    }

    document.getElementById("username").textContent = user.username || "-";
    document.getElementById("email").textContent = user.email || "-";
    document.getElementById("full_name").textContent = user.full_name || "-";
    document.getElementById("welcome-name").textContent = user.full_name || user.username;

  } catch (err) {
    console.error("Token invalid or expired:", err);
    showError("Session expired. Please log in again.");
    localStorage.removeItem("token");
    redirectToLogin();
  }
});

function redirectToLogin() {
  setTimeout(() => {
    window.location.href = "/auth.html";
  }, 2000);
}

function showError(message) {
  const note = document.createElement("div");
  note.className = "notification error show";
  note.textContent = message;
  document.body.appendChild(note);
  setTimeout(() => note.classList.remove("show"), 3500);
}

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "/auth.html";
});

document.getElementById("toggle-theme").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});
