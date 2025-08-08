// market-insights.js - Market Data Insights

class MarketInsights {
  constructor(apiBase, marketDataApi) {
    this.API_BASE = apiBase;
    this.MARKET_DATA_API = marketDataApi;
    this.isLoading = false;
    this.lastUpdateTime = null;
    this.refreshInterval = null;
    this.loadingOrder = [
      { endpoint: '/top-gainers?limit=10', handler: 'updateGainersTable', name: 'Top Gainers' },
      { endpoint: '/top-losers?limit=10', handler: 'updateLosersTable', name: 'Top Losers' },
      { endpoint: '/top-movers?limit=10', handler: 'updateVolumeTable', name: 'Top Volume' },
      { endpoint: '/major-coins-movement?limit=10', handler: 'updateMajorCoinsTable', name: 'Major Coins' },
      { endpoint: '/health', handler: 'updateMarketChanges', name: 'Market Changes', requireAuth: false }
    ];
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadMarketDataSequentially();
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
      this.loadMarketDataSequentially();
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
      await this.loadMarketDataSequentially(true);
    }
  }

  async loadMarketDataSequentially(isManualRefresh = false) {
    if (this.isLoading) return;

    const token = localStorage.getItem('token');
    if (!token) {
      this.showError('Authentication required to load market data');
      return;
    }

    this.setLoadingState(true);
    this.showLoadingInTables(); // Show initial loading state

    try {
      // Load data sequentially with progress updates
      for (let i = 0; i < this.loadingOrder.length; i++) {
        const item = this.loadingOrder[i];
        
        try {
          console.log(`📡 Loading ${item.name}...`);
          const data = await this.fetchMarketData(item.endpoint, item.requireAuth !== false);
          
          // Update the specific table immediately
          this[item.handler](data);
          
          // Update progress
          this.updateLoadingProgress(item.name, i + 1, this.loadingOrder.length);
          
          // Small delay between requests to prevent overwhelming the API
          if (i < this.loadingOrder.length - 1) {
            await this.delay(200); // 200ms delay between requests
          }
          
        } catch (error) {
          console.error(`❌ Error loading ${item.name}:`, error);
          this.showSingleTableError(item.handler, `Failed to load ${item.name}`);
        }
      }

      // Update last updated time
      this.lastUpdateTime = new Date();
      this.updateLastUpdatedTime();

      if (isManualRefresh) {
        window.showToast('✅ Market data refreshed successfully!', 'success');
      }

    } catch (error) {
      console.error('❌ Error in sequential loading:', error);
      
      if (isManualRefresh) {
        window.showToast('❌ Failed to refresh market data', 'error');
      }
    } finally {
      this.setLoadingState(false);
    }
  }

  async loadMarketData(isManualRefresh = false) {
    // Fallback to parallel loading if needed
    return this.loadMarketDataSequentially(isManualRefresh);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateLoadingProgress(currentItem, completed, total) {
    const refreshBtn = document.getElementById('refresh-market-data');
    if (refreshBtn) {
      refreshBtn.textContent = `🔄 Loading ${currentItem}... (${completed}/${total})`;
    }
  }

  showSingleTableError(handlerName, message) {
    // Map handler names to table selectors and column counts
    const tableMap = {
      'updateGainersTable': { selector: '#top-gainers-table tbody', cols: 5 },
      'updateLosersTable': { selector: '#top-losers-table tbody', cols: 4 },
      'updateVolumeTable': { selector: '#top-volume-table tbody', cols: 5 },
      'updateMajorCoinsTable': { selector: '#major-coins-table tbody', cols: 5 }
    };

    const tableInfo = tableMap[handlerName];
    if (tableInfo) {
      const tbody = document.querySelector(tableInfo.selector);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${tableInfo.cols}" class="market-error">${message}</td></tr>`;
      }
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
      tbody.innerHTML = '<tr><td colspan="4" class="market-loading">No data available</td></tr>';
      return;
    }

    const losers = losersData.data.slice(0, 10);
    tbody.innerHTML = losers.map(item => `
      <tr>
        <td><strong>${item.symbol}</strong></td>
        <td>${this.formatPrice(item.price)}</td>
        <td><span class="price-change negative">${item.priceChangePercent.toFixed(2)}%</span></td>
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

  updateMajorCoinsTable(majorCoinsData) {
    const tbody = document.querySelector('#major-coins-table tbody');
    if (!tbody) return;

    if (!majorCoinsData || !majorCoinsData.success || !majorCoinsData.data) {
      tbody.innerHTML = '<tr><td colspan="5" class="market-loading">No data available</td></tr>';
      return;
    }

    // Updated: Use the new API response format for major coins movement
    const majorCoins = majorCoinsData.data.slice(0, 10);

    if (majorCoins.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="market-loading">No major coins data available</td></tr>';
      return;
    }

    tbody.innerHTML = majorCoins.map((item, index) => {
      // Fixed: Show only symbol with rank, no coin name to prevent spacing issues
      const displayName = item.market_cap_rank ? `${item.symbol} (#${item.market_cap_rank})` : item.symbol;
      
      return `
        <tr>
          <td><strong>${displayName}</strong></td>
          <td>${this.formatPrice(item.price)}</td>
          <td><span class="price-change ${item.priceChangePercent >= 0 ? 'positive' : 'negative'}">
            ${item.priceChangePercent >= 0 ? '+' : ''}${item.priceChangePercent.toFixed(2)}%
          </span></td>
          <td>${this.formatVolume(item.volume)}</td>
          <td>
            <span class="market-badge ${item.market_type.toLowerCase()}">${item.market_type}</span>
          </td>
        </tr>
      `;
    }).join('');
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
      if (!isLoading) {
        refreshBtn.textContent = '🔄 Refresh';
        refreshBtn.style.opacity = '1';
      } else {
        refreshBtn.style.opacity = '0.6';
      }
    }

    // Show loading state in tables if this is the first load
    if (isLoading && !this.lastUpdateTime) {
      this.showLoadingInTables();
    }
  }

  showLoadingInTables() {
    const tables = [
      { selector: '#top-gainers-table tbody', cols: 5 },
      { selector: '#top-losers-table tbody', cols: 4 },
      { selector: '#top-volume-table tbody', cols: 5 },
      { selector: '#major-coins-table tbody', cols: 5 }
    ];

    tables.forEach(table => {
      const tbody = document.querySelector(table.selector);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${table.cols}" class="market-loading">Loading market data...</td></tr>`;
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
      { selector: '#top-gainers-table tbody', cols: 5 },
      { selector: '#top-losers-table tbody', cols: 4 },
      { selector: '#top-volume-table tbody', cols: 5 },
      { selector: '#major-coins-table tbody', cols: 5 }
    ];

    tables.forEach(table => {
      const tbody = document.querySelector(table.selector);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${table.cols}" class="market-error">${message}</td></tr>`;
      }
    });
  }

  formatPrice(price) {
    if (price >= 1000) {
      // Add commas for prices >= 1000
      return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    } else if (price >= 1) {
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