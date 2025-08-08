// market-insights-standalone.js - Dedicated Market Insights Page

class MarketInsightsStandalone {
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
    this.checkAuth();
    this.bindEvents();
    this.loadMarketDataSequentially();
    this.startAutoRefresh();
  }

  checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log("❌ No token found, redirecting to auth...");
      setTimeout(() => {
        window.location.href = "/auth.html";
      }, 2000);
      return;
    }
  }

  bindEvents() {
    const refreshBtn = document.getElementById('refresh-market-data');
    const backBtn = document.getElementById('back-to-dashboard');
    
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshMarketData());
    }
    
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = '/dashboard.html';
      });
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
    this.showLoadingInTables();

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
            await this.delay(200);
          }
          
        } catch (error) {
          console.error(`❌ Error loading ${item.name}:`, error);
          this.showSingleTableError(item.handler, `Failed to load ${item.name}`);
        }
      }

      // Update analytics after all data is loaded
      this.updateAnalytics();

      // Update last updated time
      this.lastUpdateTime = new Date();
      this.updateLastUpdatedTime();

      if (isManualRefresh) {
        this.showToast('✅ Market data refreshed successfully!', 'success');
      }

    } catch (error) {
      console.error('❌ Error in sequential loading:', error);
      
      if (isManualRefresh) {
        this.showToast('❌ Failed to refresh market data', 'error');
      }
    } finally {
      this.setLoadingState(false);
    }
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

    const majorCoins = majorCoinsData.data.slice(0, 10);

    if (majorCoins.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="market-loading">No major coins data available</td></tr>';
      return;
    }

    tbody.innerHTML = majorCoins.map((item, index) => {
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

      if (newInstrumentsEl) {
        newInstrumentsEl.textContent = 'Available in next update';
        newInstrumentsEl.className = 'change-value';
      }

      if (removedInstrumentsEl) {
        removedInstrumentsEl.textContent = 'Available in next update';
        removedInstrumentsEl.className = 'change-value';
      }
    } else {
      [newInstrumentsEl, removedInstrumentsEl, totalInstrumentsEl].forEach(el => {
        if (el) {
          el.textContent = 'Error loading data';
          el.className = 'change-value negative';
        }
      });
    }
  }

  updateAnalytics() {
    // Update top gainer metric
    const gainersTable = document.querySelector('#top-gainers-table tbody');
    const topGainerEl = document.getElementById('top-gainer-metric');
    if (gainersTable && topGainerEl) {
      const firstRow = gainersTable.querySelector('tr:first-child');
      if (firstRow && !firstRow.querySelector('.market-loading')) {
        const symbol = firstRow.querySelector('td:first-child strong')?.textContent;
        const change = firstRow.querySelector('.price-change')?.textContent;
        if (symbol && change) {
          topGainerEl.textContent = `${symbol} (${change})`;
          topGainerEl.className = 'metric-value positive';
        }
      }
    }

    // Update top loser metric
    const losersTable = document.querySelector('#top-losers-table tbody');
    const topLoserEl = document.getElementById('top-loser-metric');
    if (losersTable && topLoserEl) {
      const firstRow = losersTable.querySelector('tr:first-child');
      if (firstRow && !firstRow.querySelector('.market-loading')) {
        const symbol = firstRow.querySelector('td:first-child strong')?.textContent;
        const change = firstRow.querySelector('.price-change')?.textContent;
        if (symbol && change) {
          topLoserEl.textContent = `${symbol} (${change})`;
          topLoserEl.className = 'metric-value negative';
        }
      }
    }

    // Update highest volume metric
    const volumeTable = document.querySelector('#top-volume-table tbody');
    const highestVolumeEl = document.getElementById('highest-volume-metric');
    if (volumeTable && highestVolumeEl) {
      const firstRow = volumeTable.querySelector('tr:first-child');
      if (firstRow && !firstRow.querySelector('.market-loading')) {
        const symbol = firstRow.querySelector('td:first-child strong')?.textContent;
        const volume = firstRow.querySelector('td:nth-child(4)')?.textContent;
        if (symbol && volume) {
          highestVolumeEl.textContent = `${symbol} (${volume})`;
          highestVolumeEl.className = 'metric-value';
        }
      }
    }

    // Update market trend
    const marketTrendEl = document.getElementById('market-trend-metric');
    if (marketTrendEl) {
      // Simple trend calculation based on gainers vs losers
      const gainersCount = document.querySelectorAll('#top-gainers-table tbody tr:not(:has(.market-loading))').length;
      const losersCount = document.querySelectorAll('#top-losers-table tbody tr:not(:has(.market-loading))').length;
      
      if (gainersCount > 0 || losersCount > 0) {
        if (gainersCount > losersCount) {
          marketTrendEl.textContent = '📈 Bullish';
          marketTrendEl.className = 'metric-value positive';
        } else if (losersCount > gainersCount) {
          marketTrendEl.textContent = '📉 Bearish';
          marketTrendEl.className = 'metric-value negative';
        } else {
          marketTrendEl.textContent = '↔️ Neutral';
          marketTrendEl.className = 'metric-value';
        }
      }
    }

    // Update major coins performance
    this.updateMajorCoinsPerformance();
  }

  updateMajorCoinsPerformance() {
    const performanceContainer = document.getElementById('major-coins-performance');
    const majorCoinsTable = document.querySelector('#major-coins-table tbody');
    
    if (!performanceContainer || !majorCoinsTable) return;

    const rows = majorCoinsTable.querySelectorAll('tr:not(:has(.market-loading))');
    
    if (rows.length === 0) {
      performanceContainer.innerHTML = '<div class="loading-text">No major coins data available</div>';
      return;
    }

    const performanceItems = Array.from(rows).slice(0, 5).map(row => {
      const symbol = row.querySelector('td:first-child strong')?.textContent || '';
      const change = row.querySelector('.price-change')?.textContent || '';
      const isPositive = row.querySelector('.price-change')?.classList.contains('positive');
      
      return `
        <div class="performance-item">
          <span class="performance-symbol">${symbol}</span>
          <span class="performance-change ${isPositive ? 'positive' : 'negative'}">${change}</span>
        </div>
      `;
    }).join('');

    performanceContainer.innerHTML = performanceItems;
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

    // Show loading in analytics
    const analyticsElements = [
      'top-gainer-metric',
      'top-loser-metric',
      'highest-volume-metric',
      'market-trend-metric'
    ];

    analyticsElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = 'Loading...';
        el.className = 'metric-value loading';
      }
    });

    const performanceContainer = document.getElementById('major-coins-performance');
    if (performanceContainer) {
      performanceContainer.innerHTML = '<div class="loading-text">Loading major coins performance...</div>';
    }
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

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 6px;
      color: white;
      font-weight: 600;
      z-index: 10000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    
    if (type === 'success') {
      toast.style.background = '#28a745';
    } else if (type === 'error') {
      toast.style.background = '#dc3545';
    } else {
      toast.style.background = '#17a2b8';
    }
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.style.transform = 'translateX(0)', 100);
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  destroy() {
    this.stopAutoRefresh();
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = "https://api.roo7.site";
  const MARKET_DATA_API = "https://api.roo7.site:8002";
  
  window.marketInsights = new MarketInsightsStandalone(API_BASE, MARKET_DATA_API);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.marketInsights) {
    window.marketInsights.destroy();
  }
});