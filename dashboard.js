const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/auth.html";
}

fetch("https://api.roo7.site/me", {
  headers: { Authorization: `Bearer ${token}` }
})
  .then(res => res.json())
  .then(user => {
    if (!user.email_verified) {
      localStorage.removeItem("token");
      window.location.href = "/auth.html";
    }
    document.getElementById("welcome-name").textContent = `Welcome ${user.full_name || user.username}`;
  })
  .catch(() => {
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
  });

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "/auth.html";
});

document.getElementById("toggle-theme").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});

// Modal handlers
const modal = document.getElementById("account-modal");
const openModalBtn = document.getElementById("add-account-btn");
const closeModalBtn = document.getElementById("close-modal");

openModalBtn.addEventListener("click", () => {
  modal.style.display = "block";
});

closeModalBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
  }
});
