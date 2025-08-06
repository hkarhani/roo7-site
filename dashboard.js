
document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Session expired. Please log in again.");
    window.location.href = "/auth.html";
    return;
  }

  try {
    const response = await fetch("https://api.roo7.site/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = await response.json();

    if (!response.ok || !user.email_verified) {
      alert("Token invalid or email not verified. Please log in again.");
      localStorage.removeItem("token");
      window.location.href = "/auth.html";
      return;
    }

    const welcomeEl = document.getElementById("welcome-name");
    if (welcomeEl) welcomeEl.textContent = "Welcome " + (user.full_name || user.username);

    const summaryBody = document.getElementById("summary-table-body");
    const summaryData = [
      { account: "Alpha", strategy: "Standard Vapaus", value: 1200, hedge: "25%" },
      { account: "Beta", strategy: "Custom Rebalancing", value: 850, hedge: "30%" }
    ];
    let total = 0;
    summaryData.forEach(item => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${item.account}</td><td>${item.strategy}</td><td>${item.value}</td><td>${item.hedge}</td>`;
      summaryBody.appendChild(row);
      total += item.value;
    });
    document.getElementById("summary-total").textContent = total;

    const settingsBody = document.getElementById("settings-table-body");
    summaryData.forEach(item => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${item.account}</td><td><button>Edit</button><button>Delete</button></td>`;
      settingsBody.appendChild(row);
    });

  } catch (err) {
    console.error("Token invalid or expired:", err);
    localStorage.removeItem("token");
    alert("Session expired. Please log in again.");
    window.location.href = "/auth.html";
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("token");
      window.location.href = "/auth.html";
    });
  }

  const toggleThemeBtn = document.getElementById("toggle-theme");
  if (toggleThemeBtn) {
    toggleThemeBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
    });
  }
});
