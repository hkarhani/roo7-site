// market-insights.js - Market Data Insights

class MarketInsights {
  constructor(apiBase, marketDataApi) {
    this.API_BASE = apiBase;
    this.MARKET_DATA_API = marketDataApi;
    this.isLoading = false;
    this.lastUpdateTime = null;
    this.refreshInterval = null;
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadMarketData();
    this.startAutoRefresh();
  }

  bindEvents() {
    const refreshBtn = document.getElementById('refresh-market-data');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshMarketData());
    }
  }

  startAutoRefresh() {
    // Auto-refresh every 5 minutes
    this.refreshInterval = setInterval(() => {
      this.loadMarketData();
    }, 5 * 60 * 1000);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async refreshMarketData() {
    const refreshBtn = document.getElementById('refresh-market-data');
    if (refreshBtn && !refreshBtn.disabled) {
      await this.loadMarketData(true);
    }
  }

  async loadMarketData(isManualRefresh = false) {
    if (this.isLoading) return;

    const token = localStorage.getItem('token');
    if (!token) {
      this.showError('Authentication required to load market data');
      return;
    }

    this.setLoadingState(true);

    try {
      // Load data from multiple endpoints concurrently
      const [gainersData, losersData, volumeData, majorCoinsData, healthData] = await Promise.all([
        this.fetchMarketData('/top-gainers?limit=10'),
        this.fetchMarketData('/top-losers?limit=10'),
        this.fetchMarketData('/top-movers?limit=50'), // Get more to filter for major coins
        this.fetchMarketData('/top-movers?limit=50'), // Same data, different filtering
        this.fetchMarketData('/health', false) // No auth required for health
      ]);

      // Update tables
      this.updateGainersTable(gainersData);
      this.updateLosersTable(losersData);
      this.updateVolumeTable(volumeData);
      this.updateMajorCoinsTable(majorCoinsData);
      this.updateMarketChanges(healthData);

      // Update last updated time
      this.lastUpdateTime = new Date();
      this.updateLastUpdatedTime();

      if (isManualRefresh) {
        window.showToast('✅ Market data refreshed successfully!', 'success');
      }

    } catch (error) {
      console.error('❌ Error loading market data:', error);
      this.showError(`Failed to load market data: ${error.message}`);
      
      if (isManualRefresh) {
        window.showToast('❌ Failed to refresh market data', 'error');
      }
    } finally {
      this.setLoadingState(false);
    }
  }

  async fetchMarketData(endpoint, requireAuth = true) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (requireAuth && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.MARKET_DATA_API}${endpoint}`, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  updateGainersTable(gainersData) {
    const tbody = document.querySelector('#top-gainers-table tbody');
    if (!tbody) return;

    if (!gainersData || !gainersData.success || !gainersData.data) {
      tbody.innerHTML = '<tr><td colspan="5" class="market-loading">No data available</td></tr>';
      return;
    }

    const gainers = gainersData.data.slice(0, 10);
    tbody.innerHTML = gainers.map(item => `
      <tr>
        <td><strong>${item.symbol}</strong></td>
        <td>${this.formatPrice(item.price)}</td>
        <td><span class="price-change positive">+${item.priceChangePercent.toFixed(2)}%</span></td>
        <td>${this.formatVolume(item.volume)}</td>
        <td><span class="market-badge ${item.market_type.toLowerCase()}">${item.market_type}</span></td>
      </tr>
    `).join('');
  }

  updateLosersTable(losersData) {
    const tbody = document.querySelector('#top-losers-table tbody');
    if (!tbody) return;

    if (!losersData || !losersData.success || !losersData.data) {
      tbody.innerHTML = '<tr><td colspan="5" class="market-loading">No data available</td></tr>';
      return;
    }

    const losers = losersData.data.slice(0, 10);
    tbody.innerHTML = losers.map(item => `
      <tr>
        <td><strong>${item.symbol}</strong></td>
        <td>${this.formatPrice(item.price)}</td>
        <td><span class="price-change negative">${item.priceChangePercent.toFixed(2)}%</span></td>
        <td>${this.formatVolume(item.volume)}</td>
        <td><span class="market-badge ${item.market_type.toLowerCase()}">${item.market_type}</span></td>
      </tr>
    `).join('');
  }

  updateVolumeTable(volumeData) {
    const tbody = document.querySelector('#top-volume-table tbody');
    if (!tbody) return;

    if (!volumeData || !volumeData.success || !volumeData.data) {
      tbody.innerHTML = '<tr><td colspan="5" class="market-loading">No data available</td></tr>';
      return;
    }

    const topVolume = volumeData.data.slice(0, 10);
    tbody.innerHTML = topVolume.map(item => `
      <tr>
        <td><strong>${item.symbol}</strong></td>
        <td>${this.formatPrice(item.price)}</td>
        <td><span class="price-change ${item.priceChangePercent >= 0 ? 'positive' : 'negative'}">
          ${item.priceChangePercent >= 0 ? '+' : ''}${item.priceChangePercent.toFixed(2)}%
        </span></td>
        <td>${this.formatVolume(item.volume)}</td>
        <td><span class="market-badge ${item.market_type.toLowerCase()}">${item.market_type}</span></td>
      </tr>
    `).join('');
  }

  updateMajorCoinsTable(volumeData) {
    const tbody = document.querySelector('#major-coins-table tbody');
    if (!tbody) return;

    if (!volumeData || !volumeData.success || !volumeData.data) {
      tbody.innerHTML = '<tr><td colspan="5" class="market-loading">No data available</td></tr>';
      return;
    }

    // Define major coins by market cap (approximate ranking)
    const majorCoins = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 
      'SOLUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT',
      'AVAXUSDT', 'LINKUSDT', 'ATOMUSDT', 'NEARUSDT', 'UNIUSDT'
    ];

    // Filter for major coins and sort by volume
    const majorCoinsData = volumeData.data
      .filter(item => majorCoins.includes(item.symbol))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    if (majorCoinsData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="market-loading">No major coins data available</td></tr>';
      return;
    }

    tbody.innerHTML = majorCoinsData.map(item => `
      <tr>
        <td><strong>${item.symbol}</strong></td>
        <td>${this.formatPrice(item.price)}</td>
        <td><span class="price-change ${item.priceChangePercent >= 0 ? 'positive' : 'negative'}">
          ${item.priceChangePercent >= 0 ? '+' : ''}${item.priceChangePercent.toFixed(2)}%
        </span></td>
        <td>${this.formatVolume(item.volume)}</td>
        <td><span class="market-badge ${item.market_type.toLowerCase()}">${item.market_type}</span></td>
      </tr>
    `).join('');
  }

  updateMarketChanges(healthData) {
    const newInstrumentsEl = document.getElementById('new-instruments-count');
    const removedInstrumentsEl = document.getElementById('removed-instruments-count');
    const totalInstrumentsEl = document.getElementById('total-instruments-count');

    if (healthData && healthData.instruments_count) {
      const totalSpot = healthData.instruments_count.SPOT || 0;
      const totalFutures = healthData.instruments_count.FUTURES || 0;
      const totalInstruments = totalSpot + totalFutures;

      if (totalInstrumentsEl) {
        totalInstrumentsEl.textContent = `${totalInstruments.toLocaleString()} (SPOT: ${totalSpot.toLocaleString()}, FUTURES: ${totalFutures.toLocaleString()})`;
        totalInstrumentsEl.className = 'change-value';
      }

      // For new/removed instruments, we'd need additional API endpoints
      // For now, show placeholder values
      if (newInstrumentsEl) {
        newInstrumentsEl.textContent = 'Available in next update';
        newInstrumentsEl.className = 'change-value';
      }

      if (removedInstrumentsEl) {
        removedInstrumentsEl.textContent = 'Available in next update';
        removedInstrumentsEl.className = 'change-value';
      }
    } else {
      // Handle error case
      [newInstrumentsEl, removedInstrumentsEl, totalInstrumentsEl].forEach(el => {
        if (el) {
          el.textContent = 'Error loading data';
          el.className = 'change-value negative';
        }
      });
    }
  }

  updateLastUpdatedTime() {
    const lastUpdatedEl = document.getElementById('last-updated');
    if (lastUpdatedEl && this.lastUpdateTime) {
      const timeStr = this.lastUpdateTime.toLocaleTimeString();
      lastUpdatedEl.textContent = `Last updated: ${timeStr}`;
    }
  }

  setLoadingState(isLoading) {
    this.isLoading = isLoading;
    const refreshBtn = document.getElementById('refresh-market-data');
    
    if (refreshBtn) {
      refreshBtn.disabled = isLoading;
      refreshBtn.textContent = isLoading ? '🔄 Loading...' : '🔄 Refresh';
      refreshBtn.style.opacity = isLoading ? '0.6' : '1';
    }

    // Show loading state in tables if this is the first load
    if (isLoading && !this.lastUpdateTime) {
      this.showLoadingInTables();
    }
  }

  showLoadingInTables() {
    const tables = [
      '#top-gainers-table tbody',
      '#top-losers-table tbody',
      '#top-volume-table tbody',
      '#major-coins-table tbody'
    ];

    tables.forEach(selector => {
      const tbody = document.querySelector(selector);
      if (tbody) {
        const colCount = 5; // All tables now have 5 columns
        tbody.innerHTML = `<tr><td colspan="${colCount}" class="market-loading">Loading market data...</td></tr>`;
      }
    });

    // Show loading in market changes
    const changeElements = [
      'new-instruments-count',
      'removed-instruments-count',
      'total-instruments-count'
    ];

    changeElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = 'Loading...';
        el.className = 'change-value loading';
      }
    });
  }

  showError(message) {
    const tables = [
      '#top-gainers-table tbody',
      '#top-losers-table tbody',
      '#top-volume-table tbody',
      '#major-coins-table tbody'
    ];

    tables.forEach(selector => {
      const tbody = document.querySelector(selector);
      if (tbody) {
        const colCount = 5; // All tables now have 5 columns
        tbody.innerHTML = `<tr><td colspan="${colCount}" class="market-error">${message}</td></tr>`;
      }
    });
  }

  formatPrice(price) {
    if (price >= 1) {
      return price.toFixed(2);
    } else if (price >= 0.01) {
      return price.toFixed(4);
    } else {
      return price.toFixed(8);
    }
  }

  formatVolume(volume) {
    if (volume >= 1e9) {
      return (volume / 1e9).toFixed(2) + 'B';
    } else if (volume >= 1e6) {
      return (volume / 1e6).toFixed(2) + 'M';
    } else if (volume >= 1e3) {
      return (volume / 1e3).toFixed(2) + 'K';
    } else {
      return volume.toFixed(2);
    }
  }

  // Cleanup method
  destroy() {
    this.stopAutoRefresh();
  }
}

// Initialize market insights when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit to ensure other scripts are loaded
  setTimeout(() => {
    const API_BASE = "https://api.roo7.site";
    const MARKET_DATA_API = "https://api.roo7.site:8002";
    
    window.marketInsights = new MarketInsights(API_BASE, MARKET_DATA_API);
  }, 1000);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.marketInsights) {
    window.marketInsights.destroy();
  }
});