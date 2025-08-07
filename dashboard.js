document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api.roo7.site";

  const logoutBtn = document.getElementById("logout-btn");
  const toggleThemeBtn = document.getElementById("toggle-theme");
  const openModalBtn = document.getElementById("open-modal");
  const modal = document.getElementById("account-modal");
  const closeModalBtn = document.querySelector(".modal .close");
  const accountForm = document.getElementById("account-form");
  const strategySelect = document.getElementById("strategy");
  const instrumentsWrapper = document.getElementById("instruments-wrapper");
  const addInstrumentBtn = document.getElementById("add-instrument");
  const usernameDisplay = document.getElementById("username");
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/auth.html";
    return;
  }

  async function fetchUser() {
    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Not authorized");
      const user = await res.json();
      usernameDisplay.textContent = user.full_name;
    } catch (err) {
      console.error("Auth error", err);
      localStorage.removeItem("token");
      window.location.href = "/auth.html";
    }
  }

  function toggleTheme() {
    document.body.classList.toggle("dark-theme");
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
  }

  function openModal() {
    modal.style.display = "block";
  }

  function closeModal() {
    modal.style.display = "none";
    accountForm.reset();
    instrumentsWrapper.innerHTML = "";
    instrumentsWrapper.style.display = "none";
    addInstrumentBtn.style.display = "none";
  }

  function addInstrumentField(symbol = '', weight = 0) {
    const div = document.createElement("div");
    div.className = "instrument-field";
    div.innerHTML = `
      <input type="text" name="symbol" placeholder="Symbol" value="${symbol}" required>
      <input type="number" name="weight" placeholder="Weight (%)" value="${weight}" required>
      <button type="button" class="remove-instrument">×</button>
    `;
    instrumentsWrapper.appendChild(div);

    div.querySelector(".remove-instrument").addEventListener("click", () => div.remove());
  }

  async function loadAccounts() {
    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load accounts");
      const accounts = await res.json();

      const liveTbody = document.querySelector("#accounts-table tbody");
      const settingsTbody = document.querySelector("#settings-table tbody");

      liveTbody.innerHTML = "";
      settingsTbody.innerHTML = "";

      accounts.forEach(account => {
        liveTbody.innerHTML += `
          <tr>
            <td>${account.account_name}</td>
            <td>${account.strategy}</td>
            <td>${account.current_value}</td>
            <td>${account.hedge_percent}</td>
          </tr>
        `;

        settingsTbody.innerHTML += `
          <tr>
            <td>${account.account_name}</td>
            <td>
              <button class="edit-account" data-id="${account.id}">Edit</button>
              <button class="delete-account" data-id="${account.id}">Delete</button>
            </td>
          </tr>
        `;
      });
    } catch (err) {
      console.error("Failed to load accounts", err);
    }
  }

  async function submitAccount(e) {
    e.preventDefault();

    const data = {
      account_name: document.getElementById("account-name").value,
      api_key: document.getElementById("api-key").value,
      api_secret: document.getElementById("api-secret").value,
      strategy: strategySelect.value,
      custom_portfolio: []
    };

    if (data.strategy === "Custom Portfolio Rebalancing") {
      const symbols = instrumentsWrapper.querySelectorAll("input[name='symbol']");
      const weights = instrumentsWrapper.querySelectorAll("input[name='weight']");
      for (let i = 0; i < symbols.length; i++) {
        data.custom_portfolio.push({
          symbol: symbols[i].value.trim().toUpperCase(),
          weight: parseFloat(weights[i].value)
        });
      }
    }

    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (!res.ok) throw new Error("Failed to create account");

      closeModal();
      loadAccounts();
    } catch (err) {
      console.error("Error creating account", err);
      alert("Error: " + err.message);
    }
  }

  toggleThemeBtn.onclick = toggleTheme;
  logoutBtn.onclick = logout;
  openModalBtn.onclick = openModal;
  closeModalBtn.onclick = closeModal;
  accountForm.onsubmit = submitAccount;

  strategySelect.onchange = () => {
    if (strategySelect.value === "Custom Portfolio Rebalancing") {
      instrumentsWrapper.style.display = "block";
      addInstrumentBtn.style.display = "inline-block";
      if (instrumentsWrapper.children.length === 0) {
        addInstrumentField("BTCUSDT", 50);
        addInstrumentField("ETHUSDT", 30);
        addInstrumentField("BNBUSDT", 20);
      }
    } else {
      instrumentsWrapper.style.display = "none";
      addInstrumentBtn.style.display = "none";
      instrumentsWrapper.innerHTML = "";
    }
  };

  addInstrumentBtn.onclick = () => addInstrumentField();

  fetchUser();
  loadAccounts();
});
