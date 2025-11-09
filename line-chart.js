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
      valueFormat: options.valueFormat || 'currency', // 'currency', 'number', 'percentage'
      centerZero: options.centerZero || false,
      shadeBetween: options.shadeBetween || false,
      fillArea: options.fillArea !== false
    };
    
    // Internal state
    this.data = [];
    this.svg = null;
    this.tooltip = null;
    this.scales = { x: null, y: null };
    this.isInitialized = false;
    this.clipPathId = `line-chart-clip-${Math.random().toString(36).slice(2)}`;
    this.clipPathRect = null;
    this.markers = [];
    this.latestDataLayer = null;
    
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
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Create SVG element
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.setAttribute('viewBox', `0 0 ${this.options.width} ${this.options.height}`);
    this.svg.style.cssText = `
      display: block;
      width: 100%;
      max-width: 100%;
      height: 100%;
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
          Performance data will appear here once fresh metrics are collected
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

    const dataLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chartGroup.appendChild(dataLayer);
    this.applyClipPath(dataLayer, chartWidth, chartHeight, margin);
    this.latestDataLayer = dataLayer;
    
    // Render components
    if (this.options.showGrid) {
      this.renderGrid(chartGroup, chartWidth, chartHeight);
    }
    this.renderAxes(chartGroup, chartWidth, chartHeight);
    this.renderZeroLine(dataLayer, chartWidth);
    if (this.options.shadeBetween && this.data.length >= 2) {
      this.renderShadeBetween(dataLayer);
    }
    this.renderLines(dataLayer);
    this.renderPoints(dataLayer);
    this.renderMarkers();
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
    // Get all data points and validate them
    const allPoints = this.data.flatMap(series => series.values || [])
      .filter(d => d && d.date != null && d.value != null && !isNaN(d.value))
      .map(d => ({
        date: new Date(d.date),
        value: parseFloat(d.value)
      }))
      .filter(d => !isNaN(d.date.getTime()) && !isNaN(d.value));
    
    if (allPoints.length === 0) {
      this.scales = { x: null, y: null };
      return;
    }
    
    // X scale (time) - manual extent calculation instead of d3.extent
    const dates = allPoints.map(d => d.date.getTime());
    const xMin = Math.min(...dates);
    const xMax = Math.max(...dates);
    const xExtent = [xMin, xMax];
    
    // Handle case where all dates are the same
    const xDomain = xMax === xMin ? xMax - 86400000 : xMax - xMin; // 1 day fallback
    
    this.scales.x = {
      domain: xExtent,
      range: [0, chartWidth],
      scale: (value) => {
        if (xDomain === 0) return chartWidth / 2; // Center if no range
        const position = (value - xMin) / xDomain;
        return Math.max(0, Math.min(chartWidth, position * chartWidth));
      }
    };
    
    // Y scale (values) - manual extent calculation
    const values = allPoints.map(d => d.value);
    const yMin = Math.min(...values);
    const yMax = Math.max(...values);
    
    // Handle edge cases
    let yDomainMin, yDomainMax;
    if (this.options.valueFormat === 'percentage' && this.options.centerZero) {
      const maxAbs = Math.max(...values.map(v => Math.abs(v)), 0.005);
      const padding = Math.max(maxAbs * 0.15, 0.0025);
      yDomainMin = -maxAbs - padding;
      yDomainMax = maxAbs + padding;
    } else if (yMax === yMin) {
      if (yMax === 0) {
        yDomainMin = 0;
        yDomainMax = 100; // Default range for zero values
      } else {
        yDomainMin = Math.max(0, yMax * 0.9);
        yDomainMax = yMax * 1.1;
      }
    } else {
      const yPadding = Math.max((yMax - yMin) * 0.1, 0.001);
      yDomainMin = Math.max(0, yMin - yPadding);
      yDomainMax = yMax + yPadding;
    }
    
    if (yDomainMax === yDomainMin) {
      yDomainMax = yDomainMin + 1;
    }
    const yDomain = [yDomainMin, yDomainMax];
    const yRange = yDomainMax - yDomainMin;
    
    this.scales.y = {
      domain: yDomain,
      range: [chartHeight, 0],
      scale: (value) => {
        if (yRange === 0) return chartHeight / 2; // Center if no range
        const position = (value - yDomainMin) / yRange;
        return Math.max(0, Math.min(chartHeight, chartHeight - (position * chartHeight)));
      }
    };
  }

  renderGrid(parent, chartWidth, chartHeight) {
    if (!this.scales || !this.scales.x || !this.scales.y) return;
    
    const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    grid.setAttribute('class', 'grid');
    
    // Horizontal grid lines (for Y values)
    const yTicks = this.generateYTicks();
    yTicks.forEach(tick => {
      const y = this.scales.y.scale(tick);
      if (isNaN(y) || !isFinite(y)) return; // Skip invalid values
      
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
      if (isNaN(x) || !isFinite(x)) return; // Skip invalid values
      
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
    if (!this.scales || !this.scales.x || !this.scales.y) return;
    
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
      if (isNaN(y) || !isFinite(y)) return; // Skip invalid values
      
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
      label.textContent = this.formatAxisValue(tick);
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
      if (isNaN(x) || !isFinite(x)) return; // Skip invalid values
      
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
    if (!this.scales || !this.scales.x || !this.scales.y) return;
    
    this.data.forEach((series, index) => {
      if (!series.values || series.values.length < 2) return;
      
      const color = series.color || this.options.colors[index % this.options.colors.length];
      
      const shouldFill = series.area || (this.options.fillArea && !this.options.shadeBetween);
      if (shouldFill) {
        const areaPath = this.createAreaPath(series.values, !!series.fillToZero);
        const areaElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        areaElement.setAttribute('d', areaPath);
        areaElement.setAttribute('fill', series.areaColor || this.hexToRgba(color, 0.2));
        areaElement.setAttribute('stroke', 'none');
        areaElement.setAttribute('class', `area-series-${index}`);
        parent.appendChild(areaElement);
      }
      
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
          series: series.name || series.label || `Series ${index + 1}`,
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

  applyClipPath(target, chartWidth, chartHeight, margin) {
    if (!this.svg) return;
    let defs = this.svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.svg.appendChild(defs);
    }

    let clipPath = this.svg.querySelector(`#${this.clipPathId}`);
    if (!clipPath) {
      clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
      clipPath.setAttribute('id', this.clipPathId);
      clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
      this.clipPathRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      clipPath.appendChild(this.clipPathRect);
      defs.appendChild(clipPath);
    }

    if (this.clipPathRect) {
      const padding = 6;
      const x = Math.max(0, margin.left - padding);
      const y = Math.max(0, margin.top - padding);
      this.clipPathRect.setAttribute('x', x);
      this.clipPathRect.setAttribute('y', y);
      this.clipPathRect.setAttribute('width', chartWidth + padding * 2);
      this.clipPathRect.setAttribute('height', chartHeight + padding * 2);
    }
    target.setAttribute('clip-path', `url(#${this.clipPathId})`);
  }

  setMarkers(markers = []) {
    this.markers = Array.isArray(markers) ? markers : [];
    this.renderMarkers();
  }

  renderMarkers() {
    if (!this.latestDataLayer) return;
    const existingLayer = this.latestDataLayer.querySelector('.marker-layer');
    if (existingLayer) {
      existingLayer.remove();
    }
    if (!this.markers || this.markers.length === 0 || !this.scales.x || !this.scales.y) {
      return;
    }

    const markerLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    markerLayer.setAttribute('class', 'marker-layer');
    this.latestDataLayer.appendChild(markerLayer);

    this.markers.forEach((marker) => {
      if (!marker || marker.value == null || marker.timestamp == null) return;
      const ts = marker.timestamp instanceof Date ? marker.timestamp : new Date(marker.timestamp);
      if (Number.isNaN(ts.getTime())) return;
      const x = this.scales.x.scale(ts);
      const y = this.scales.y.scale(marker.value);
      if (!isFinite(x) || !isFinite(y)) return;

      const star = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      star.setAttribute('x', x);
      star.setAttribute('y', y - 8);
      star.setAttribute('text-anchor', 'middle');
      star.setAttribute('font-size', '16');
      star.setAttribute('fill', marker.color || '#fbbf24');
      star.setAttribute('stroke', '#ffffff');
      star.setAttribute('stroke-width', '0.5');
      star.textContent = '★';
      markerLayer.appendChild(star);
    });
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

  createAreaPath(values, fillToZero = false) {
    if (!values || values.length === 0) return '';
    
    const chartHeight = this.options.height - this.options.margin.top - this.options.margin.bottom;
    let baselineY = chartHeight;
    if (fillToZero && this.scales.y) {
      const zeroY = this.scales.y.scale(0);
      if (!isNaN(zeroY) && isFinite(zeroY)) {
        baselineY = zeroY;
      }
    }
    
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
    
    // min and max are already timestamps (numbers), not Date objects
    const step = (max - min) / (tickCount - 1);
    
    return Array.from({ length: tickCount }, (_, i) => new Date(min + (step * i)));
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
            series: series.name || series.label || `Series ${seriesIndex + 1}`,
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

  formatAxisValue(value) {
    if (this.options.valueFormat === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    }

    if (this.options.valueFormat === 'percentage') {
      return Math.round(value * 100) + '%';
    }

    return Math.round(value).toLocaleString();
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
    } else if (actualFormat === 'adaptive') {
      return this.formatDateAdaptive(date);
    } else {
      return date.toLocaleDateString();
    }
  }

  formatDateAdaptive(date) {
    // Use period context for adaptive formatting
    const periodDays = this.options.periodDays || 7;
    
    if (periodDays <= 1) {
      // 1 day or less: show hours (e.g., "2:00 PM")
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (periodDays <= 7) {
      // 1-7 days: show day and hour (e.g., "Aug 25, 2:00 PM")
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } else if (periodDays <= 30) {
      // 1-30 days: show day only (e.g., "Aug 25")
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } else {
      // 30+ days: show month/year (e.g., "Aug 2025")
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
    }
  }

  // Method to update the time period for adaptive formatting
  setPeriod(periodDays) {
    this.options.periodDays = periodDays;
    this.options.dateFormat = 'adaptive';
    
    // Trigger a re-render if data exists and renderChart method is available
    if (this.data && this.data.length > 0 && typeof this.renderChart === 'function') {
      this.renderChart();
    } else if (this.data && this.data.length > 0) {
      // Fallback: just update the chart data which will trigger a render
      this.setData(this.data);
    }
  }

  renderShadeBetween(parent) {
    if (!this.scales || !this.scales.x || !this.scales.y) return;
    if (this.data.length < 2) return;
    const [seriesA, seriesB] = this.data;
    if (!seriesA.values || !seriesB.values) return;

    const toMap = (series) => {
      const map = new Map();
      series.values.forEach(point => {
        const date = point.date ? new Date(point.date) : new Date(point.timestamp || point.time);
        const time = date.getTime();
        const value = parseFloat(point.value_usdt || point.total_value || point.value || 0);
        map.set(time, value);
      });
      return map;
    };

    const mapA = toMap(seriesA);
    const mapB = toMap(seriesB);
    const timestamps = [...mapA.keys()].filter(ts => mapB.has(ts)).sort((a, b) => a - b);
    if (timestamps.length < 2) return;

    let currentSign = null;
    let upperCoords = [];
    let lowerCoords = [];

    const flushSegment = () => {
      if (upperCoords.length < 2 || lowerCoords.length < 2 || currentSign === null) {
        upperCoords = [];
        lowerCoords = [];
        return;
      }

      const segmentPath = [];
      upperCoords.forEach((point, idx) => {
        segmentPath.push(`${idx === 0 ? 'M' : 'L'} ${point.x} ${point.y}`);
      });
      for (let i = lowerCoords.length - 1; i >= 0; i--) {
        const point = lowerCoords[i];
        segmentPath.push(`L ${point.x} ${point.y}`);
      }
      segmentPath.push('Z');

      const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      area.setAttribute('d', segmentPath.join(' '));
      area.setAttribute('fill', currentSign >= 0 ? '#10b981' : '#f97316');
      area.setAttribute('opacity', '0.2');
      area.setAttribute('stroke', 'none');
      parent.appendChild(area);

      upperCoords = [];
      lowerCoords = [];
    };

    timestamps.forEach((ts) => {
      const diff = mapA.get(ts) - mapB.get(ts);
      const segmentSign = diff >= 0 ? 1 : -1;
      const x = this.scales.x.scale(ts);
      const yA = this.scales.y.scale(mapA.get(ts));
      const yB = this.scales.y.scale(mapB.get(ts));

      if (currentSign === null) {
        currentSign = segmentSign;
      }

      if (segmentSign !== currentSign) {
        flushSegment();
        currentSign = segmentSign;
      }

      upperCoords.push({ x, y: currentSign >= 0 ? yA : yB });
      lowerCoords.push({ x, y: currentSign >= 0 ? yB : yA });
    });

    flushSegment();
  }

  renderZeroLine(parent, chartWidth) {
    if (!this.scales || !this.scales.y) return;
    const domain = this.scales.y.domain || [];
    if (domain.length !== 2) return;
    const [min, max] = domain;
    if (min > 0 || max < 0) return;

    const y = this.scales.y.scale(0);
    if (isNaN(y) || !isFinite(y)) return;

    const zeroLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    zeroLine.setAttribute('x1', 0);
    zeroLine.setAttribute('x2', chartWidth);
    zeroLine.setAttribute('y1', y);
    zeroLine.setAttribute('y2', y);
    zeroLine.setAttribute('stroke', '#cbd5f5');
    zeroLine.setAttribute('stroke-width', 1);
    zeroLine.setAttribute('stroke-dasharray', '4 4');
    parent.appendChild(zeroLine);
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
