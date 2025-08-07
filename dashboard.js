document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://api.roo7.site";

  // grab these once
  const logoutBtn       = document.getElementById("logout-btn");
  const toggleThemeBtn  = document.getElementById("toggle-theme");
  const openModalBtn    = document.getElementById("open-modal");
  const modal           = document.getElementById("account-modal"); // Added this line
  const closeModalBtn   = document.querySelector(".modal .close");
  const accountForm     = document.getElementById("account-form");
  const strategySelect  = document.getElementById("strategy");
  const instrumentsWrap = document.getElementById("instruments-wrapper");
  const addInstrumentBtn= document.getElementById("add-instrument");

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
    instrumentsWrap.innerHTML = "";
    instrumentsWrap.style.display = "none";
    addInstrumentBtn.style.display = "none";
  }

  // Close modal when clicking outside of it
  window.onclick = function(event) {
    if (event.target === modal) {
      closeModal();
    }
  }

  function addInstrumentField(sym = "", wt = 0) {
    const div = document.createElement("div");
    div.className = "instrument-field";
    div.innerHTML = `
      <input type="text" name="symbol"  placeholder="Symbol" value="${sym}" required>
      <input type="number" name="weight" placeholder="Weight (%)" value="${wt}" required>
      <button type="button" class="remove-instrument">×</button>
    `;
    instrumentsWrap.appendChild(div);
    div.querySelector(".remove-instrument")
       .addEventListener("click", () => div.remove());
  }

  async function loadAccounts() {
    // 1) pull token, 2) debug‐log it, 3) bail if null
    const token = localStorage.getItem("token");
    console.log("▶️ loadAccounts() token:", token);
    if (!token) {
      console.error("No token found in localStorage, redirecting to login.");
      return (window.location.href = "/auth.html");
    }

    // 4) do an explicit GET with quoted headers
    const res = await fetch(`${API_BASE}/accounts`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    console.log("⏳ /accounts status:", res.status);
    if (res.status === 401) {
      console.warn("Unauthorized — clearing token & bouncing back.");
      localStorage.removeItem("token");
      return alert("Session expired. Please log in again.");
    }

    const accounts = await res.json();
    const liveTbody     = document.querySelector("#accounts-table tbody");
    const settingsTbody = document.querySelector("#settings-table tbody");

    liveTbody.innerHTML = "";
    settingsTbody.innerHTML = "";

    accounts.forEach(acc => {
      liveTbody.innerHTML += `
        <tr>
          <td>${acc.account_name}</td>
          <td>${acc.strategy}</td>
          <td>${acc.current_value || 'N/A'}</td>
          <td>${acc.hedge_percent || 'N/A'}</td>
        </tr>`;
  
      settingsTbody.innerHTML += `
        <tr>
          <td>${acc.account_name}</td>
          <td>
            <button class="edit-account" data-id="${acc.id}">Edit</button>
            <button class="delete-account" data-id="${acc.id}">Delete</button>
          </td>
        </tr>`;
    });
  }

  async function submitAccount(e) {
    e.preventDefault();

    // re-read token immediately
    const token = localStorage.getItem("token");
    console.log("▶️ submitAccount() token:", token);

    if (!token) {
      alert("You must be logged in to add an account.");
      return window.location.href = "/auth.html";
    }

    const data = {
      account_name: document.getElementById("account-name").value,
      api_key:       document.getElementById("api-key").value,
      api_secret:    document.getElementById("api-secret").value,
      strategy:      strategySelect.value,
      custom_portfolio: []
    };

    if (data.strategy === "Custom Portfolio Rebalancing") {
      const syms    = instrumentsWrap.querySelectorAll("input[name='symbol']");
      const weights = instrumentsWrap.querySelectorAll("input[name='weight']");
      syms.forEach((inp, i) => {
        data.custom_portfolio.push({
          symbol: inp.value.trim().toUpperCase(),
          weight: parseFloat(weights[i].value)
        });
      });
    }

    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);
      closeModal();
      loadAccounts();
    } catch (err) {
      alert("Error creating account: " + err.message);
    }
  }

  // wire up UI
  toggleThemeBtn.onclick    = toggleTheme;
  logoutBtn.onclick         = logout;
  openModalBtn.onclick      = openModal;
  closeModalBtn.onclick     = closeModal;
  accountForm.onsubmit      = submitAccount;
  strategySelect.onchange   = () => {
    if (strategySelect.value === "Custom Portfolio Rebalancing") {
      instrumentsWrap.style.display = "flex"; // Changed to flex for proper layout
      addInstrumentBtn.style.display = "inline-block";
      if (!instrumentsWrap.children.length) {
        addInstrumentField("BTCUSDT", 50);
        addInstrumentField("ETHUSDT", 30);
        addInstrumentField("BNBUSDT", 20);
      }
    } else {
      instrumentsWrap.style.display = "none";
      addInstrumentBtn.style.display  = "none";
      instrumentsWrap.innerHTML       = "";
    }
  };
  addInstrumentBtn.onclick = () => addInstrumentField();

  const fetchUser = async () => {
    const token = localStorage.getItem("token");
    console.log("▶️ fetchUser() token:", token);
    
    if (!token) {
      console.error("No token found in localStorage for fetchUser");
      window.location.href = "/auth.html";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log("⏳ /me status:", res.status);

      if (res.ok) {
        const data = await res.json();
        console.log("✅ User data:", data);
        document.getElementById("user-fullname").textContent = data.full_name;
      } else {
        console.warn("Failed to fetch user data, redirecting to auth");
        localStorage.removeItem("token");
        window.location.href = "/auth.html";
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      localStorage.removeItem("token");
      window.location.href = "/auth.html";
    }
  };

  // fetch the user 
  fetchUser();

  // initial load
  loadAccounts();
});