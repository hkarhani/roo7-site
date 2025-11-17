import CONFIG from './frontend-config.js';

document.addEventListener('DOMContentLoaded', () => {
  const AUTH_API_BASE = CONFIG.API_CONFIG.authUrl;
  const B2B_API_BASE = CONFIG.API_CONFIG.b2bUrl;

  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/auth.html';
    return;
  }

  const elements = {
    form: document.getElementById('partner-form'),
    formTitle: document.getElementById('form-title'),
    name: document.getElementById('partner-name'),
    status: document.getElementById('partner-status'),
    allowAll: document.getElementById('allow-all-sources'),
    sourceOptions: document.getElementById('source-options'),
    allowedHosts: document.getElementById('allowed-hosts'),
    notes: document.getElementById('partner-notes'),
    saveBtn: document.getElementById('save-partner-btn'),
    resetBtn: document.getElementById('reset-form-btn'),
    disableBtn: document.getElementById('disable-partner-btn'),
    secretBanner: document.getElementById('secret-banner'),
    secretValue: document.getElementById('secret-value'),
    unbanForm: document.getElementById('unban-form'),
    unbanIp: document.getElementById('unban-ip'),
    partnersTable: document.querySelector('#partners-table tbody'),
    partnerDetailCard: document.getElementById('partner-detail-card'),
    partnerDetailBody: document.getElementById('partner-detail-body'),
    regenerateBtn: document.getElementById('regenerate-secret-btn'),
    refreshBtn: document.getElementById('refresh-partners'),
    themeToggle: document.getElementById('theme-toggle'),
    logoutBtn: document.getElementById('logout-btn'),
  };

  const state = {
    partners: [],
    selectedPartnerId: null,
    editingPartnerId: null,
    sourceAccounts: [],
    sourceLookup: {},
    isAdminVerified: false,
  };

  function getAuthHeaders() {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    };
  }

  function showToast(message, type = 'success', timeout = 4200) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade');
      setTimeout(() => toast.remove(), 400);
    }, timeout);
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      const date = new Date(value);
      return date.toLocaleString();
    } catch (error) {
      return value;
    }
  }

  function parseHosts(input) {
    return input
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function renderSourceOptions(selected = new Set()) {
    if (!elements.sourceOptions) return;
    elements.sourceOptions.innerHTML = '';
    if (!state.sourceAccounts.length) {
      elements.sourceOptions.innerHTML = '<div class="empty-state small">No source accounts available.</div>';
      return;
    }

    state.sourceAccounts.forEach((account) => {
      const wrapper = document.createElement('label');
      wrapper.innerHTML = `
        <input type="checkbox" value="${account.id}" ${selected.has(account.id) ? 'checked' : ''}/>
        <span>${account.name} <small>(${account.strategy || 'N/A'})</small></span>
      `;
      elements.sourceOptions.appendChild(wrapper);
    });

    if (elements.allowAll.checked) {
      elements.sourceOptions.classList.add('disabled');
    } else {
      elements.sourceOptions.classList.remove('disabled');
    }
  }

  function getSelectedSourceIds() {
    if (elements.allowAll.checked) return [];
    const checked = Array.from(elements.sourceOptions.querySelectorAll('input:checked'));
    return checked.map((input) => input.value);
  }

  function resetForm() {
    state.editingPartnerId = null;
    elements.formTitle.textContent = 'Create B2B Partner';
    elements.name.value = '';
    elements.status.value = 'active';
    elements.allowedHosts.value = '';
    elements.notes.value = '';
    elements.allowAll.checked = true;
    renderSourceOptions(new Set());
    elements.disableBtn.disabled = true;
    hideSecretBanner();
  }

  function fillForm(partner) {
    state.editingPartnerId = partner.partner_id;
    elements.formTitle.textContent = `Edit ${partner.name}`;
    elements.name.value = partner.name || '';
    elements.status.value = partner.status || 'active';
    elements.allowedHosts.value = (partner.allowed_hostnames || []).join('\n');
    elements.notes.value = partner.notes || '';

    const allowedSources = partner.allowed_source_ids || [];
    const allowAll = !allowedSources.length;
    elements.allowAll.checked = allowAll;
    renderSourceOptions(new Set(allowedSources));
    elements.disableBtn.disabled = false;
  }

  function hideSecretBanner() {
    elements.secretBanner.classList.remove('visible');
    elements.secretValue.textContent = '';
  }

  function showSecret(secretText) {
    elements.secretValue.textContent = secretText;
    elements.secretBanner.classList.add('visible');
  }

  async function verifyAdminAccess() {
    try {
      const response = await fetch(`${AUTH_API_BASE}/me`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Auth failed');
      const data = await response.json();
      if (!data.is_admin) {
        showToast('Access restricted to admins.', 'error');
        setTimeout(() => (window.location.href = '/dashboard.html'), 1500);
        return false;
      }
      state.isAdminVerified = true;
      return true;
    } catch (error) {
      showToast('Admin verification failed. Redirecting…', 'error');
      setTimeout(() => (window.location.href = '/auth.html'), 1500);
      return false;
    }
  }

  async function loadSourceAccounts() {
    try {
      const response = await fetch(`${AUTH_API_BASE}/admin/analytics/source-accounts-list`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error(`Failed to fetch sources (${response.status})`);
      const data = await response.json();
      if (data.accounts) {
        state.sourceAccounts = data.accounts;
        state.sourceLookup = {};
        data.accounts.forEach((account) => {
          state.sourceLookup[account.id] = account;
        });
      }
      renderSourceOptions(new Set());
    } catch (error) {
      console.error('Source account load failed', error);
      state.sourceAccounts = [];
      renderSourceOptions(new Set());
      showToast('Unable to load source accounts list.', 'error');
    }
  }

  async function loadPartners() {
    try {
      elements.partnersTable.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">Loading partners…</div>
          </td>
        </tr>`;
      const response = await fetch(`${B2B_API_BASE}/admin/b2b/partners`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error(`Failed to fetch partners (${response.status})`);
      const data = await response.json();
      state.partners = data.partners || [];
      renderPartners();
    } catch (error) {
      console.error('Partner load failed', error);
      elements.partnersTable.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">Unable to load partners.</div>
          </td>
        </tr>`;
      showToast('Unable to load partners.', 'error');
    }
  }

  function renderPartners() {
    if (!state.partners.length) {
      elements.partnersTable.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">No partners configured yet.</div>
          </td>
        </tr>`;
      return;
    }

    elements.partnersTable.innerHTML = '';
    state.partners.forEach((partner) => {
      const row = document.createElement('tr');
      if (partner.partner_id === state.selectedPartnerId) {
        row.classList.add('active');
      }
      row.innerHTML = `
        <td>${partner.name}</td>
        <td>
          <span class="badge ${partner.status === 'active' ? 'success' : 'muted'}">${partner.status}</span>
        </td>
        <td><code>${partner.api_key || '—'}</code></td>
        <td>${(partner.allowed_source_ids && partner.allowed_source_ids.length) ? partner.allowed_source_ids.length : 'All'}</td>
        <td>${(partner.allowed_hostnames || []).length || '—'}</td>
        <td>${formatDate(partner.updated_at)}</td>
      `;
      row.addEventListener('click', () => selectPartner(partner.partner_id));
      elements.partnersTable.appendChild(row);
    });
  }

  function selectPartner(partnerId) {
    state.selectedPartnerId = partnerId;
    renderPartners();
    const partner = state.partners.find((p) => p.partner_id === partnerId);
    if (partner) {
      renderPartnerDetail(partner);
      fillForm(partner);
    }
  }

  function renderPartnerDetail(partner) {
    const hostChips = (partner.allowed_hostnames || [])
      .map((host) => `<span class="chip">${host}</span>`)
      .join('') || '<span class="chip muted">None</span>';

    const sourceList = (partner.allowed_source_ids || []).map((id) => {
      const source = state.sourceLookup[id];
      return `<span class="chip">${source ? `${source.name}` : id}</span>`;
    }).join('');

    const sourcesMarkup = sourceList || '<span class="chip success">All Sources</span>';

    elements.partnerDetailBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-block">
          <h4>Partner</h4>
          <p>${partner.name}</p>
        </div>
        <div class="detail-block">
          <h4>Status</h4>
          <p><span class="badge ${partner.status === 'active' ? 'success' : 'muted'}">${partner.status}</span></p>
        </div>
        <div class="detail-block">
          <h4>API Key</h4>
          <p style="word-break: break-all;">${partner.api_key || '—'}</p>
        </div>
      </div>
      <div class="detail-block">
        <h4>Allowed Sources</h4>
        <div class="chips-list">${sourcesMarkup}</div>
      </div>
      <div class="detail-block">
        <h4>Allowed Hosts / IPs</h4>
        <div class="chips-list">${hostChips}</div>
      </div>
      <div class="detail-block">
        <h4>Notes</h4>
        <p>${partner.notes || '—'}</p>
      </div>
      <div class="detail-meta">
        <span>Created: ${formatDate(partner.created_at)}</span>
        <span>Updated: ${formatDate(partner.updated_at)}</span>
      </div>
    `;
    elements.regenerateBtn.disabled = false;
  }

  async function submitPartnerForm(event) {
    event.preventDefault();
    if (!state.isAdminVerified) return;

    const payload = {
      name: elements.name.value.trim(),
      status: elements.status.value,
      allowed_hostnames: parseHosts(elements.allowedHosts.value),
      notes: elements.notes.value.trim(),
      allowed_source_ids: getSelectedSourceIds(),
    };

    if (!payload.name) {
      showToast('Name is required.', 'error');
      return;
    }

    elements.saveBtn.disabled = true;
    try {
      if (state.editingPartnerId) {
        const response = await fetch(
          `${B2B_API_BASE}/admin/b2b/partners/${state.editingPartnerId}`,
          {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) throw new Error(`Update failed (${response.status})`);
        showToast('Partner updated.');
      } else {
        const response = await fetch(`${B2B_API_BASE}/admin/b2b/partners`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Create failed (${response.status})`);
        const data = await response.json();
        showSecret(`API Key: ${data.api_key}\nAPI Secret: ${data.api_secret}`);
        showToast('Partner created.');
      }
      await loadPartners();
    } catch (error) {
      console.error('Partner save failed', error);
      showToast('Unable to save partner.', 'error');
    } finally {
      elements.saveBtn.disabled = false;
    }
  }

  async function disableCurrentPartner() {
    if (!state.editingPartnerId) return;
    const confirmDisable = confirm('Disable this partner? They will lose API access.');
    if (!confirmDisable) return;
    elements.disableBtn.disabled = true;
    try {
      const response = await fetch(
        `${B2B_API_BASE}/admin/b2b/partners/${state.editingPartnerId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        },
      );
      if (!response.ok) throw new Error(`Disable failed (${response.status})`);
      showToast('Partner disabled.');
      resetForm();
      state.selectedPartnerId = null;
      await loadPartners();
      elements.partnerDetailBody.innerHTML = '<p class="card-subtitle">Select another partner to view details.</p>';
      elements.regenerateBtn.disabled = true;
    } catch (error) {
      console.error('Disable partner failed', error);
      showToast('Unable to disable partner.', 'error');
    } finally {
      elements.disableBtn.disabled = false;
    }
  }

  async function regenerateSecret() {
    if (!state.selectedPartnerId) return;
    const confirmed = confirm('Regenerate API secret for this partner? Old secret will stop working.');
    if (!confirmed) return;

    elements.regenerateBtn.disabled = true;
    try {
      const response = await fetch(
        `${B2B_API_BASE}/admin/b2b/partners/${state.selectedPartnerId}/regenerate-secret`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        },
      );
      if (!response.ok) throw new Error(`Regeneration failed (${response.status})`);
      const data = await response.json();
      showSecret(`New API Secret: ${data.api_secret}`);
      showToast('API secret regenerated.');
    } catch (error) {
      console.error('Regenerate secret failed', error);
      showToast('Unable to regenerate secret.', 'error');
    } finally {
      elements.regenerateBtn.disabled = false;
    }
  }

  async function handleUnban(event) {
    event.preventDefault();
    const ip = elements.unbanIp.value.trim();
    if (!ip) return;
    try {
      const response = await fetch(`${B2B_API_BASE}/admin/b2b/banned-ips/unban`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ip }),
      });
      if (!response.ok) throw new Error(`Unban failed (${response.status})`);
      const data = await response.json();
      if (data.removed) {
        showToast(`Removed ${ip} from ban list.`);
      } else {
        showToast(`IP ${ip} not found in ban list.`, 'error');
      }
      elements.unbanIp.value = '';
    } catch (error) {
      console.error('Unban failed', error);
      showToast('Unable to remove ban.', 'error');
    }
  }

  function toggleTheme() {
    document.body.classList.toggle('light');
  }

  function logout() {
    localStorage.removeItem('token');
    window.location.href = '/auth.html';
  }

  elements.form.addEventListener('submit', submitPartnerForm);
  elements.resetBtn.addEventListener('click', (event) => {
    event.preventDefault();
    resetForm();
  });
  elements.allowAll.addEventListener('change', () => {
    if (elements.allowAll.checked) {
      elements.sourceOptions.classList.add('disabled');
      elements.sourceOptions.querySelectorAll('input').forEach((input) => (input.checked = false));
    } else {
      elements.sourceOptions.classList.remove('disabled');
    }
  });
  elements.disableBtn.addEventListener('click', disableCurrentPartner);
  elements.regenerateBtn.addEventListener('click', regenerateSecret);
  elements.unbanForm.addEventListener('submit', handleUnban);
  elements.refreshBtn.addEventListener('click', loadPartners);
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.logoutBtn.addEventListener('click', logout);

  (async function init() {
    const ok = await verifyAdminAccess();
    if (!ok) return;
    await loadSourceAccounts();
    await loadPartners();
  })();
});
