document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("You are not logged in. Redirecting to login.");
    window.location.href = "/auth.html";  // or "/index.html"
    return;
  }

  try {
    const response = await fetch("https://api.roo7.site/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("Failed to authenticate");
    }

    const user = await response.json();

    document.getElementById("username").textContent = user.username;
    document.getElementById("email").textContent = user.email || "-";
    document.getElementById("full_name").textContent = user.full_name || "-";
  } catch (err) {
    console.error("Token invalid or expired:", err);
    alert("Session expired. Please log in again.");
    localStorage.removeItem("token");
    window.location.href = "/auth.html"; // or "/index.html"
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "/auth.html"; // or "/index.html"
});
