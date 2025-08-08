// market-insights-standalone.js - Optimized Market Insights with Toggle

class MarketInsightsStandalone {
  constructor(apiBase, marketDataApi) {
    this.API_BASE = apiBase;
    this.MARKET_DATA_API = marketDataApi;
    this.isLoading = false;
    this.lastUpdateTime = null;
    this.refreshInterval = null;
    this.currentMarketType = 'SPOT'; // Default to SPOT
    this.cachedData = {
      gainers: [],
      losers: [], 
      volume: [],
      majorCoins: []
    };
    
    this.init();
  }

  init() {
    this.checkAuth();
    this.bindEvents();
    this.loadMarketDataOptimized();
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
    // Refresh button
    const refreshBtn = document.getElementById('refresh-market-data');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshMarketData());
    }
    
    // Back button
    const backBtn = document.getElementById('back-to-dashboard');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = '/dashboard.html';
      });
    }

    // Market type toggle buttons
    const spotToggle = document.getElementById('spot-toggle');
    const futuresToggle = document.getElementById('futures-toggle');
    
    if (spotToggle) {
      spotToggle.addEventListener('click', () => this.switchMarketType('SPOT'));
    }
    
    if (futuresToggle) {
      futuresToggle.addEventListener('click', () => this.switchMarketType('FUTURES'));
    }
  }

  switchMarketType(marketType) {
    console.log(`🔄 Switching to ${marketType} market`);
    
    // Update button states
    document.getElementById('spot-toggle').classList.toggle('active', marketType === 'SPOT');
    document.getElementById('futures-toggle').classList.toggle('active', marketType === 'FUTURES');
    
    // Update current market type
    this.currentMarketType = marketType;
    
    // Re-filter and display cached data
    this.updateAllTablesFromCache();
    this.updateAnalyticsFromCache();
  }

  startAutoRefresh() {
    // Auto-refresh every 5 minutes
    this.refreshInterval = setInterval(() => {
      this.loadMarketDataOptimized();
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
      await this.loadMarketDataOptimized(true);
    }
  }

  async loadMarketDataOptimized(isManualRefresh = false) {
    if (this.isLoading) return;

    const token = localStorage.getItem('token');
    if (!token) {
      this.showError('Authentication required to load market data');
      return;
    }

    this.setLoadingState(true);
    this.showLoadingInTables();

    try {
      console.log('📡 Loading market data using existing endpoints...');
      
      // Load all data in parallel but with better error handling
      const promises = [
        this.fetchMarketDataSafe('/top-gainers?limit=20'),
        this.fetchMarketDataSafe('/top-losers?limit=20'),
        this.fetchMarketDataSafe('/top-movers?limit=20'),
        this.fetchMarketDataSafe('/major-coins-movement?limit=20'),
        this.fetchMarketDataSafe('/health', false)
      ];

      const [gainersData, losersData, volumeData, majorCoinsData, healthData] = await Promise.allSettled(promises);

      // Process successful responses
      if (gainersData.status === 'fulfilled' && gainersData.value?.success) {
        this.cachedData.gainers = gainersData.value.data || [];
      }
      
      if (losersData.status === 'fulfilled' && losersData.value?.success) {
        this.cachedData.losers = losersData.value.data || [];
      }
      
      if (volumeData.status === 'fulfilled' && volumeData.value?.success) {
        this.cachedData.volume = volumeData.value.data || [];
      }
      
      if (majorCoinsData.status === 'fulfilled' && majorCoinsData.value?.success) {
        this.cachedData.majorCoins = majorCoinsData.value.data || [];
      }

      // Update tables with filtered data
      this.updateAllTablesFromCache();
      this.updateAnalyticsFromCache();

      // Update market changes (independent of market type)
      if (healthData.status === 'fulfilled') {
        this.updateMarketChanges(healthData.value);
      }

      // Update last updated time
      this.lastUpdateTime = new Date();
      this.updateLastUpdatedTime();

      const successCount = [gainersData, losersData, volumeData, majorCoinsData].filter(
        result => result.status === 'fulfilled'
      ).length;

      console.log(`✅ Loaded ${successCount}/4 market data endpoints successfully`);

      if (isManualRefresh) {
        if (successCount === 4) {
          this.showToast('✅ Market data refreshed successfully!', 'success');
        } else {
          this.showToast(`⚠️ Partially loaded: ${successCount}/4 data sources`, 'warning');
        }
      }

    } catch (error) {
      console.error('❌ Error loading market data:', error);
      this.showError(`Failed to load market data: ${error.message}`);
      
      if (isManualRefresh) {
        this.showToast('❌ Failed to refresh market data', 'error');
      }
    } finally {
      this.setLoadingState(false);
    }
  }

  async fetchMarketDataSafe(endpoint, requireAuth = true) {
    try {
      return await this.fetchMarketData(endpoint, requireAuth);
    } catch (error) {
      console.warn(`⚠️ Failed to load ${endpoint}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  updateAllTablesFromCache() {
    this.updateGainersTableFromCache();
    this.updateLosersTableFromCache();
    this.updateVolumeTableFromCache();
    this.updateMajorCoinsTableFromCache();
  }

  updateGainersTableFromCache() {
    const tbody = document.querySelector('#top-gainers-table tbody');
    if (!tbody) return;

    // Filter by current market type
    const filtered = this.cachedData.gainers.filter(item => 
      item.market_type === this.currentMarketType
    ).slice(0, 10);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="market-loading">No ${this.currentMarketType} gainers available</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(item => `
      <tr>
        <td><strong>${item.symbol}</strong></td>
        <td>${this.formatPrice(item.price)}</td>
        <td><span class="price-change positive">+${item.priceChangePercent.toFixed(2)}%</span></td>
        <td>${this.formatVolume(item.volume)}</td>
        <td><span class="market-badge ${item.market_type.toLowerCase()}">${item.market_type}</span></td>
      </tr>
    `).join('');
  }

  updateLosersTableFromCache() {
    const tbody = document.querySelector('#top-losers-table tbody');
    if (!tbody) return;

    // Filter by current market type
    const filtered = this.cachedData.losers.filter(item => 
      item.market_type === this.currentMarketType
    ).slice(0, 10);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="market-loading">No ${this.currentMarketType} losers available</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(item => `
      <tr>
        <td><strong>${item.symbol}</strong></td>
        <td>${this.formatPrice(item.price)}</td>
        <td><span class="price-change negative">${item.priceChangePercent.toFixed(2)}%</span></td>
        <td><span class="market-badge ${item.market_type.toLowerCase()}">${item.market_type}</span></td>
      </tr>
    `).join('');
  }

  updateVolumeTableFromCache() {
    const tbody = document.querySelector('#top-volume-table tbody');
    if (!tbody) return;

    // Filter by current market type
    const filtered = this.cachedData.volume.filter(item => 
      item.market_type === this.currentMarketType
    ).slice(0, 10);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="market-loading">No ${this.currentMarketType} volume data available</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(item => `
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

  updateMajorCoinsTableFromCache() {
    const tbody = document.querySelector('#major-coins-table tbody');
    if (!tbody) return;

    // Don't filter by market type for Major Coins - show both SPOT and FUTURES
    // Filter out USDTUSDT and sort by market cap or volume
    const filtered = this.cachedData.majorCoins
      .filter(item => item.symbol !== 'USDTUSDT') // Remove USDTUSDT
      .sort((a, b) => {
        // Sort by market cap rank first, then by volume
        if (a.market_cap_rank && b.market_cap_rank) {
          return a.market_cap_rank - b.market_cap_rank;
        } else if (a.market_cap_rank) {
          return -1;
        } else if (b.market_cap_rank) {
          return 1;
        } else {
          return b.volume - a.volume;
        }
      })
      .slice(0, 10);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="market-loading">No major coins data available</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const displayName = item.market_cap_rank ? `${item.symbol} (#${item.market_cap_rank})` : item.symbol;
      
      return `
        <tr>
          <td><strong>${displayName}</strong></td>
          <td>${this.formatPrice(item.price)}</td>
          <td><span class="price-change ${item.priceChangePercent >= 0 ? 'positive' : 'negative'}">
            ${item.priceChangePercent >= 0 ? '+' : ''}${item.priceChangePercent.toFixed(2)}%
          </span></td>
          <td>${this.formatVolume(item.volume)}</td>
          <td>${this.formatMarketCap(item.market_cap)}</td>
        </tr>
      `;
    }).join('');
  }

  updateAnalyticsFromCache() {
    // Combine all cached data for analytics
    const allData = [
      ...this.cachedData.gainers,
      ...this.cachedData.losers,
      ...this.cachedData.volume,
      ...this.cachedData.majorCoins
    ];

    // Filter by current market type and remove duplicates
    const filteredData = allData
      .filter(item => item.market_type === this.currentMarketType)
      .filter((item, index, self) => 
        index === self.findIndex(i => i.symbol === item.symbol)
      );

    // Update top gainer metric
    const topGainer = filteredData
      .filter(item => item.priceChangePercent > 0)
      .sort((a, b) => b.priceChangePercent - a.priceChangePercent)[0];
    
    const topGainerEl = document.getElementById('top-gainer-metric');
    if (topGainerEl) {
      if (topGainer) {
        topGainerEl.textContent = `${topGainer.symbol} (+${topGainer.priceChangePercent.toFixed(2)}%)`;
        topGainerEl.className = 'metric-value positive';
      } else {
        topGainerEl.textContent = `No ${this.currentMarketType} gainers`;
        topGainerEl.className = 'metric-value';
      }
    }

    // Update top loser metric
    const topLoser = filteredData
      .filter(item => item.priceChangePercent < 0)
      .sort((a, b) => a.priceChangePercent - b.priceChangePercent)[0];
    
    const topLoserEl = document.getElementById('top-loser-metric');
    if (topLoserEl) {
      if (topLoser) {
        topLoserEl.textContent = `${topLoser.symbol} (${topLoser.priceChangePercent.toFixed(2)}%)`;
        topLoserEl.className = 'metric-value negative';
      } else {
        topLoserEl.textContent = `No ${this.currentMarketType} losers`;
        topLoserEl.className = 'metric-value';
      }
    }

    // Update highest volume metric
    const highestVolume = filteredData
      .sort((a, b) => b.volume - a.volume)[0];
    
    const highestVolumeEl = document.getElementById('highest-volume-metric');
    if (highestVolumeEl) {
      if (highestVolume) {
        highestVolumeEl.textContent = `${highestVolume.symbol} (${this.formatVolume(highestVolume.volume)})`;
        highestVolumeEl.className = 'metric-value';
      } else {
        highestVolumeEl.textContent = `No ${this.currentMarketType} data`;
        highestVolumeEl.className = 'metric-value';
      }
    }

    // Update market trend
    const marketTrendEl = document.getElementById('market-trend-metric');
    if (marketTrendEl) {
      const gainersCount = filteredData.filter(item => item.priceChangePercent > 0).length;
      const losersCount = filteredData.filter(item => item.priceChangePercent < 0).length;
      
      if (gainersCount > losersCount) {
        marketTrendEl.textContent = `📈 ${this.currentMarketType} Bullish`;
        marketTrendEl.className = 'metric-value positive';
      } else if (losersCount > gainersCount) {
        marketTrendEl.textContent = `📉 ${this.currentMarketType} Bearish`;
        marketTrendEl.className = 'metric-value negative';
      } else {
        marketTrendEl.textContent = `↔️ ${this.currentMarketType} Neutral`;
        marketTrendEl.className = 'metric-value';
      }
    }
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

  updateLastUpdatedTime() {
    const lastUpdatedEl = document.getElementById('last-updated');
    if (lastUpdatedEl && this.lastUpdateTime) {
      const timeStr = this.lastUpdateTime.toLocaleTimeString();
      lastUpdatedEl.textContent = `Last updated: ${timeStr} (${this.currentMarketType})`;
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
        refreshBtn.textContent = '🔄 Loading...';
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
        tbody.innerHTML = `<tr><td colspan="${table.cols}" class="market-loading">Loading ${this.currentMarketType} data...</td></tr>`;
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

  formatMarketCap(marketCap) {
    if (!marketCap || marketCap === 0) {
      return 'N/A';
    }
    
    if (marketCap >= 1e12) {
      return '

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Set styles individually to avoid string literal issues
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.padding = '15px 20px';
    toast.style.borderRadius = '6px';
    toast.style.color = 'white';
    toast.style.fontWeight = '600';
    toast.style.zIndex = '10000';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'transform 0.3s ease';
    
    if (type === 'success') {
      toast.style.background = '#28a745';
    } else if (type === 'error') {
      toast.style.background = '#dc3545';
    } else if (type === 'warning') {
      toast.style.background = '#ffc107';
      toast.style.color = '#212529';
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
}); + (marketCap / 1e12).toFixed(2) + 'T';
    } else if (marketCap >= 1e9) {
      return '

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
    } else if (type === 'warning') {
      toast.style.background = '#ffc107';
      toast.style.color = '#212529';
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
}); + (marketCap / 1e9).toFixed(2) + 'B';
    } else if (marketCap >= 1e6) {
      return '

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
    } else if (type === 'warning') {
      toast.style.background = '#ffc107';
      toast.style.color = '#212529';
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
}); + (marketCap / 1e6).toFixed(2) + 'M';
    } else if (marketCap >= 1e3) {
      return '

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
    } else if (type === 'warning') {
      toast.style.background = '#ffc107';
      toast.style.color = '#212529';
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
}); + (marketCap / 1e3).toFixed(2) + 'K';
    } else {
      return '

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
    } else if (type === 'warning') {
      toast.style.background = '#ffc107';
      toast.style.color = '#212529';
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
}); + marketCap.toFixed(2);
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
    } else if (type === 'warning') {
      toast.style.background = '#ffc107';
      toast.style.color = '#212529';
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