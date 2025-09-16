/**
 * FRONTEND BRAND & DOMAIN CONFIGURATION
 * 
 * This is the single source of truth for all frontend branding and domain configurations.
 * Update these values to rebrand your entire platform.
 * 
 * IMPORTANT: After changing these values, you'll need to:
 * 1. Update all HTML/JS files to import and use this config
 * 2. Update CORS settings in backend services
 * 3. Update DNS and SSL certificates for new domains
 */

// =============================================================================
// BRAND CONFIGURATION
// =============================================================================

export const BRAND_CONFIG = {
    // Core Brand Identity
    name: "ROO7",
    fullName: "ROO7 Automated Trading Platform",
    tagline: "Professional Cryptocurrency Trading Automation",
    description: "Advanced AI-powered trading bot platform for cryptocurrency markets",
    
    // Visual Identity
    logo: {
        primary: "/assets/logo-primary.png",
        secondary: "/assets/logo-secondary.png",
        favicon: "/assets/favicon.ico",
        colors: {
            primary: "#3498db",
            secondary: "#2c3e50",
            accent: "#27ae60",
            warning: "#f39c12",
            danger: "#e74c3c",
            success: "#27ae60"
        }
    },
    
    // Brand Messaging
    messaging: {
        welcome: "Welcome to ROO7 Automated Trading Platform",
        subtitle: "Your journey to professional trading automation starts here",
        supportTeam: "ROO7 Support Team",
        partnership: "ROO7 partner",
        success: "Welcome to Automated Trading Success!",
        heroTitle: "Professional Cryptocurrency Trading Automation",
        heroSubtitle: "Advanced AI-powered trading strategies for maximum returns",
        getStarted: "Start Trading Now",
        learnMore: "Learn More"
    }
};

// =============================================================================
// DOMAIN CONFIGURATION
// =============================================================================

export const DOMAIN_CONFIG = {
    // Primary Domains
    primary: "roo7.site",
    api: "api.roo7.site",
    www: "www.roo7.site",
    
    // Development/Testing Domains
    dev: "dev.roo7.site",
    staging: "staging.roo7.site",
    
    // Additional Allowed Domains (for development)
    additional: [
        "github.io",
        "localhost",
        "127.0.0.1"
    ],
    
    // Protocol Configuration
    protocol: "https",
    
    // Port Configuration
    ports: {
        api: "8003",        // invoicing-api
        auth: "443",        // auth-api
        market: "8002",     // market-data-service
        // jobs: removed - now using auth-api endpoints for jobs KPIs
        frontend: "443"
    }
};

// =============================================================================
// API CONFIGURATION
// =============================================================================

export const API_CONFIG = {
    // Base URLs - auth-api on port 443, others as configured
    baseUrl: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.api}:443`,  // explicit port 443
    authUrl: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.api}:443`,  // explicit port 443
    invoicingUrl: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.api}:${DOMAIN_CONFIG.ports.api}`,
    marketUrl: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.api}:${DOMAIN_CONFIG.ports.market}`,
    // jobsUrl: removed - now using auth-api for jobs endpoints
    
    // Endpoints
    endpoints: {
        // Authentication
        login: "/login",
        register: "/register",
        logout: "/logout",
        
        // User Management
        profile: "/users/me",
        updateProfile: "/users/update",
        
        // Subscriptions
        subscribe: "/subscribe",
        mySubscription: "/subscriptions/me",
        activateSubscription: "/subscriptions/activate",
        validatePortfolio: "/subscriptions/validate-portfolio",
        
        // Invoices
        myInvoices: "/invoices/me",
        invoice: "/invoices",
        requestInvoice: "/invoices/request",  // NEW: Request invoice with auto-troubleshoot
        calculatePricing: "/invoices/calculate-pricing",  // NEW: Calculate pricing with referral
        
        // Referrals
        myReferrals: "/referrals/me",
        generateReferralCode: "/referrals/generate-code",
        validateReferralCode: "/referrals/validate-code",
        
        // Wallet
        walletInfo: "/wallet/info",
        updateWallet: "/wallet/update",
        
        // Market Data
        marketData: "/market/data",
        analytics: "/market/analytics",
        topMovers: "/market/top-movers",
        
        // Accounts
        accounts: "/accounts",
        troubleshoot: "/troubleshoot",
        
        // Admin Endpoints
        admin: {
            dashboard: "/admin/dashboard/summary",
            activity: "/admin/dashboard/activity",
            tierUpgrades: "/admin/tier-upgrades/pending",
            scanTiers: "/admin/tier-upgrades/scan",
            invoices: "/admin/invoices",
            referrals: "/admin/referrals",
            users: "/admin/users/search"
        },
        
        // Jobs Analytics Endpoints (now via auth-api)
        jobsAnalytics: {
            kpis: "/admin/analytics/jobs-kpis"
        }
    }
};

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export const FEATURE_FLAGS = {
    // NEW: Invoice system features
    newInvoiceFlow: true,         // Enable new invoice request flow
    autoTroubleshoot: true,       // Enable automatic account troubleshooting
    enhancedPricing: true,        // Enable enhanced pricing with proper referral discounts
    
    // UI/UX Features
    duplicateButtonFix: true,     // Fix duplicate validate buttons
    progressiveEnhancement: true, // Enable progressive enhancement
    
    // Development/Testing
    debugMode: false,             // Enable debug logging
    simulateAutoTroubleshoot: true, // Use simulation for auto-troubleshoot
    
    // Rollout Control
    enableForAllUsers: true,      // Enable new features for all users
    enableForBetaUsers: true,     // Enable new features for beta users only
    
    // Backward Compatibility
    preserveOldFlow: true,        // Keep old flow available during transition
    showFeatureToggles: false     // Show feature toggle controls in UI
};

// =============================================================================
// EMAIL CONFIGURATION
// =============================================================================

export const EMAIL_CONFIG = {
    // Support Email
    support: `support@${DOMAIN_CONFIG.primary}`,
    admin: `admin@${DOMAIN_CONFIG.primary}`,
    info: `info@${DOMAIN_CONFIG.primary}`,
    noreply: `noreply@${DOMAIN_CONFIG.primary}`,
    
    // Email Templates
    templates: {
        subjects: {
            activation: `🎉 ${BRAND_CONFIG.name} Subscription Activation Request Received`,
            approved: `🎉 Trading Bot Activated - Welcome to ${BRAND_CONFIG.name}!`,
            commission: `🎉 Referral Commission Earned`,
            adminNotification: `🔔 New Subscription Activation`
        }
    }
};

// =============================================================================
// PAGE CONFIGURATION
// =============================================================================

export const PAGE_CONFIG = {
    // Page URLs
    pages: {
        home: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}`,
        dashboard: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}/dashboard.html`,
        invoices: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}/invoices.html`,
        referrals: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}/referrals.html`,
        admin: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}/admin.html`,
        auth: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}/auth.html`,
        troubleshoot: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}/troubleshoot.html`,
        marketInsights: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}/market-insights.html`,
        landing: `${DOMAIN_CONFIG.protocol}://${DOMAIN_CONFIG.primary}/index.html`
    },
    
    // Page Titles
    titles: {
        home: `${BRAND_CONFIG.name} - ${BRAND_CONFIG.tagline}`,
        dashboard: `${BRAND_CONFIG.name} Dashboard`,
        invoices: `${BRAND_CONFIG.name} Invoices`,
        referrals: `${BRAND_CONFIG.name} Referrals`,
        admin: `${BRAND_CONFIG.name} Admin Dashboard`,
        admin_accounts: `${BRAND_CONFIG.name} Account Management`,
        auth: `${BRAND_CONFIG.name} Login`,
        troubleshoot: `${BRAND_CONFIG.name} Account Troubleshoot`,
        marketInsights: `${BRAND_CONFIG.name} Market Insights`,
        landing: `${BRAND_CONFIG.name} - ${BRAND_CONFIG.tagline}`
    }
};

// =============================================================================
// TIER CONFIGURATION
// =============================================================================

export const TIER_CONFIG = {
    tier1: {
        name: "Tier 1",
        displayName: "Starter",
        limit: 10000,
        price: 1000,
        discountPrice: 500,
        description: "Perfect for beginners",
        color: "#27ae60",
        features: [
            "Portfolio up to $10,000",
            "Basic trading strategies",
            "24/7 automated trading",
            "Email support"
        ]
    },
    tier2: {
        name: "Tier 2", 
        displayName: "Professional",
        limit: 100000,
        percentage: 0.08,
        description: "For serious traders",
        color: "#f39c12",
        features: [
            "Portfolio up to $100,000",
            "Advanced trading strategies",
            "Priority support",
            "Advanced analytics"
        ]
    },
    tier3: {
        name: "Tier 3",
        displayName: "Enterprise", 
        limit: null,
        custom: true,
        description: "Custom solutions",
        color: "#e74c3c",
        features: [
            "Unlimited portfolio",
            "Custom strategies",
            "Dedicated support",
            "White-label solutions"
        ]
    }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export const CONFIG_UTILS = {
    // Generate CORS regex pattern for backend
    generateCorsRegex: () => {
        const domains = [DOMAIN_CONFIG.primary, ...DOMAIN_CONFIG.additional];
        const escapedDomains = domains.map(domain => domain.replace(/\./g, '\\.'));
        return `^https:\\/\\/([a-zA-Z0-9-]+\\.)?(${escapedDomains.join('|')})$`;
    },
    
    // Get full API URL - all endpoints now route to auth-api
    getApiUrl: (endpoint = '') => {
        // All endpoints now route to auth-api
        return `${API_CONFIG.baseUrl}${endpoint}`;
    },
    
    // Get page URL
    getPageUrl: (page) => {
        return PAGE_CONFIG.pages[page] || PAGE_CONFIG.pages.home;
    },
    
    // Get brand color
    getBrandColor: (colorName) => {
        return BRAND_CONFIG.logo.colors[colorName] || BRAND_CONFIG.logo.colors.primary;
    },
    
    // Check if domain is allowed
    isDomainAllowed: (domain) => {
        const allowedDomains = [
            DOMAIN_CONFIG.primary,
            DOMAIN_CONFIG.api,
            DOMAIN_CONFIG.www,
            DOMAIN_CONFIG.dev,
            DOMAIN_CONFIG.staging,
            ...DOMAIN_CONFIG.additional
        ];
        return allowedDomains.some(allowed => 
            domain === allowed || domain.endsWith(`.${allowed}`)
        );
    },
    
    // Format currency
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(amount);
    },
    
    // Get tier info
    getTierInfo: (tierName) => {
        return TIER_CONFIG[tierName] || TIER_CONFIG.tier1;
    }
};

// =============================================================================
// LEGACY EXPORTS (for backward compatibility)
// =============================================================================

// Export API_URL for legacy frontend compatibility  
export const API_URL = API_CONFIG.authUrl;

// Make configuration available globally for compatibility with existing frontend files
window.BRAND_CONFIG = BRAND_CONFIG;
window.DOMAIN_CONFIG = DOMAIN_CONFIG;
window.API_CONFIG = API_CONFIG;
window.EMAIL_CONFIG = EMAIL_CONFIG;
window.PAGE_CONFIG = PAGE_CONFIG;
window.TIER_CONFIG = TIER_CONFIG;
window.CONFIG_UTILS = CONFIG_UTILS;

// =============================================================================
// EXPORT DEFAULT CONFIGURATION
// =============================================================================

export default {
    BRAND_CONFIG,
    DOMAIN_CONFIG,
    API_CONFIG,
    EMAIL_CONFIG,
    PAGE_CONFIG,
    TIER_CONFIG,
    CONFIG_UTILS,
    API_URL: API_CONFIG.authUrl  // Also include in default export for compatibility
};

// =============================================================================
// REBRANDING CHECKLIST
// =============================================================================

/*
TO REBRAND TO A NEW PLATFORM:

1. UPDATE THIS FILE:
   - Change BRAND_CONFIG.name from "ROO7" to your new brand
   - Update DOMAIN_CONFIG.primary to your new domain
   - Update all messaging and colors
   
2. UPDATE BACKEND CONFIG:
   - Update backend-config.py with matching values
   - Restart all backend services
   
3. UPDATE DNS & SSL:
   - Point new domain to your servers
   - Update SSL certificates
   
4. UPDATE FRONTEND FILES:
   - Ensure all HTML/JS files import this config
   - Replace hardcoded references with config values
   
5. UPDATE DEPLOYMENT:
   - Update docker-compose.yml environment variables
   - Update any CI/CD pipelines
   
6. TEST THOROUGHLY:
   - Test all API endpoints
   - Test email delivery
   - Test CORS functionality
   - Test admin functions
*/