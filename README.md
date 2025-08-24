# ROO7 Frontend Documentation

## Overview

The ROO7 frontend is a modern, responsive web application for cryptocurrency trading account management. Built with vanilla JavaScript, HTML5, and CSS3, it provides a comprehensive dashboard for managing trading accounts, strategies, and portfolios across multiple exchanges.

## Architecture

### Technology Stack
- **Frontend Framework**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 with Flexbox/Grid
- **Authentication**: JWT tokens with Bearer authentication
- **API Communication**: Fetch API with async/await
- **Theme Support**: Light/Dark theme switching
- **Responsive Design**: Mobile-first approach

### File Structure
```
roo7-site/
├── index.html              # Landing page
├── auth.html               # Login/Registration page
├── dashboard.html          # Main dashboard
├── dashboard.js            # Dashboard logic and API calls
├── dashboard-modal.js      # Modal management and form handling
├── dashboard.css           # Dashboard styles and responsive design
├── auth.css               # Authentication page styles
├── styles.css             # Global styles
├── theme-manager.js       # Theme switching functionality
├── invoices.html          # Invoice management page
├── invoices.js            # Invoice functionality
├── invoices.css           # Invoice page styles
├── referrals.html         # Referral system page
├── referrals.js           # Referral functionality
├── referrals.css          # Referral page styles
├── market-insights.html   # Market data and insights
├── market-insights.css    # Market insights styles
├── market-insights-standalone.js # Market data functionality
├── troubleshoot.html      # Account troubleshooting page
├── troubleshoot.js        # Troubleshooting functionality
├── troubleshoot.css       # Troubleshooting styles
├── pie-chart.js           # Chart visualization utilities
└── logo.svg               # ROO7 logo
```

## Core Features

### 1. Authentication System
- **JWT-based Authentication**: Secure token-based login system
- **User Registration**: Email verification required
- **Magic Link Login**: Passwordless authentication option
- **Password Reset**: Secure token-based password recovery
- **Session Management**: Automatic token refresh and logout

### 2. Dashboard Overview
The main dashboard provides four key sections with a separated account and strategy management workflow:

#### Live Accounts Table
- Real-time account status and values
- Exchange and account type display
- Strategy assignment information
- Account health indicators
- Quick action buttons (Edit, Settings, Troubleshoot, Assign Strategy)

#### Account Settings Panel
- Account management controls (CRUD operations only)
- Add new account functionality (without strategy selection)
- Account enable/disable toggles
- API credential management

#### Strategy Management Section
- Available strategies overview and summary
- Strategy assignment and customization interface
- 1-to-1 account-strategy mapping management
- Real-time strategy status tracking

#### Trading Analytics (Coming Soon)
- Strategy performance comparison
- Trade execution analytics
- Custom reporting tools

### 3. Separated Account and Strategy Management

The ROO7 frontend now features a completely separated workflow that distinguishes between account creation/management and strategy assignment/customization.

#### Account Management (Independent)
- **Exchange Support**: Currently Binance (extensible for future exchanges)
- **Account Types**: SPOT and FUTURES trading support
- **Account Creation**: Pure account setup without strategy selection
- **Account CRUD Operations**: Add, edit, troubleshoot, and delete accounts independently
- **API Credential Management**: Secure handling of exchange API keys

#### Strategy Management (Separate Workflow)
- **Strategy Assignment Modal**: Dedicated interface for strategy assignment
- **1-to-1 Mapping**: Each account can have only one strategy at a time
- **Dynamic Strategy Loading**: Strategies loaded and filtered by exchange and account type
- **Strategy Customization**: Post-assignment parameter configuration

#### Workflow Separation Benefits
- **Clear Separation of Concerns**: Account setup vs strategy selection
- **Flexible Management**: Modify accounts without affecting strategies
- **Better User Experience**: Focused workflows for specific tasks
- **Scalable Architecture**: Easy to extend with new exchanges and strategies

#### Dynamic Strategy System
The frontend supports a completely dynamic strategy system with separated assignment:

##### Available Strategies:
1. **High Risk / High Returns Long SPOT**
   - Aggressive growth strategy for maximum returns
   - Configurable top X instruments (0-50)
   - Default: Algorithm-selected instruments

2. **Medium Risk / Medium Returns Long SPOT**
   - Balanced growth with moderate risk
   - Configurable top X instruments (0-30)
   - Steady return expectations

3. **Low Risk / Low Returns Fixed Income**
   - Conservative strategy for stable returns
   - Configurable top X instruments (0-20)
   - Weekly rebalancing default

4. **Custom Portfolio Rebalance**
   - Fully customizable asset allocation
   - Default: BTC (50%), ETH (30%), XRP (20%)
   - Manual symbol and weight configuration

#### Strategy Parameters
Each strategy supports dynamic parameters:
- **Top X Count**: Instrument selection (0 = algorithm default)
- **Rebalance Frequency**: hourly, daily, weekly, or monthly
- **Custom Instruments**: Symbol and weight arrays for custom portfolios

### 4. Advanced Portfolio Management

#### Custom Portfolio Features
- **API-driven Defaults**: Default allocations loaded from backend strategy configuration
- **Real-time Validation**: Live weight validation and feedback
- **Symbol Validation**: Integration with market data service for symbol verification
- **Portfolio Balance Checking**: Ensures weights sum to exactly 100%
- **Visual Feedback**: Color-coded validation messages

#### Portfolio Validation Rules
- **Total Weight**: Must equal 100% (±0.01% tolerance)
- **Symbol Format**: Must end with 'USDT' for SPOT trading
- **Weight Limits**: Individual weights between 0.01% and 100%
- **Duplicate Prevention**: Each symbol can only be used once
- **Real-time Feedback**: Instant validation with visual indicators

### 5. Account Troubleshooting
- **Comprehensive API Testing**: 9-stage validation process
- **Real-time Diagnostics**: Network, credentials, and permissions testing
- **Portfolio Value Updates**: Automatic USDT value calculation
- **Detailed Error Reporting**: Specific recommendations for issue resolution

## Technical Implementation

### Modal Management System

#### ModalManager Class
The enhanced `ModalManager` class handles all modal interactions with separated account and strategy workflows:

```javascript
class ModalManager {
  constructor(apiBase, marketDataApi) {
    // Initialize API endpoints and DOM elements
    this.API_BASE = apiBase;
    this.MARKET_DATA_API = marketDataApi;
    this.availableStrategies = [];
    this.currentStrategyConfig = null;
    this.currentStrategyAccountId = null;
  }
}
```

#### Key Methods:
- `openAddAccountModal()`: Account creation without strategy selection
- `openEditAccountModal()`: Account editing without strategy modification
- `openStrategyModal()`: Dedicated strategy assignment interface
- `loadStrategies()`: Fetches available strategies from API
- `updateStrategyOptions()`: Filters strategies by exchange/account type
- `showStrategyParameters()`: Dynamically renders strategy-specific controls
- `validatePortfolio()`: Real-time portfolio validation for custom strategies
- `submitAccount()`: Pure account submission without strategy data
- `assignStrategy()`: Separate strategy assignment and customization
- `removeStrategy()`: Strategy removal from accounts

### Separated Workflow Implementation

#### Account Creation Flow:
1. User clicks "Add New Account"
2. Account modal opens with exchange and account type selection
3. User enters account credentials and basic information
4. Account is created without strategy assignment
5. User receives notification about strategy assignment in separate workflow

#### Strategy Assignment Flow:
1. User clicks "Assign Strategy" button for a specific account
2. Strategy modal opens with account information pre-filled
3. Frontend loads available strategies filtered by account's exchange/type
4. User selects strategy and configures parameters
5. Strategy is assigned to the account with 1-to-1 mapping enforcement

#### API Integration:
```javascript
// Load strategies from backend
const response = await fetch(`${this.API_BASE}/strategies`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Filter by exchange and account type
const filteredStrategies = strategies.filter(strategy => 
  strategy.exchange === selectedExchange && 
  strategy.account_type === selectedAccountType
);
```

### Portfolio Validation System

#### Real-time Validation:
```javascript
validatePortfolio() {
  let totalWeight = 0;
  let hasErrors = false;
  
  // Validate each instrument
  instrumentRows.forEach(row => {
    const symbol = symbolInput.value.trim();
    const weight = parseFloat(weightInput.value) || 0;
    
    // Symbol validation
    if (!symbol || !symbol.endsWith('USDT')) {
      hasErrors = true;
    }
    
    // Weight validation
    if (weight <= 0 || weight > 100) {
      hasErrors = true;
    }
    
    totalWeight += weight;
  });
  
  // Total weight validation
  const isValidTotal = Math.abs(totalWeight - 100) < 0.01;
  
  return !hasErrors && isValidTotal;
}
```

### Form Submission Enhancement

#### Account Creation Data Structure:
```javascript
// Account creation (no strategy data)
const accountData = {
  account_name: accountName,
  exchange: this.exchangeSelect.value,
  account_type: this.accountTypeSelect.value,
  exchange_api_key: apiKey,
  exchange_api_secret: apiSecret
};
```

#### Strategy Assignment Data Structure:
```javascript
// Strategy assignment (separate from account)
const strategyData = {
  account_id: accountId,
  strategy: this.strategySelect.value,
  top_x_count: topXValue,                   // Dynamic parameter
  rebalance_frequency: frequencyValue,      // Strategy parameter
  custom_portfolio: portfolioArray          // Validated portfolio (if custom)
};
```

## Responsive Design

### Mobile-First Approach
- **Breakpoints**: 768px (tablet), 1200px (desktop)
- **Flexible Layouts**: Flexbox and CSS Grid
- **Touch-Friendly**: Optimized button sizes and spacing
- **Adaptive Navigation**: Collapsible menus and actions

### Theme Support
- **Light Theme**: Default professional appearance
- **Dark Theme**: Reduced eye strain for extended use
- **System Preference**: Automatic theme detection
- **Persistent Choice**: Theme preference stored in localStorage

## API Integration

### Authentication
```javascript
// JWT token management
const token = localStorage.getItem("token");
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

### Error Handling
```javascript
// Comprehensive error handling
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
} catch (error) {
  console.error('API Error:', error);
  window.showToast('Operation failed. Please try again.', 'error');
}
```

### Toast Notification System
```javascript
window.showToast = function(message, type = 'info', duration = 4000) {
  // Creates dismissible toast notifications
  // Types: 'info', 'success', 'warning', 'error'
};
```

## Security Features

### Input Validation
- **Client-side Validation**: Immediate feedback and error prevention
- **Server-side Verification**: Backend validation for all submissions
- **XSS Prevention**: Input sanitization and proper encoding
- **CSRF Protection**: Token-based request validation

### Credential Management
- **API Key Security**: Optional credential reuse for multiple accounts
- **Secure Storage**: No permanent credential storage in frontend
- **Token Expiration**: Automatic session management

## Performance Optimizations

### Lazy Loading
- **Symbol Validation**: Market data loaded only when needed
- **Strategy Loading**: Fetched once and cached
- **Image Optimization**: Optimized assets and icons

### Caching Strategy
- **Local Storage**: User preferences and session data
- **Memory Caching**: Strategy configurations and symbol lists
- **API Response Caching**: Reduced redundant requests

## Development Guidelines

### Code Structure
```javascript
// Modern JavaScript patterns
async function handleOperation() {
  try {
    const result = await apiCall();
    updateUI(result);
  } catch (error) {
    handleError(error);
  }
}
```

### CSS Organization
```css
/* Component-based styling */
.component-name {
  /* Base styles */
}

.component-name__element {
  /* Element styles */
}

.component-name--modifier {
  /* Modifier styles */
}
```

### Event Handling
```javascript
// Efficient event delegation
element.addEventListener('event', (e) => {
  e.preventDefault();
  handleEvent(e);
});
```

## Testing and Debugging

### Browser Console Integration
- **Comprehensive Logging**: Detailed operation tracking
- **Error Reporting**: Clear error messages and stack traces
- **Performance Monitoring**: API response timing

### Validation Testing
- **Portfolio Validation**: Real-time testing of weight calculations
- **Symbol Verification**: Market data service integration testing
- **API Connectivity**: Comprehensive troubleshooting tools

## Future Enhancements

### Planned Features
1. **Multi-Exchange Support**: Coinbase, Kraken, Bybit integration
2. **Advanced Analytics**: Portfolio performance tracking
3. **Risk Management**: Advanced risk metrics and alerts
4. **Mobile App**: React Native mobile application
5. **Real-time Updates**: WebSocket integration for live data

### Scalability Considerations
- **Modular Architecture**: Easy addition of new exchanges and strategies
- **Component Reusability**: Shared components across pages
- **API Versioning**: Future-proof API integration
- **Internationalization**: Multi-language support framework

## Deployment

### Build Process
1. **Asset Optimization**: CSS and JavaScript minification
2. **Image Compression**: Optimized graphics and icons
3. **Cache Headers**: Proper HTTP caching configuration
4. **CDN Integration**: Content delivery optimization

### Production Configuration
- **HTTPS Enforcement**: Secure communication only
- **CSP Headers**: Content Security Policy implementation
- **Error Monitoring**: Production error tracking
- **Performance Monitoring**: Real user monitoring (RUM)

## Support and Maintenance

### Monitoring
- **Error Tracking**: Client-side error reporting
- **Performance Metrics**: Page load and API response times
- **User Analytics**: Usage patterns and feature adoption

### Maintenance Tasks
- **Dependency Updates**: Regular library and framework updates
- **Security Patches**: Prompt vulnerability remediation
- **Feature Deprecation**: Graceful removal of outdated features
- **Documentation Updates**: Continuous documentation maintenance

This documentation provides a comprehensive overview of the ROO7 frontend application, covering all aspects from architecture to deployment. The enhanced account management system with dynamic strategy loading and real-time portfolio validation represents a significant advancement in trading account management capabilities.