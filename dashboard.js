// === dashboard.js ===

let token = localStorage.getItem("token");

async function fetchMe() {
    const res = await fetch("https://api.roo7.site/me", {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
        const user = await res.json();
        document.getElementById("username").innerText = user.username;
    } else {
        localStorage.removeItem("token");
        window.location.href = "/auth.html";
    }
}

function logout() {
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
}

document.getElementById("logoutBtn").addEventListener("click", logout);

async function fetchAccounts() {
    const res = await fetch("https://api.roo7.site/accounts", {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const accounts = await res.json();
    const table = document.getElementById("accountsTable");
    table.innerHTML = "";

    accounts.forEach((acc) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${acc.account_name}</td>
          <td>${acc.strategy}</td>
          <td>$${acc.current_value.toFixed(2)}</td>
        `;
        table.appendChild(row);
    });
}

document.getElementById("addAccountBtn").addEventListener("click", () => {
    document.getElementById("addAccountModal").style.display = "block";
});

document.getElementById("closeModal").addEventListener("click", () => {
    document.getElementById("addAccountModal").style.display = "none";
});

document.getElementById("accountForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const accountName = document.getElementById("accountName").value;
    const strategy = document.getElementById("strategy").value;
    const hedge = parseFloat(document.getElementById("hedge_percent").value || 0);
    const apiKey = document.getElementById("apiKey").value;
    const apiSecret = document.getElementById("apiSecret").value;

    let customPortfolio = [];
    if (strategy === "Custom Portfolio Rebalancing") {
        const rows = document.querySelectorAll(".instrument-row");
        for (const row of rows) {
            const symbol = row.querySelector(".symbol").value;
            const weight = parseFloat(row.querySelector(".weight").value);
            customPortfolio.push({ symbol, weight });
        }
    }

    const payload = {
        account_name: accountName,
        strategy,
        hedge_percent: hedge,
        api_key: apiKey,
        api_secret: apiSecret,
        custom_portfolio: customPortfolio
    };

    const res = await fetch("https://api.roo7.site/accounts", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        document.getElementById("addAccountModal").style.display = "none";
        await fetchAccounts();
    } else {
        alert("Failed to add account.");
    }
});

// Initial load
fetchMe();
fetchAccounts();