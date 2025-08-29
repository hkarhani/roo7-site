/**
 * Admin Auth-API Logs Management Interface
 * =======================================
 * 
 * Handles viewing, filtering, and managing auth-api service logs.
 * Supports both enhanced JSON logs and standard system logs with color coding.
 */

import { API_URL } from './frontend-config.js';
const backendBaseUrl = API_URL;

class LogsManager {
  constructor() {
    this.currentLogFile = null;
    this.currentPage = 0;
    this.pageSize = 100;
    this.currentFilters = {
      level: '',
      search: '',
      lines: 100
    };
    this.autoRefreshInterval = null;
    this.autoRefreshEnabled = false;
    
    this.init();
  }

  getAuthHeaders() {
    const token = localStorage.getItem("token");
    if (!token) {
      console.error("❌ No token available for API call");
      throw new Error("Authentication token not available");
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async init() {
    await this.checkAuthentication();
    this.setupEventListeners();
    await this.loadLogFilesList();
    await this.loadLogsSummary();
  }

  async checkAuthentication() {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("❌ No token found, redirecting to auth...");
      setTimeout(() => {
        window.location.href = "/auth.html";
      }, 2000);
      return;
    }

    try {
      // Get current user info to verify admin status (same as admin dashboard)
      const response = await fetch(`${backendBaseUrl}/me`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        console.log("❌ Token verification failed, redirecting to auth...");
        localStorage.removeItem("token");
        setTimeout(() => {
          window.location.href = "/auth.html";
        }, 2000);
        return;
      }

      const userData = await response.json();
      
      // Check if user is admin
      if (!userData.is_admin) {
        console.log("❌ Access denied. Admin privileges required.");
        alert('Access denied. Admin privileges required.');
        setTimeout(() => {
          window.location.href = "/auth.html";
        }, 2000);
        return;
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      setTimeout(() => {
        window.location.href = "/auth.html";
      }, 2000);
    }
  }

  setupEventListeners() {
    // Navigation
    document.getElementById('back-to-dashboard').onclick = () => {
      window.location.href = 'admin-dashboard.html';
    };

    document.getElementById('logout-btn').onclick = () => {
      localStorage.removeItem("token");
      window.location.href = "/auth.html";
    };

    // Actions
    document.getElementById('refresh-summary').onclick = () => {
      this.loadLogFilesList();
      this.loadLogsSummary();
      if (this.currentLogFile) {
        this.loadLogFile(this.currentLogFile);
      }
    };

    document.getElementById('clear-all-logs').onclick = () => {
      this.showConfirmation(
        'Clear All Logs',
        'Are you sure you want to clear ALL log files? This action cannot be undone.',
        () => this.clearAllLogs()
      );
    };

    // Filters and controls
    document.getElementById('apply-filters').onclick = () => {
      this.applyFilters();
    };

    document.getElementById('clear-current-log').onclick = () => {
      if (!this.currentLogFile) {
        alert('Please select a log file first.');
        return;
      }
      
      this.showConfirmation(
        'Clear Log File',
        `Are you sure you want to clear ${this.currentLogFile}? This action cannot be undone.`,
        () => this.clearLogFile(this.currentLogFile)
      );
    };

    // Pagination
    document.getElementById('prev-page').onclick = () => {
      if (this.currentPage > 0) {
        this.currentPage--;
        this.loadLogFile(this.currentLogFile);
      }
    };

    document.getElementById('next-page').onclick = () => {
      this.currentPage++;
      this.loadLogFile(this.currentLogFile);
    };

    // Auto-refresh
    document.getElementById('auto-refresh-toggle').onchange = (e) => {
      this.autoRefreshEnabled = e.target.checked;
      this.toggleAutoRefresh();
    };

    // Filter shortcuts
    document.getElementById('level-filter').onchange = () => {
      this.currentFilters.level = document.getElementById('level-filter').value;
    };

    document.getElementById('search-filter').oninput = () => {
      this.currentFilters.search = document.getElementById('search-filter').value;
    };

    document.getElementById('lines-limit').onchange = () => {
      this.currentFilters.lines = parseInt(document.getElementById('lines-limit').value);
    };

    // Enter key for search
    document.getElementById('search-filter').onkeypress = (e) => {
      if (e.key === 'Enter') {
        this.applyFilters();
      }
    };

    // Modal handlers
    document.getElementById('cancel-action').onclick = () => {
      document.getElementById('confirmation-modal').style.display = 'none';
    };

    // Close modal on background click
    document.getElementById('confirmation-modal').onclick = (e) => {
      if (e.target === document.getElementById('confirmation-modal')) {
        document.getElementById('confirmation-modal').style.display = 'none';
      }
    };
  }

  async loadLogFilesList() {
    try {
      const response = await fetch(`${backendBaseUrl}/admin/logs/files`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const files = await response.json();
      this.renderLogFilesList(files);
    } catch (error) {
      console.error('Failed to load log files:', error);
      document.getElementById('log-files-list').innerHTML = `
        <div class="error-state">
          <p>Failed to load log files</p>
          <p style="font-size: 12px;">${error.message}</p>
        </div>
      `;
    }
  }

  async loadLogsSummary() {
    try {
      const response = await fetch(`${backendBaseUrl}/admin/logs/summary`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const summary = await response.json();
      document.getElementById('logs-summary').innerHTML = `
        ${summary.total_files} files • ${summary.total_size_mb} MB
      `;
    } catch (error) {
      console.error('Failed to load logs summary:', error);
      document.getElementById('logs-summary').innerHTML = 'Summary unavailable';
    }
  }

  renderLogFilesList(files) {
    const container = document.getElementById('log-files-list');
    
    if (files.length === 0) {
      container.innerHTML = '<div class="empty-state">No log files found</div>';
      return;
    }

    container.innerHTML = files.map(filename => {
      const isEnhanced = this.isEnhancedLogFile(filename);
      const isActive = filename === this.currentLogFile;
      
      return `
        <div class="log-file-item ${isActive ? 'active' : ''}" 
             onclick="logsManager.selectLogFile('${filename}')"
             data-filename="${filename}">
          <div class="log-file-name">
            ${isEnhanced ? '📊' : '📄'} ${filename}
          </div>
          <div class="log-file-info" id="info-${filename}">
            ${isEnhanced ? 'Enhanced JSON' : 'Standard'} • Loading...
          </div>
        </div>
      `;
    }).join('');

    // Load file info asynchronously
    files.forEach(filename => this.loadFileInfo(filename));
  }

  async loadFileInfo(filename) {
    try {
      const response = await fetch(`${backendBaseUrl}/admin/logs/files/${filename}/info`, {
        headers: this.getAuthHeaders()
      });

      if (response.ok) {
        const info = await response.json();
        const infoElement = document.getElementById(`info-${filename}`);
        if (infoElement) {
          const isEnhanced = this.isEnhancedLogFile(filename);
          infoElement.innerHTML = `
            ${isEnhanced ? 'Enhanced JSON' : 'Standard'} • ${info.size_mb} MB
          `;
        }
      }
    } catch (error) {
      console.error(`Failed to load info for ${filename}:`, error);
    }
  }

  isEnhancedLogFile(filename) {
    const enhancedFiles = [
      'active_jobs.log', 'spot_jobs.log', 'futures_jobs.log',
      'sync_audit.log', 'job_execution.log'
    ];
    return enhancedFiles.includes(filename);
  }

  async selectLogFile(filename) {
    // Update UI
    document.querySelectorAll('.log-file-item').forEach(item => {
      item.classList.remove('active');
    });
    
    document.querySelector(`[data-filename="${filename}"]`).classList.add('active');
    
    this.currentLogFile = filename;
    this.currentPage = 0;
    
    // Update header
    document.getElementById('current-log-title').textContent = filename;
    
    await this.loadLogFile(filename);
    
    // Show pagination controls
    document.getElementById('log-pagination').style.display = 'flex';
  }

  async loadLogFile(filename) {
    if (!filename) return;

    const container = document.getElementById('log-entries');
    container.innerHTML = '<div class="loading-state">Loading log entries...</div>';

    try {
      const params = new URLSearchParams({
        lines: this.currentFilters.lines.toString(),
        offset: (this.currentPage * this.currentFilters.lines).toString()
      });

      if (this.currentFilters.level) {
        params.append('level', this.currentFilters.level);
      }

      if (this.currentFilters.search) {
        params.append('search', this.currentFilters.search);
      }

      const response = await fetch(`${backendBaseUrl}/admin/logs/files/${filename}?${params}`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.renderLogEntries(data);
      this.updatePagination(data);
      this.updateFileMetadata(data.file_info, data.is_enhanced);

    } catch (error) {
      console.error('Failed to load log file:', error);
      
      // Check if it's an authentication error
      if (error.message.includes("Authentication token not available") || 
          error.message.includes("401") || 
          error.message.includes("403")) {
        console.log("❌ Authentication error when loading log file, redirecting to auth...");
        setTimeout(() => {
          window.location.href = "/auth.html";
        }, 2000);
        return;
      }
      
      container.innerHTML = `
        <div class="error-state">
          <h3>Failed to load log file</h3>
          <p>${error.message}</p>
          <button onclick="logsManager.loadLogFile('${filename}')" class="retry-btn">🔄 Retry</button>
        </div>
      `;
    }
  }

  renderLogEntries(data) {
    const container = document.getElementById('log-entries');
    
    if (data.entries.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No log entries found</h3>
          <p>Try adjusting your filters or check if the log file has content</p>
        </div>
      `;
      return;
    }

    const entriesHtml = data.entries.map(entry => {
      const entryClass = data.is_enhanced ? 'enhanced-log' : 'standard-log';
      const levelClass = entry.level || 'INFO';
      
      let entryContent = '';
      
      if (data.is_enhanced) {
        // Enhanced JSON log format
        entryContent = `
          <div class="log-timestamp">${this.formatTimestamp(entry.timestamp)}</div>
          <div class="log-level">${levelClass}</div>
          ${entry.logger ? `<div class="log-logger">[${entry.logger}]</div>` : ''}
          <div class="log-message">${this.escapeHtml(entry.message)}</div>
          ${entry.data ? `<div class="log-data"><pre>${JSON.stringify(entry.data, null, 2)}</pre></div>` : ''}
          ${entry.exception ? `<div class="log-data exception"><pre>${JSON.stringify(entry.exception, null, 2)}</pre></div>` : ''}
        `;
      } else {
        // Standard log format
        entryContent = `
          ${entry.timestamp ? `<div class="log-timestamp">${entry.timestamp}</div>` : ''}
          <div class="log-level">${levelClass}</div>
          ${entry.logger ? `<div class="log-logger">[${entry.logger}]</div>` : ''}
          <div class="log-message">${this.escapeHtml(entry.message)}</div>
        `;
      }
      
      return `
        <div class="log-entry ${levelClass} ${entryClass}">
          ${entryContent}
        </div>
      `;
    }).join('');

    container.innerHTML = entriesHtml;
    container.scrollTop = 0;
  }

  updatePagination(data) {
    const info = document.getElementById('pagination-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    const startEntry = (this.currentPage * this.currentFilters.lines) + 1;
    const endEntry = Math.min(startEntry + data.entries.length - 1, data.filtered_lines);

    info.textContent = `Showing ${startEntry}-${endEntry} of ${data.filtered_lines} filtered entries (${data.total_lines} total)`;

    prevBtn.disabled = this.currentPage === 0;
    nextBtn.disabled = !data.has_more;
  }

  updateFileMetadata(fileInfo, isEnhanced) {
    const metaElement = document.getElementById('log-file-meta');
    metaElement.innerHTML = `
      ${isEnhanced ? 'Enhanced JSON Format' : 'Standard Log Format'} • 
      ${fileInfo.size_mb} MB • 
      Modified: ${this.formatTimestamp(fileInfo.modified)}
    `;
  }

  applyFilters() {
    this.currentPage = 0;
    if (this.currentLogFile) {
      this.loadLogFile(this.currentLogFile);
    }
  }

  async clearLogFile(filename) {
    try {
      const response = await fetch(`${backendBaseUrl}/admin/logs/files/${filename}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      alert(`✅ ${result.message}`);
      
      // Reload the current log file and summary
      await this.loadLogFile(filename);
      await this.loadLogsSummary();
      await this.loadFileInfo(filename);

    } catch (error) {
      console.error('Failed to clear log file:', error);
      alert(`❌ Failed to clear log file: ${error.message}`);
    }
  }

  async clearAllLogs() {
    try {
      const response = await fetch(`${backendBaseUrl}/admin/logs/clear-all`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      alert(`✅ ${result.message} - ${result.total_cleared_mb} MB cleared`);
      
      // Reload everything
      await this.loadLogFilesList();
      await this.loadLogsSummary();
      
      if (this.currentLogFile) {
        await this.loadLogFile(this.currentLogFile);
      }

    } catch (error) {
      console.error('Failed to clear all logs:', error);
      alert(`❌ Failed to clear all logs: ${error.message}`);
    }
  }

  toggleAutoRefresh() {
    const indicator = document.getElementById('refresh-indicator');
    
    if (this.autoRefreshEnabled) {
      indicator.classList.remove('inactive');
      this.autoRefreshInterval = setInterval(() => {
        if (this.currentLogFile) {
          this.loadLogFile(this.currentLogFile);
        }
        this.loadLogsSummary();
      }, 30000); // 30 seconds
    } else {
      indicator.classList.add('inactive');
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = null;
      }
    }
  }

  showConfirmation(title, message, onConfirm) {
    document.getElementById('confirmation-title').textContent = title;
    document.getElementById('confirmation-message').textContent = message;
    document.getElementById('confirmation-modal').style.display = 'flex';
    
    document.getElementById('confirm-action').onclick = () => {
      document.getElementById('confirmation-modal').style.display = 'none';
      onConfirm();
    };
  }

  formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return timestamp; // Return original if parsing fails
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the logs manager when DOM is loaded
let logsManager;
document.addEventListener('DOMContentLoaded', () => {
  logsManager = new LogsManager();
  // Make it available globally for onclick handlers
  window.logsManager = logsManager;
});