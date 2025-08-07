/**
 * Reusable Pie Chart Module
 * 
 * A lightweight, dependency-free pie chart component for displaying 
 * portfolio asset allocations with interactive features.
 * 
 * Features:
 * - SVG-based rendering for crisp graphics
 * - Interactive hover effects
 * - Responsive design
 * - Customizable colors and styling
 * - Legend with percentages
 * - Mobile-friendly touch interactions
 * 
 * @author ROO7 System
 * @version 1.0.0
 */

class PieChart {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    
    // Default options
    this.options = {
      width: options.width || 300,
      height: options.height || 300,
      radius: options.radius || 120,
      showLegend: options.showLegend !== false, // Default true
      legendPosition: options.legendPosition || 'right', // 'right', 'bottom', 'left', 'top'
      showTooltip: options.showTooltip !== false, // Default true
      showPercentages: options.showPercentages !== false, // Default true
      minSlicePercentage: options.minSlicePercentage || 1, // Minimum percentage to show separately
      colors: options.colors || [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
      ],
      animationDuration: options.animationDuration || 600,
      className: options.className || 'pie-chart',
      title: options.title || null
    };
    
    this.data = [];
    this.svgElement = null;
    this.tooltip = null;
    
    this.initializeChart();
  }
  
  initializeChart() {
    // Clear container
    this.container.innerHTML = '';
    this.container.className = `${this.options.className}-container`;
    
    // Create title if provided
    if (this.options.title) {
      const title = document.createElement('h3');
      title.textContent = this.options.title;
      title.className = `${this.options.className}-title`;
      this.container.appendChild(title);
    }
    
    // Create main chart wrapper
    const wrapper = document.createElement('div');
    wrapper.className = `${this.options.className}-wrapper`;
    this.container.appendChild(wrapper);
    
    // Create SVG container
    const svgContainer = document.createElement('div');
    svgContainer.className = `${this.options.className}-svg-container`;
    wrapper.appendChild(svgContainer);
    
    // Create SVG element
    this.svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgElement.setAttribute('width', this.options.width);
    this.svgElement.setAttribute('height', this.options.height);
    this.svgElement.setAttribute('viewBox', `0 0 ${this.options.width} ${this.options.height}`);
    this.svgElement.setAttribute('class', this.options.className);
    svgContainer.appendChild(this.svgElement);
    
    // Create legend container if enabled
    if (this.options.showLegend) {
      this.legendContainer = document.createElement('div');
      this.legendContainer.className = `${this.options.className}-legend ${this.options.className}-legend-${this.options.legendPosition}`;
      wrapper.appendChild(this.legendContainer);
    }
    
    // Create tooltip if enabled
    if (this.options.showTooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.className = `${this.options.className}-tooltip`;
      this.tooltip.style.display = 'none';
      document.body.appendChild(this.tooltip);
    }
    
    // Add CSS styles if not already added
    this.addStyles();
  }
  
  addStyles() {
    const styleId = 'pie-chart-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .${this.options.className}-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .${this.options.className}-title {
        margin: 0 0 20px 0;
        font-size: 18px;
        font-weight: 600;
        color: #333;
        text-align: center;
      }
      
      .dark-theme .${this.options.className}-title {
        color: #e0e0e0;
      }
      
      .${this.options.className}-wrapper {
        display: flex;
        align-items: flex-start;
        gap: 30px;
        flex-wrap: wrap;
        justify-content: center;
      }
      
      .${this.options.className}-svg-container {
        flex-shrink: 0;
      }
      
      .${this.options.className} {
        overflow: visible;
      }
      
      .${this.options.className}-slice {
        cursor: pointer;
        transition: all 0.2s ease;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
      }
      
      .${this.options.className}-slice:hover {
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
        transform: scale(1.02);
        transform-origin: center;
      }
      
      .${this.options.className}-slice.active {
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
        transform: scale(1.05);
        transform-origin: center;
      }
      
      .${this.options.className}-center-circle {
        fill: #fff;
        stroke: #ddd;
        stroke-width: 2;
      }
      
      .dark-theme .${this.options.className}-center-circle {
        fill: #2a2a2a;
        stroke: #555;
      }
      
      .${this.options.className}-center-text {
        fill: #333;
        text-anchor: middle;
        dominant-baseline: central;
        font-size: 14px;
        font-weight: 600;
      }
      
      .dark-theme .${this.options.className}-center-text {
        fill: #e0e0e0;
      }
      
      .${this.options.className}-legend {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 200px;
      }
      
      .${this.options.className}-legend-bottom {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: center;
        min-width: auto;
        width: 100%;
        margin-top: 20px;
      }
      
      .${this.options.className}-legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        font-size: 14px;
      }
      
      .${this.options.className}-legend-item:hover {
        background-color: #f5f5f5;
      }
      
      .dark-theme .${this.options.className}-legend-item:hover {
        background-color: #3a3a3a;
      }
      
      .${this.options.className}-legend-item.active {
        background-color: #e3f2fd;
      }
      
      .dark-theme .${this.options.className}-legend-item.active {
        background-color: #1e3a5f;
      }
      
      .${this.options.className}-legend-color {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      
      .${this.options.className}-legend-label {
        font-weight: 500;
        color: #333;
        flex: 1;
      }
      
      .dark-theme .${this.options.className}-legend-label {
        color: #e0e0e0;
      }
      
      .${this.options.className}-legend-percentage {
        font-weight: 600;
        color: #666;
        font-size: 12px;
      }
      
      .dark-theme .${this.options.className}-legend-percentage {
        color: #ccc;
      }
      
      .${this.options.className}-tooltip {
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        pointer-events: none;
        z-index: 10000;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      
      .${this.options.className}-tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-style: solid;
        border-color: rgba(0, 0, 0, 0.9) transparent transparent transparent;
      }
      
      /* Mobile responsive */
      @media (max-width: 768px) {
        .${this.options.className}-wrapper {
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        
        .${this.options.className}-legend {
          width: 100%;
          max-width: 300px;
        }
        
        .${this.options.className}-legend-bottom {
          gap: 12px;
        }
        
        .${this.options.className}-legend-item {
          flex: 1;
          min-width: 140px;
          justify-content: space-between;
        }
      }
    `;
    
    document.head.appendChild(style);
  }
  
  setData(data) {
    // Validate and process data
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array of objects with label, value, and optional color properties');
    }
    
    // Filter out zero values and sort by value descending
    let processedData = data
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
    
    // Calculate total
    const total = processedData.reduce((sum, item) => sum + item.value, 0);
    
    if (total === 0) {
      this.data = [];
      this.render();
      return;
    }
    
    // Calculate percentages and group small slices
    let significantData = [];
    let otherData = [];
    let otherValue = 0;
    
    processedData.forEach((item, index) => {
      const percentage = (item.value / total) * 100;
      
      if (percentage >= this.options.minSlicePercentage || significantData.length < 5) {
        significantData.push({
          ...item,
          percentage: percentage,
          color: item.color || this.options.colors[index % this.options.colors.length]
        });
      } else {
        otherData.push(item);
        otherValue += item.value;
      }
    });
    
    // Add "Others" slice if there are grouped items
    if (otherData.length > 0) {
      const otherPercentage = (otherValue / total) * 100;
      significantData.push({
        label: `Others (${otherData.length} assets)`,
        value: otherValue,
        percentage: otherPercentage,
        color: '#999',
        isOther: true,
        otherItems: otherData
      });
    }
    
    this.data = significantData;
    this.render();
  }
  
  render() {
    // Clear SVG
    this.svgElement.innerHTML = '';
    
    if (this.data.length === 0) {
      this.renderEmptyState();
      return;
    }
    
    // Calculate positions
    const centerX = this.options.width / 2;
    const centerY = this.options.height / 2;
    const radius = this.options.radius;
    
    let startAngle = -90; // Start from top
    
    // Create slices
    this.data.forEach((item, index) => {
      const angle = (item.percentage / 100) * 360;
      const endAngle = startAngle + angle;
      
      // Create slice path
      const slice = this.createSlice(centerX, centerY, radius, startAngle, endAngle, item.color);
      slice.setAttribute('class', `${this.options.className}-slice`);
      slice.dataset.index = index;
      
      // Add event listeners
      this.addSliceEvents(slice, item, index);
      
      this.svgElement.appendChild(slice);
      
      startAngle = endAngle;
    });
    
    // Add center circle and text
    this.addCenterElements(centerX, centerY);
    
    // Update legend
    if (this.options.showLegend) {
      this.updateLegend();
    }
  }
  
  createSlice(centerX, centerY, radius, startAngle, endAngle, color) {
    const start = this.polarToCartesian(centerX, centerY, radius, startAngle);
    const end = this.polarToCartesian(centerX, centerY, radius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    
    const pathData = [
      'M', centerX, centerY,
      'L', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 1, end.x, end.y,
      'Z'
    ].join(' ');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', color);
    path.setAttribute('stroke', '#fff');
    path.setAttribute('stroke-width', '2');
    
    return path;
  }
  
  polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }
  
  addSliceEvents(slice, item, index) {
    slice.addEventListener('mouseenter', (e) => {
      this.showTooltip(e, item);
      this.highlightSlice(index);
    });
    
    slice.addEventListener('mouseleave', () => {
      this.hideTooltip();
      this.unhighlightSlice(index);
    });
    
    slice.addEventListener('mousemove', (e) => {
      this.updateTooltipPosition(e);
    });
    
    slice.addEventListener('click', () => {
      this.onSliceClick(item, index);
    });
  }
  
  addCenterElements(centerX, centerY) {
    // Center circle
    const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centerCircle.setAttribute('cx', centerX);
    centerCircle.setAttribute('cy', centerY);
    centerCircle.setAttribute('r', 40);
    centerCircle.setAttribute('class', `${this.options.className}-center-circle`);
    this.svgElement.appendChild(centerCircle);
    
    // Center text
    const centerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centerText.setAttribute('x', centerX);
    centerText.setAttribute('y', centerY - 5);
    centerText.setAttribute('class', `${this.options.className}-center-text`);
    centerText.textContent = 'Portfolio';
    this.svgElement.appendChild(centerText);
    
    const centerSubText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centerSubText.setAttribute('x', centerX);
    centerSubText.setAttribute('y', centerY + 10);
    centerSubText.setAttribute('class', `${this.options.className}-center-text`);
    centerSubText.setAttribute('font-size', '11');
    centerSubText.textContent = `${this.data.length} assets`;
    this.svgElement.appendChild(centerSubText);
  }
  
  updateLegend() {
    if (!this.legendContainer) return;
    
    this.legendContainer.innerHTML = '';
    
    this.data.forEach((item, index) => {
      const legendItem = document.createElement('div');
      legendItem.className = `${this.options.className}-legend-item`;
      legendItem.dataset.index = index;
      
      const colorBox = document.createElement('div');
      colorBox.className = `${this.options.className}-legend-color`;
      colorBox.style.backgroundColor = item.color;
      
      const label = document.createElement('span');
      label.className = `${this.options.className}-legend-label`;
      label.textContent = item.label;
      
      const percentage = document.createElement('span');
      percentage.className = `${this.options.className}-legend-percentage`;
      percentage.textContent = `${item.percentage.toFixed(1)}%`;
      
      legendItem.appendChild(colorBox);
      legendItem.appendChild(label);
      if (this.options.showPercentages) {
        legendItem.appendChild(percentage);
      }
      
      // Add legend item events
      legendItem.addEventListener('mouseenter', () => {
        this.highlightSlice(index);
      });
      
      legendItem.addEventListener('mouseleave', () => {
        this.unhighlightSlice(index);
      });
      
      legendItem.addEventListener('click', () => {
        this.onSliceClick(item, index);
      });
      
      this.legendContainer.appendChild(legendItem);
    });
  }
  
  showTooltip(event, item) {
    if (!this.tooltip) return;
    
    let tooltipContent = `<strong>${item.label}</strong><br>`;
    tooltipContent += `Value: $${item.value.toFixed(2)}<br>`;
    tooltipContent += `Percentage: ${item.percentage.toFixed(1)}%`;
    
    if (item.isOther && item.otherItems) {
      tooltipContent += `<br><br><em>Includes:</em><br>`;
      tooltipContent += item.otherItems.slice(0, 3).map(other => other.label).join('<br>');
      if (item.otherItems.length > 3) {
        tooltipContent += `<br>... and ${item.otherItems.length - 3} more`;
      }
    }
    
    this.tooltip.innerHTML = tooltipContent;
    this.tooltip.style.display = 'block';
    this.updateTooltipPosition(event);
  }
  
  updateTooltipPosition(event) {
    if (!this.tooltip) return;
    
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left = event.clientX - tooltipRect.width / 2;
    let top = event.clientY - tooltipRect.height - 10;
    
    // Adjust if tooltip goes off screen
    if (left < 0) left = 10;
    if (left + tooltipRect.width > viewportWidth) left = viewportWidth - tooltipRect.width - 10;
    if (top < 0) top = event.clientY + 10;
    
    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';
  }
  
  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }
  
  highlightSlice(index) {
    const slice = this.svgElement.querySelector(`[data-index="${index}"]`);
    const legendItem = this.legendContainer?.querySelector(`[data-index="${index}"]`);
    
    if (slice) slice.classList.add('active');
    if (legendItem) legendItem.classList.add('active');
  }
  
  unhighlightSlice(index) {
    const slice = this.svgElement.querySelector(`[data-index="${index}"]`);
    const legendItem = this.legendContainer?.querySelector(`[data-index="${index}"]`);
    
    if (slice) slice.classList.remove('active');
    if (legendItem) legendItem.classList.remove('active');
  }
  
  onSliceClick(item, index) {
    // Emit custom event for external handling
    const event = new CustomEvent('sliceClick', {
      detail: { item, index, chart: this }
    });
    this.container.dispatchEvent(event);
  }
  
  renderEmptyState() {
    const centerX = this.options.width / 2;
    const centerY = this.options.height / 2;
    
    // Empty circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', centerX);
    circle.setAttribute('cy', centerY);
    circle.setAttribute('r', this.options.radius);
    circle.setAttribute('fill', '#f5f5f5');
    circle.setAttribute('stroke', '#ddd');
    circle.setAttribute('stroke-width', '2');
    this.svgElement.appendChild(circle);
    
    // Empty text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', centerX);
    text.setAttribute('y', centerY);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('fill', '#999');
    text.setAttribute('font-size', '16');
    text.textContent = 'No data available';
    this.svgElement.appendChild(text);
    
    if (this.legendContainer) {
      this.legendContainer.innerHTML = '<div style="color: #999; font-style: italic;">No assets to display</div>';
    }
  }
  
  // Public methods
  updateData(data) {
    this.setData(data);
  }
  
  destroy() {
    if (this.tooltip) {
      this.tooltip.remove();
    }
    this.container.innerHTML = '';
  }
  
  resize(width, height) {
    this.options.width = width || this.options.width;
    this.options.height = height || this.options.height;
    this.svgElement.setAttribute('width', this.options.width);
    this.svgElement.setAttribute('height', this.options.height);
    this.svgElement.setAttribute('viewBox', `0 0 ${this.options.width} ${this.options.height}`);
    this.render();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PieChart;
} else {
  window.PieChart = PieChart;
}