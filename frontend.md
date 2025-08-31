# ROO7 Trading Platform - User Guide

Welcome to ROO7, your professional cryptocurrency trading automation platform. This guide covers all user-facing features and workflows.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [User Dashboard](#user-dashboard)
4. [Account Management](#account-management)
5. [Trading Strategies](#trading-strategies)
6. [Analytics & Insights](#analytics--insights)
7. [Support Features](#support-features)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Platform Access
- **Website**: https://roo7.site
- **Landing Page**: https://roo7.site/index.html
- **Dashboard**: https://roo7.site/dashboard.html

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Stable internet connection
- Valid cryptocurrency exchange account (Binance supported)

### First Time Setup
1. Visit the landing page to learn about features
2. Click "Get Started" to begin registration
3. Create your account with username, email, and password
4. Verify your email address
5. Complete Cloudflare security verification
6. Access your dashboard

---

## Authentication

### Registration Flow
**Page**: `auth.html`

1. **Create Account**:
   - Enter unique username
   - Provide valid email address
   - Create secure password
   - Complete Cloudflare Turnstile verification
   - Submit registration form

2. **Email Verification**:
   - Check email for verification link
   - Click verification link
   - Account becomes active

3. **Login Access**:
   - Use username and password
   - Complete security verification
   - Access dashboard

### Login Options

#### Standard Login
- Username and password authentication
- Cloudflare Turnstile security verification
- Automatic redirect to dashboard on success

#### Magic Link Login
- Click "Send Magic Link" button
- Check email for secure login link
- Click link to login without password
- Useful for password-free access

#### Password Recovery
- Click "Forgot Password?" button
- Enter your email address
- Check email for reset instructions
- Create new secure password

### Security Features
- **Cloudflare Turnstile**: Advanced bot protection
- **Email Verification**: Required for account activation
- **Secure Tokens**: JWT-based authentication
- **Session Management**: Automatic logout on token expiry

---

## User Dashboard

**Page**: `dashboard.html`

### Dashboard Layout

#### Header Section
- **Welcome Message**: Displays your full name
- **Subscription Status**: Shows active subscription info
- **Navigation Buttons**:
  - 📄 Invoices: Access billing and payments
  - 🎯 Referrals: Manage referral system
  - 📊 Market Insights: View market data
  - 🔧 Admin: Admin access (if authorized)
  - Toggle Theme: Switch light/dark mode
  - Logout: End session

#### Main Dashboard Grid

**Live Accounts Section** (Top Left)
- View all connected exchange accounts
- Account details: Name, Exchange, Type, Strategy, Value, Status
- Add new accounts with "+" button
- Manage existing accounts

**Strategy Management Section** (Top Right)
- Available trading strategies overview
- Strategy assignment and management
- Portfolio customization options
- Strategy performance metrics

**Trading Analytics Section** (Bottom)
- Real-time portfolio value charts
- Period selection: 7 days, 30 days, 90 days, 1 year
- Account filtering options
- Performance statistics and trends

### Key Features

#### Real-time Updates
- Account values refresh automatically
- Strategy status updates
- Live analytics data
- System notifications

#### Responsive Design
- Mobile-optimized interface
- Touch-friendly controls
- Adaptive layouts for all screen sizes

---

## Account Management

### Adding New Accounts

1. **Open Account Modal**:
   - Click "+ Add New Account" button
   - Account creation modal opens

2. **Account Details**:
   - **Account Name**: Choose descriptive name
   - **Exchange**: Select exchange (currently Binance)
   - **Account Type**: Choose SPOT or FUTURES
   - **API Credentials**: Enter exchange API key and secret

3. **API Key Setup** (Binance Example):
   - Log into Binance account
   - Go to API Management
   - Create new API key
   - Enable "Enable Spot & Margin Trading"
   - Copy API Key and Secret Key
   - Paste into ROO7 form

4. **Security Notes**:
   - API keys are encrypted and stored securely
   - Never share API keys with others
   - Use IP restrictions on exchange side
   - Disable withdrawal permissions

### Account Configuration

#### Exchange Settings
- **Supported Exchanges**: Binance (more coming soon)
- **Account Types**: 
  - SPOT: For spot trading
  - FUTURES: For futures trading (coming soon)

#### Account Status
- **Active**: Account ready for trading
- **Disabled**: Temporarily suspended
- **Revoked**: Access removed, liquidation pending

### Account Actions

#### Hedge Management
- Set hedge percentage (0-100%)
- Automatic USDT allocation
- Risk management controls

#### Strategy Assignment
- Assign trading strategies to accounts
- Customize portfolio allocations
- Set rebalancing frequency

#### Account Settings
- Enable/disable accounts
- Update API credentials
- Modify account parameters

---

## Trading Strategies

### Available Strategies

#### Pre-configured Strategies
- **HRR (High Risk Return)**: Aggressive trading approach
- **MRR (Medium Risk Return)**: Balanced trading strategy
- **LRR (Low Risk Return)**: Conservative trading approach

#### Custom Portfolio
- **Custom Portfolio**: Build your own asset allocation
- **Custom Portfolio Rebalance**: Custom strategy with rebalancing

### Strategy Assignment

1. **Select Account**: Choose target account
2. **Choose Strategy**: Pick from available options
3. **Configure Parameters**:
   - Portfolio composition
   - Asset weights
   - Risk settings
4. **Apply Strategy**: Confirm and activate

### Custom Portfolio Creation

#### SPOT Trading Assets
- **Single Assets**: BTC, ETH, XRP, ADA, DOT, etc.
- **USDT Pairs**: BTCUSDT, ETHUSDT, XRPUSDT, etc.
- **Asset Validation**: Real-time validation against Binance symbols

#### Portfolio Configuration
- **Asset Selection**: Choose from validated symbols
- **Weight Allocation**: Set percentage allocations
- **Total Validation**: Ensure weights sum to 100%
- **Minimum Requirements**: Meet exchange minimums

### Strategy Management

#### Monitoring
- Real-time strategy performance
- Asset allocation tracking
- Rebalancing notifications
- Performance analytics

#### Modifications
- Update asset weights
- Add/remove assets
- Change rebalancing frequency
- Strategy switching

---

## Analytics & Insights

### Trading Analytics

#### Portfolio Performance
- **Current Value**: Real-time portfolio worth
- **Period Change**: Value change over selected period
- **Percentage Change**: Performance percentage
- **Historical Charts**: Value trends over time

#### Chart Features
- **Interactive Charts**: Hover for detailed data points
- **Time Periods**: 7D, 30D, 90D, 1Y selection
- **Account Filtering**: View all accounts or individual
- **Adaptive Scaling**: Automatic chart scaling
- **Responsive Design**: Works on all devices

### Market Insights

**Page**: `market-insights.html`

#### Available Data
- Top cryptocurrency gainers/losers
- Market trend analysis
- Trading volume insights
- Price movement patterns

#### Data Sources
- Real-time market data
- Professional trading indicators
- Market sentiment analysis

---

## Support Features

### Invoices Management

**Page**: `invoices.html`

#### Features
- View all invoices and payments
- Download invoice PDFs
- Track payment status
- Request new invoices
- Auto-troubleshoot integration

#### Invoice Process
1. **Request Invoice**: Click request button
2. **Auto-troubleshoot**: System validates accounts
3. **Pricing Calculation**: Based on portfolio values
4. **Invoice Generation**: PDF and payment details
5. **Payment Processing**: Follow payment instructions

### Referrals Program

**Page**: `referrals.html`

#### Referral System
- **Generate Codes**: Create unique referral codes
- **Share Links**: Send to potential users
- **Track Earnings**: Monitor commission earned
- **Payment Status**: View referral payments

#### Benefits
- Earn commission on referrals
- Help others discover automated trading
- Build passive income stream

---

## Troubleshooting

### Account Issues

#### Common Problems

**API Connection Errors**:
- Verify API key and secret are correct
- Check API key permissions on exchange
- Ensure IP whitelist includes ROO7 servers
- Confirm API key is not expired

**Account Not Loading**:
- Check internet connection
- Refresh page (Ctrl+F5)
- Clear browser cache
- Try different browser

**Strategy Not Working**:
- Verify account has sufficient balance
- Check strategy configuration
- Review minimum trade requirements
- Contact support if issues persist

#### Troubleshoot Tool

**Page**: `troubleshoot.html`

- **Account Validation**: Test API connectivity
- **Balance Verification**: Confirm account balances
- **Trading Permissions**: Verify API permissions
- **Error Diagnosis**: Identify connection issues

### Login Issues

**Cannot Login**:
- Verify username and password
- Complete Cloudflare verification
- Check email for verification link
- Use "Forgot Password" if needed

**Magic Link Not Working**:
- Check spam/junk folder
- Ensure email address is correct
- Try standard login instead
- Request new magic link

**Session Expired**:
- Login again with credentials
- Check "Remember Me" option
- Clear browser data if persistent

### Performance Issues

**Slow Loading**:
- Check internet connection
- Clear browser cache
- Disable browser extensions
- Try incognito/private mode

**Charts Not Loading**:
- Enable JavaScript in browser
- Allow external content
- Check ad blocker settings
- Refresh page

### Getting Help

#### Support Resources
- **Email Support**: support@roo7.site
- **Documentation**: This guide
- **FAQ**: Common questions answered
- **System Status**: Check service availability

#### When Contacting Support
- Describe the issue clearly
- Include error messages
- Mention browser and OS
- Provide account username (not password)
- Include steps to reproduce issue

---

## Best Practices

### Security
- Never share your login credentials
- Use strong, unique passwords
- Enable two-factor authentication on exchanges
- Regularly review API key permissions
- Monitor account activity regularly

### Trading
- Start with small amounts
- Diversify across strategies
- Monitor performance regularly
- Understand risks involved
- Keep learning about markets

### Account Management
- Keep API keys secure
- Update credentials if compromised
- Use descriptive account names
- Regular balance verification
- Maintain sufficient trading balances

---

## Glossary

**API Key**: Authentication credential for exchange access
**SPOT Trading**: Direct cryptocurrency buying/selling
**Hedge**: Risk management cash allocation
**Portfolio**: Collection of trading assets and weights
**Rebalancing**: Adjusting asset allocations periodically
**Strategy**: Automated trading approach/algorithm
**Troubleshoot**: Diagnostic tool for account issues
**USDT**: USD Tether, stable cryptocurrency
**Magic Link**: Password-free login method

---

*Last Updated: December 2024*
*Version: 1.0*

For technical support, contact: support@roo7.site