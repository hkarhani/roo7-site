// Landing Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize landing page features
    initReferralCalculator();
    initSmoothScrolling();
    initCTATracking();
});

// Referral Calculator and Messaging
function initReferralCalculator() {
    // Example AUM values for dynamic calculation demos
    const exampleAUMs = [1000, 5000, 10000, 25000, 50000, 100000, 250000];
    
    // Add interactive pricing examples
    addInteractivePricingExamples();
    
    // Add referral savings calculator in hero section
    addHeroReferralCalculator();
}

function addInteractivePricingExamples() {
    const pricingSection = document.getElementById('pricing');
    if (!pricingSection) return;
    
    // Find the pricing examples section
    const pricingExamples = pricingSection.querySelector('.pricing-examples');
    if (!pricingExamples) return;
    
    // Add interactive calculator after examples
    const calculatorHTML = `
        <div class="interactive-calculator" style="margin-top: 2rem; padding: 2rem; background: white; border: 2px solid #059669; border-radius: 12px;">
            <h4>💰 Calculate Your Pricing</h4>
            <div style="margin-bottom: 1rem;">
                <label for="aum-input" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Enter your estimated AUM:</label>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <span style="font-size: 1.2rem; color: #059669; font-weight: 600;">$</span>
                    <input type="number" 
                           id="aum-input" 
                           placeholder="25000" 
                           min="0" 
                           style="flex: 1; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 1rem;"
                           oninput="updatePricingCalculation()">
                </div>
            </div>
            
            <div class="calculation-results" id="calculation-results" style="display: none;">
                <div class="pricing-breakdown" style="background: #f8fafc; padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Base Annual Price:</span>
                        <span id="base-price" style="font-weight: 600; color: #374151;">$0</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: #dc2626;">
                        <span>🎯 With Referral Code:</span>
                        <span id="referral-price" style="font-weight: 600;">$0 (Save $0)</span>
                    </div>
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 0.5rem; margin-top: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #6b7280;">
                            <span>Monthly (with referral):</span>
                            <span id="monthly-price">$0</span>
                        </div>
                    </div>
                </div>
                
                <div class="referral-incentive" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 1rem; border-radius: 8px; border: 2px solid #10b981;">
                    <div style="color: #047857; font-weight: 600; margin-bottom: 0.5rem;">💡 Referral Tip:</div>
                    <div style="color: #065f46; font-size: 0.9rem;">Get a referral code from existing users to save 20% on your subscription!</div>
                </div>
            </div>
        </div>
    `;
    
    pricingExamples.insertAdjacentHTML('afterend', calculatorHTML);
}

function addHeroReferralCalculator() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    
    // Find the CTA button
    const ctaButton = hero.querySelector('.btn-primary');
    if (!ctaButton) return;
    
    // Add referral message before CTA
    const referralMessageHTML = `
        <div class="hero-referral-message" style="background: rgba(5, 150, 105, 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 2rem; border: 2px solid #059669;">
            <div style="color: #047857; font-weight: 600; margin-bottom: 0.5rem;">🎯 Limited Time: 20% OFF with Referral Codes!</div>
            <div style="color: #065f46; font-size: 0.9rem;">Ask existing users for referral codes and save hundreds on your subscription</div>
        </div>
    `;
    
    ctaButton.insertAdjacentHTML('beforebegin', referralMessageHTML);
}

// Update pricing calculation based on user input
function updatePricingCalculation() {
    const aumInput = document.getElementById('aum-input');
    const results = document.getElementById('calculation-results');
    const basePrice = document.getElementById('base-price');
    const referralPrice = document.getElementById('referral-price');
    const monthlyPrice = document.getElementById('monthly-price');
    
    if (!aumInput || !results || !basePrice || !referralPrice || !monthlyPrice) return;
    
    const aum = parseFloat(aumInput.value) || 0;
    
    if (aum <= 0) {
        results.style.display = 'none';
        return;
    }
    
    // Calculate pricing based on the new model
    let annualBase, annualWithReferral, savings;
    
    if (aum < 10000) {
        annualBase = 600;
        annualWithReferral = 500;
        savings = 100;
    } else {
        annualBase = Math.round(aum * 0.072);
        annualWithReferral = Math.round(aum * 0.06);
        savings = annualBase - annualWithReferral;
    }
    
    const monthlyWithReferral = Math.round(annualWithReferral / 12);
    
    // Update display
    basePrice.textContent = `$${annualBase.toLocaleString()}`;
    referralPrice.innerHTML = `$${annualWithReferral.toLocaleString()} <span style="color: #dc2626;">(Save $${savings.toLocaleString()})</span>`;
    monthlyPrice.textContent = `$${monthlyWithReferral.toLocaleString()}`;
    
    results.style.display = 'block';
}

// Smooth scrolling for navigation links
function initSmoothScrolling() {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const headerOffset = 80; // Account for fixed header
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Track CTA button clicks
function initCTATracking() {
    const ctaButtons = document.querySelectorAll('.btn-primary');
    
    ctaButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Track CTA clicks for analytics
            const buttonText = this.textContent.trim();
            const section = this.closest('section')?.className || 'unknown';
            
            console.log(`CTA Click: "${buttonText}" in ${section}`);
            
            // You can add analytics tracking here
            // gtag('event', 'cta_click', { button_text: buttonText, section: section });
        });
    });
}

// Pricing model constants for reference
const PRICING_CONFIG = {
    UNDER_10K: {
        BASE_ANNUAL: 600,
        REFERRAL_ANNUAL: 500,
        SAVINGS: 100
    },
    OVER_10K: {
        BASE_RATE: 0.072,
        REFERRAL_RATE: 0.06,
        SAVINGS_RATE: 0.012
    },
    REFERRAL_COMMISSION_RATE: 0.20
};

// Export for use in other scripts if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updatePricingCalculation, PRICING_CONFIG };
}