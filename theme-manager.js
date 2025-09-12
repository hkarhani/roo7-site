// theme-manager.js - Global Theme Management System

class ThemeManager {
  constructor() {
    this.STORAGE_KEY = 'roo7_theme_preference';
    this.DARK_CLASS = 'dark-theme'; // For dashboard pages
    this.DARK_MODE_CLASS = 'dark-mode'; // For auth page
    this.init();
  }

  init() {
    // Apply saved theme immediately on page load
    this.applySavedTheme();
    
    // Listen for theme changes from other tabs/windows
    window.addEventListener('storage', (e) => {
      if (e.key === this.STORAGE_KEY) {
        this.applySavedTheme();
        console.log('🎨 Theme updated from another tab');
      }
    });
  }

  // Get current theme preference from localStorage
  getThemePreference() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    return saved === 'dark';
  }

  // Save theme preference to localStorage
  saveThemePreference(isDark) {
    localStorage.setItem(this.STORAGE_KEY, isDark ? 'dark' : 'light');
    console.log('💾 Theme preference saved:', isDark ? 'dark' : 'light');
  }

  // Apply the saved theme to the current page
  applySavedTheme() {
    const isDark = this.getThemePreference();
    const body = document.body;
    
    // Detect page type and apply appropriate class
    if (this.isAuthPage()) {
      // Auth page uses 'dark-mode' class
      if (isDark) {
        body.classList.add(this.DARK_MODE_CLASS);
      } else {
        body.classList.remove(this.DARK_MODE_CLASS);
      }
    } else {
      // Dashboard/troubleshoot pages use 'dark-theme' class
      if (isDark) {
        body.classList.add(this.DARK_CLASS);
      } else {
        body.classList.remove(this.DARK_CLASS);
      }
    }
    
    console.log('🎨 Theme applied:', isDark ? 'dark' : 'light');
  }

  // Toggle theme and save preference
  toggleTheme() {
    const currentlyDark = this.getThemePreference();
    const newTheme = !currentlyDark;
    
    // Save new preference
    this.saveThemePreference(newTheme);
    
    // Apply new theme
    this.applySavedTheme();
    
    console.log('🔄 Theme toggled to:', newTheme ? 'dark' : 'light');
    return newTheme;
  }

  // Detect if this is the auth page
  isAuthPage() {
    return (document.body && document.body.classList.contains('auth-page')) || 
           document.querySelector('.auth-container') !== null ||
           window.location.pathname.includes('auth.html');
  }

  // Set up theme toggle button (call this for each page)
  setupToggleButton(buttonSelector = '#toggle-theme') {
    const toggleBtn = document.querySelector(buttonSelector);
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggleTheme();
      });
      console.log('🔘 Theme toggle button setup complete');
    } else {
      console.warn('⚠️ Theme toggle button not found:', buttonSelector);
    }
  }

  // Force set theme (useful for testing or admin functions)
  setTheme(isDark) {
    this.saveThemePreference(isDark);
    this.applySavedTheme();
  }

  // Get current theme state
  isDarkTheme() {
    return this.getThemePreference();
  }
}

// Create global instance
window.themeManager = new ThemeManager();

// Auto-setup for common button selectors when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Try to find and setup toggle buttons with common IDs
  const commonSelectors = ['#toggle-theme', '#theme-toggle', '.theme-toggle'];
  
  for (const selector of commonSelectors) {
    const btn = document.querySelector(selector);
    if (btn) {
      window.themeManager.setupToggleButton(selector);
      break; // Only setup one button per page
    }
  }
});