/**
 * Frontend Logging Utility
 * Provides controlled logging for browser console
 */
class Logger {
  constructor() {
    // Check if we're in development mode
    this.isDevelopment = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.search.includes('debug=true');
    
    // Log level configuration (can be overridden via localStorage)
    this.logLevel = localStorage.getItem('logLevel') || (this.isDevelopment ? 'debug' : 'error');
    
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  setLevel(level) {
    this.logLevel = level;
    localStorage.setItem('logLevel', level);
  }

  shouldLog(level) {
    return this.levels[level] >= this.levels[this.logLevel];
  }

  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message, ...args) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  // Business event logging (always visible in production)
  business(event, details = null) {
    const message = details ? `🏢 ${event} - ${details}` : `🏢 ${event}`;
    console.log(message);
  }

  // Client operation logging (always visible)
  client(operation, clientInfo, result) {
    console.log(`👤 CLIENT: ${operation} for ${clientInfo} - ${result}`);
  }

  // Security event logging (always visible and prominent)
  security(event, details = null) {
    const message = details ? `🚨 SECURITY: ${event} - ${details}` : `🚨 SECURITY: ${event}`;
    console.error(message);
  }
}

// Create global logger instance
window.logger = new Logger();

// Export Logger class for ES6 module imports
export { Logger };
export default new Logger();

// Usage examples in comments:
// logger.debug('Loading data from API...'); // Only shows in development
// logger.info('Data loaded successfully'); // Shows in development and info+ levels
// logger.warn('API response delayed'); // Shows in warn+ levels
// logger.error('Failed to load data'); // Always shows
// logger.business('USER_LOGIN', 'john@example.com'); // Always shows
// logger.client('LOGIN', 'john@example.com', 'Success'); // Always shows
// logger.security('FAILED_LOGIN_ATTEMPT', 'IP: 192.168.1.1'); // Always shows prominently

// Development helpers
if (window.logger.isDevelopment) {
  console.log('🛠️ Frontend Logger initialized in development mode');
  console.log('💡 Available commands:');
  console.log('  - logger.setLevel("debug|info|warn|error")');
  console.log('  - Current level:', window.logger.logLevel);
}