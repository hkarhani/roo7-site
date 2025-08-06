document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("You are not logged in. Redirecting to login.");
    window.location.href = "/auth.html";
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

    document.getElementById("username").textContent = user.username || "-";
    document.getElementById("email").textContent = user.email || "-";
    document.getElementById("full_name").textContent = user.full_name || "-";
  } catch (err) {
    console.error("Token invalid or expired:", err);
    alert("Session expired. Please log in again.");
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
    return;
  }

  // ✅ Bind logout button after DOM is confirmed and user is authenticated
  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
  });
});


// ================== USER INFO (Mock) ==================
document.getElementById("user-info").innerText = "Logged in as: trader123";

// ================== SUMMARY TABLE SAMPLE DATA ==================
const summaryData = [
  { account: "Main Wallet", strategy: "Standard Vapaus", value: 12500, hedge: "15%" },
  { account: "Side Portfolio", strategy: "Top X Instruments", value: 8700, hedge: "10%" },
  { account: "Alt Pool", strategy: "Custom Portfolio", value: 6300, hedge: "20%" },
];

function populateSummaryTable() {
  const table = document.getElementById("summary-table");
  let total = 0;

  summaryData.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.account}</td>
      <td>${row.strategy}</td>
      <td>$${row.value.toLocaleString()}</td>
      <td>${row.hedge}</td>
    `;
    table.appendChild(tr);
    total += row.value;
  });

  const totalRow = document.createElement("tr");
  totalRow.innerHTML = `
    <td colspan="2"><strong>Total</strong></td>
    <td><strong>$${total.toLocaleString()}</strong></td>
    <td></td>
  `;
  table.appendChild(totalRow);
}
populateSummaryTable();

// ================== ACCOUNT SETTINGS ==================
const accountsData = ["Main Wallet", "Side Portfolio", "Alt Pool"];

function populateAccountsTable() {
  const table = document.getElementById("accounts-table");
  accountsData.forEach(account => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${account}</td>
      <td><button class="btn-sm edit">Edit</button></td>
      <td><button class="btn-sm delete">Delete</button></td>
    `;
    table.appendChild(tr);
  });
}
populateAccountsTable();

// ================== MODAL LOGIC ==================
const modal = document.getElementById("add-account-modal");
const openBtn = document.getElementById("open-modal");
const closeBtn = document.getElementById("close-modal");

openBtn.addEventListener("click", () => modal.style.display = "block");
closeBtn.addEventListener("click", () => modal.style.display = "none");
window.addEventListener("click", (e) => {
  if (e.target == modal) modal.style.display = "none";
});
