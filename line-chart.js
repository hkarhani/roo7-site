/**
 * Reusable Line Chart Module
 * 
 * A lightweight, dependency-free line chart component for displaying 
 * account value analytics over time with interactive features.
 * 
 * Features:
 * - SVG-based rendering for crisp graphics
 * - Interactive hover effects with tooltips
 * - Responsive design
 * - Multi-line support for multiple accounts
 * - Customizable colors and styling
 * - Time-based X-axis with proper formatting
 * - Value-based Y-axis with currency formatting
 * - Mobile-friendly touch interactions
 * - Loading and empty states
 * 
 * @author System
 * @version 1.0.0
 */

class LineChart {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    
    // Default options
    this.options = {
      width: options.width || 800,
      height: options.height || 400,
      margin: {
        top: options.margin?.top || 20,
        right: options.margin?.right || 60,
        bottom: options.margin?.bottom || 60,
        left: options.margin?.left || 80
      },
      colors: options.colors || [
        '#3b82f6', // Blue
        '#10b981', // Green  
        '#f59e0b', // Amber
        '#ef4444', // Red
        '#8b5cf6', // Purple
        '#06b6d4', // Cyan
        '#f97316', // Orange
        '#84cc16'  // Lime
      ],
      showGrid: options.showGrid !== false,
      showTooltip: options.showTooltip !== false,
      animate: options.animate !== false,
      dateFormat: options.dateFormat || 'short', // 'short', 'medium', 'long'
      valueFormat: options.valueFormat || 'currency' // 'currency', 'number', 'percentage'
    };
    
    // Internal state
    this.data = [];
    this.svg = null;
    this.tooltip = null;
    this.scales = { x: null, y: null };
    this.isInitialized = false;
    
    this.initializeChart();
  }

  initializeChart() {
    // Clear container
    this.container.innerHTML = '';
    
    // Create main chart container
    const chartContainer = document.createElement('div');
    chartContainer.className = 'line-chart-container';
    chartContainer.style.cssText = `
      position: relative;
      width: 100%;
      height: ${this.options.height}px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Create SVG element
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.setAttribute('viewBox', `0 0 ${this.options.width} ${this.options.height}`);
    this.svg.style.cssText = `
      display: block;
      max-width: 100%;
      height: auto;
    `;
    
    // Create tooltip element
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'line-chart-tooltip';
    this.tooltip.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      z-index: 1000;
      white-space: nowrap;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    
    chartContainer.appendChild(this.svg);
    chartContainer.appendChild(this.tooltip);
    this.container.appendChild(chartContainer);
    
    this.isInitialized = true;
    
    // Show empty state initially
    this.showEmptyState();
  }

  setData(data) {
    this.data = Array.isArray(data) ? data : [];
    
    if (this.data.length === 0) {
      this.showEmptyState();
      return;
    }
    
    this.renderChart();
  }

  showEmptyState() {
    this.svg.innerHTML = `
      <g class="empty-state">
        <rect width="100%" height="100%" fill="transparent"/>
        <text x="50%" y="50%" text-anchor="middle" dy="-0.5em" 
              fill="#6b7280" font-size="14" font-weight="500">
          No data available
        </text>
        <text x="50%" y="50%" text-anchor="middle" dy="1em" 
              fill="#9ca3af" font-size="12">
          Account values will appear here once data is collected
        </text>
      </g>
    `;
  }

  showLoadingState() {
    this.svg.innerHTML = `
      <g class="loading-state">
        <rect width="100%" height="100%" fill="transparent"/>
        <circle cx="50%" cy="50%" r="20" fill="none" stroke="#3b82f6" stroke-width="3" opacity="0.3">
          <animate attributeName="r" values="15;25;15" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <text x="50%" y="50%" text-anchor="middle" dy="3em" 
              fill="#6b7280" font-size="16" font-weight="500">
          Loading analytics data...
        </text>
      </g>
    `;
  }

  renderChart() {
    // Clear SVG
    this.svg.innerHTML = '';
    
    const { width, height, margin } = this.options;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Process data and create scales
    this.processData();
    this.createScales(chartWidth, chartHeight);
    
    // Create chart group
    const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chartGroup.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);
    this.svg.appendChild(chartGroup);
    
    // Render components
    if (this.options.showGrid) {
      this.renderGrid(chartGroup, chartWidth, chartHeight);
    }
    this.renderAxes(chartGroup, chartWidth, chartHeight);
    this.renderLines(chartGroup);
    this.renderPoints(chartGroup);
    this.renderInteractionLayer(chartGroup, chartWidth, chartHeight);
  }

  processData() {
    // Ensure all data points have proper date objects
    this.data.forEach(series => {
      if (series.values) {
        series.values.forEach(point => {
          if (typeof point.timestamp === 'string') {
            point.date = new Date(point.timestamp);
          } else if (point.timestamp instanceof Date) {
            point.date = point.timestamp;
          }
          point.value = parseFloat(point.value_usdt || point.total_value || point.value || 0);
        });
        
        // Sort by date
        series.values.sort((a, b) => a.date - b.date);
      }
    });
  }

  createScales(chartWidth, chartHeight) {
    // Get all data points
    const allPoints = this.data.flatMap(series => series.values || []);
    
    if (allPoints.length === 0) {
      this.scales = { x: null, y: null };
      return;
    }
    
    // X scale (time)
    const xExtent = d3.extent(allPoints, d => d.date);
    this.scales.x = {
      domain: xExtent,
      range: [0, chartWidth],
      scale: (value) => {
        const domain = xExtent[1] - xExtent[0];
        const position = (value - xExtent[0]) / domain;
        return position * chartWidth;
      }
    };
    
    // Y scale (values)
    const yExtent = d3.extent(allPoints, d => d.value);
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1; // 10% padding
    const yDomain = [
      Math.max(0, yExtent[0] - yPadding), // Don't go below 0 for currency
      yExtent[1] + yPadding
    ];
    
    this.scales.y = {
      domain: yDomain,
      range: [chartHeight, 0],
      scale: (value) => {
        const domain = yDomain[1] - yDomain[0];
        const position = (value - yDomain[0]) / domain;
        return chartHeight - (position * chartHeight);
      }
    };
  }

  renderGrid(parent, chartWidth, chartHeight) {
    const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    grid.setAttribute('class', 'grid');
    
    // Horizontal grid lines (for Y values)
    const yTicks = this.generateYTicks();
    yTicks.forEach(tick => {
      const y = this.scales.y.scale(tick);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('x2', chartWidth);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', '#f3f4f6');
      line.setAttribute('stroke-width', 1);
      grid.appendChild(line);
    });
    
    // Vertical grid lines (for time)
    const xTicks = this.generateXTicks();
    xTicks.forEach(tick => {
      const x = this.scales.x.scale(tick);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('x2', x);
      line.setAttribute('y1', 0);
      line.setAttribute('y2', chartHeight);
      line.setAttribute('stroke', '#f3f4f6');
      line.setAttribute('stroke-width', 1);
      grid.appendChild(line);
    });
    
    parent.appendChild(grid);
  }

  renderAxes(parent, chartWidth, chartHeight) {
    // Y axis
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    yAxis.setAttribute('class', 'y-axis');
    
    // Y axis line
    const yAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxisLine.setAttribute('x1', 0);
    yAxisLine.setAttribute('x2', 0);
    yAxisLine.setAttribute('y1', 0);
    yAxisLine.setAttribute('y2', chartHeight);
    yAxisLine.setAttribute('stroke', '#d1d5db');
    yAxisLine.setAttribute('stroke-width', 1);
    yAxis.appendChild(yAxisLine);
    
    // Y axis ticks and labels
    const yTicks = this.generateYTicks();
    yTicks.forEach(tick => {
      const y = this.scales.y.scale(tick);
      
      // Tick mark
      const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tickLine.setAttribute('x1', -5);
      tickLine.setAttribute('x2', 0);
      tickLine.setAttribute('y1', y);
      tickLine.setAttribute('y2', y);
      tickLine.setAttribute('stroke', '#d1d5db');
      tickLine.setAttribute('stroke-width', 1);
      yAxis.appendChild(tickLine);
      
      // Label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', -10);
      label.setAttribute('y', y);
      label.setAttribute('dy', '0.32em');
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('fill', '#6b7280');
      label.setAttribute('font-size', '12');
      label.textContent = this.formatValue(tick);
      yAxis.appendChild(label);
    });
    
    parent.appendChild(yAxis);
    
    // X axis
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    xAxis.setAttribute('class', 'x-axis');
    xAxis.setAttribute('transform', `translate(0, ${chartHeight})`);
    
    // X axis line
    const xAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxisLine.setAttribute('x1', 0);
    xAxisLine.setAttribute('x2', chartWidth);
    xAxisLine.setAttribute('y1', 0);
    xAxisLine.setAttribute('y2', 0);
    xAxisLine.setAttribute('stroke', '#d1d5db');
    xAxisLine.setAttribute('stroke-width', 1);
    xAxis.appendChild(xAxisLine);
    
    // X axis ticks and labels
    const xTicks = this.generateXTicks();
    xTicks.forEach(tick => {
      const x = this.scales.x.scale(tick);
      
      // Tick mark
      const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tickLine.setAttribute('x1', x);
      tickLine.setAttribute('x2', x);
      tickLine.setAttribute('y1', 0);
      tickLine.setAttribute('y2', 5);
      tickLine.setAttribute('stroke', '#d1d5db');
      tickLine.setAttribute('stroke-width', 1);
      xAxis.appendChild(tickLine);
      
      // Label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', 20);
      label.setAttribute('dy', '0.32em');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#6b7280');
      label.setAttribute('font-size', '12');
      label.textContent = this.formatDate(tick);
      xAxis.appendChild(label);
    });
    
    parent.appendChild(xAxis);
  }

  renderLines(parent) {
    this.data.forEach((series, index) => {
      if (!series.values || series.values.length < 2) return;
      
      const color = series.color || this.options.colors[index % this.options.colors.length];
      
      // Create area path (fill under the line)
      const areaPath = this.createAreaPath(series.values);
      const areaElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      areaElement.setAttribute('d', areaPath);
      areaElement.setAttribute('fill', this.hexToRgba(color, 0.2));
      areaElement.setAttribute('stroke', 'none');
      areaElement.setAttribute('class', `area-series-${index}`);
      parent.appendChild(areaElement);
      
      // Create line path (stroke only)
      const linePath = this.createLinePath(series.values);
      const lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      lineElement.setAttribute('d', linePath);
      lineElement.setAttribute('fill', 'none');
      lineElement.setAttribute('stroke', color);
      lineElement.setAttribute('stroke-width', 2);
      lineElement.setAttribute('stroke-linecap', 'round');
      lineElement.setAttribute('stroke-linejoin', 'round');
      lineElement.setAttribute('class', `line-series-${index}`);
      
      if (this.options.animate) {
        const length = lineElement.getTotalLength();
        lineElement.style.strokeDasharray = length + ' ' + length;
        lineElement.style.strokeDashoffset = length;
        lineElement.animate([
          { strokeDashoffset: length },
          { strokeDashoffset: 0 }
        ], {
          duration: 1500,
          easing: 'ease-out'
        });
      }
      
      parent.appendChild(lineElement);
    });
  }

  renderPoints(parent) {
    this.data.forEach((series, index) => {
      if (!series.values) return;
      
      const color = series.color || this.options.colors[index % this.options.colors.length];
      
      series.values.forEach((point, pointIndex) => {
        const cx = this.scales.x.scale(point.date);
        const cy = this.scales.y.scale(point.value);
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', 3);
        circle.setAttribute('fill', color);
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', 1);
        circle.setAttribute('class', `point-series-${index}-${pointIndex}`);
        circle.style.cursor = 'pointer';
        
        // Store data for tooltip
        circle._chartData = {
          series: series.name || `Account ${index + 1}`,
          date: point.date,
          value: point.value,
          color: color
        };
        
        parent.appendChild(circle);
      });
    });
  }

  renderInteractionLayer(parent, chartWidth, chartHeight) {
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    overlay.setAttribute('width', chartWidth);
    overlay.setAttribute('height', chartHeight);
    overlay.setAttribute('fill', 'transparent');
    overlay.style.cursor = 'crosshair';
    
    // Add event listeners
    overlay.addEventListener('mousemove', (e) => this.handleMouseMove(e, parent));
    overlay.addEventListener('mouseleave', () => this.hideTooltip());
    
    parent.appendChild(overlay);
  }

  createLinePath(values) {
    if (!values || values.length === 0) return '';
    
    let path = '';
    
    values.forEach((point, index) => {
      const x = this.scales.x.scale(point.date);
      const y = this.scales.y.scale(point.value);
      
      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });
    
    return path;
  }

  createAreaPath(values) {
    if (!values || values.length === 0) return '';
    
    const chartHeight = this.options.height - this.options.margin.top - this.options.margin.bottom;
    const baselineY = this.scales.y.scale(0); // Bottom of the chart
    
    let path = '';
    
    // Start from bottom left
    const firstX = this.scales.x.scale(values[0].date);
    const firstY = this.scales.y.scale(values[0].value);
    path += `M ${firstX} ${baselineY}`;
    path += ` L ${firstX} ${firstY}`;
    
    // Draw line to all points
    values.slice(1).forEach((point) => {
      const x = this.scales.x.scale(point.date);
      const y = this.scales.y.scale(point.value);
      path += ` L ${x} ${y}`;
    });
    
    // Close the path back to baseline
    const lastX = this.scales.x.scale(values[values.length - 1].date);
    path += ` L ${lastX} ${baselineY}`;
    path += ' Z'; // Close path
    
    return path;
  }

  hexToRgba(hex, alpha) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  generateYTicks() {
    if (!this.scales.y) return [];
    
    const [min, max] = this.scales.y.domain;
    const tickCount = 5;
    const step = (max - min) / (tickCount - 1);
    
    return Array.from({ length: tickCount }, (_, i) => min + (step * i));
  }

  generateXTicks() {
    if (!this.scales.x) return [];
    
    const [min, max] = this.scales.x.domain;
    const tickCount = 6;
    const step = (max - min) / (tickCount - 1);
    
    return Array.from({ length: tickCount }, (_, i) => new Date(min.getTime() + (step * i)));
  }

  handleMouseMove(event, chartGroup) {
    const rect = this.svg.getBoundingClientRect();
    const margin = this.options.margin;
    const x = event.clientX - rect.left - margin.left;
    const y = event.clientY - rect.top - margin.top;
    
    // Find closest data point
    let closestPoint = null;
    let minDistance = Infinity;
    
    this.data.forEach((series, seriesIndex) => {
      if (!series.values) return;
      
      series.values.forEach((point, pointIndex) => {
        const px = this.scales.x.scale(point.date);
        const py = this.scales.y.scale(point.value);
        const distance = Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2));
        
        if (distance < minDistance && distance < 20) { // 20px threshold
          minDistance = distance;
          closestPoint = {
            series: series.name || `Account ${seriesIndex + 1}`,
            date: point.date,
            value: point.value,
            color: series.color || this.options.colors[seriesIndex % this.options.colors.length],
            x: px,
            y: py
          };
        }
      });
    });
    
    if (closestPoint) {
      this.showTooltip(closestPoint, event);
    } else {
      this.hideTooltip();
    }
  }

  showTooltip(data, event) {
    if (!this.options.showTooltip) return;
    
    const rect = this.container.getBoundingClientRect();
    
    this.tooltip.innerHTML = `
      <div style="color: ${data.color}; font-weight: 600; margin-bottom: 4px;">
        ${data.series}
      </div>
      <div style="margin-bottom: 2px;">
        ${this.formatValue(data.value)}
      </div>
      <div style="font-size: 11px; opacity: 0.8;">
        ${this.formatDate(data.date, 'full')}
      </div>
    `;
    
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    
    let left = event.clientX - rect.left + 15;
    let top = event.clientY - rect.top - 15;
    
    // Adjust position if tooltip would go outside container
    if (left + tooltipRect.width > containerRect.width) {
      left = event.clientX - rect.left - tooltipRect.width - 15;
    }
    if (top < 0) {
      top = event.clientY - rect.top + 15;
    }
    
    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';
    this.tooltip.style.opacity = '1';
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.opacity = '0';
    }
  }

  formatValue(value) {
    if (this.options.valueFormat === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    } else if (this.options.valueFormat === 'percentage') {
      return (value * 100).toFixed(2) + '%';
    } else {
      return value.toLocaleString();
    }
  }

  formatDate(date, format = null) {
    const actualFormat = format || this.options.dateFormat;
    
    if (actualFormat === 'short') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (actualFormat === 'medium') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    } else if (actualFormat === 'long') {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } else if (actualFormat === 'full') {
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString();
    }
  }

  // Utility method to update chart size
  resize(width, height) {
    if (width) this.options.width = width;
    if (height) this.options.height = height;
    
    if (this.svg) {
      this.svg.setAttribute('viewBox', `0 0 ${this.options.width} ${this.options.height}`);
    }
    
    if (this.data.length > 0) {
      this.renderChart();
    }
  }

  // Utility method to update colors
  setColors(colors) {
    this.options.colors = colors;
    if (this.data.length > 0) {
      this.renderChart();
    }
  }

  // Utility method to clear chart
  clear() {
    this.data = [];
    this.showEmptyState();
  }
}

// Simple d3-like extent function for convenience
const d3 = {
  extent: function(array, accessor) {
    if (!array || array.length === 0) return [0, 1];
    
    let min = Infinity;
    let max = -Infinity;
    
    array.forEach(item => {
      const value = accessor ? accessor(item) : item;
      if (value < min) min = value;
      if (value > max) max = value;
    });
    
    return [min === Infinity ? 0 : min, max === -Infinity ? 1 : max];
  }
};

// Export for both CommonJS and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LineChart;
} else {
  window.LineChart = LineChart;
}