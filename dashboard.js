document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) return window.location.href = "/auth.html";

  try {
    const res = await fetch("https://api.roo7.site/me", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Unauthorized");
    const user = await res.json();
    document.getElementById("full-name").textContent = user.full_name || user.username;
  } catch {
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
  }
});

document.getElementById("toggle-theme").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});
