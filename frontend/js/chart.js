/**
 * chart.js - SVG Degradation Curve & Trajectory Chart Renderer
 */

export function renderDegradationChart(svg, trendPoints, selectedCycle, maxCycle, activeMetric) {
  if (!svg || !trendPoints || trendPoints.length === 0) return;

  const width = 750;
  const height = 280;
  const padding = { top: 25, right: 35, bottom: 35, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const minC = 30;
  const maxC = maxCycle;
  const getX = (c) => padding.left + ((c - minC) / (maxC - minC)) * chartW;

  let svgContent = `
    <defs>
      <linearGradient id="traj-grad-rul" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.0" />
      </linearGradient>
      <linearGradient id="traj-grad-fail" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0" />
      </linearGradient>
      <linearGradient id="traj-grad-anom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
      </linearGradient>
    </defs>
  `;

  // Gridlines and X-axis ticks
  const step = Math.max(20, Math.round((maxC - minC) / 5 / 10) * 10);
  for (let c = minC; c <= maxC; c += step) {
    const x = getX(c);
    svgContent += `
      <line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="#1f2228" stroke-dasharray="3,3" />
      <text x="${x}" y="${height - 12}" fill="#71717a" font-size="10" font-family="monospace" text-anchor="middle">Cycle ${c}</text>
    `;
  }
  const maxX = getX(maxC);
  svgContent += `
    <text x="${maxX}" y="${height - 12}" fill="#a1a1aa" font-size="10" font-family="monospace" font-weight="bold" text-anchor="end">Cycle ${maxC} (Max)</text>
  `;

  let curY = padding.top + chartH / 2;

  // Active Metric Curve Rendering
  if (activeMetric === 'rul') {
    const maxRul = 200;
    const getY = (r) => height - padding.bottom - (Math.max(0, r) / maxRul) * chartH;

    [200, 100, 0].forEach((v) => {
      const y = getY(v);
      svgContent += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#1f2228" stroke-width="1" />
        <text x="${padding.left - 8}" y="${y + 3}" fill="#71717a" font-size="10" font-family="monospace" text-anchor="end">${v === 200 ? '200 cycles' : v === 100 ? '100c' : '0'}</text>
      `;
    });

    const threshY = getY(30);
    svgContent += `
      <line x1="${padding.left}" y1="${threshY}" x2="${width - padding.right}" y2="${threshY}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.85"/>
      <text x="${width - padding.right - 5}" y="${threshY - 5}" fill="#f59e0b" font-size="9" font-family="monospace" font-weight="bold" text-anchor="end">Critical Threshold: 30c</text>
    `;

    // Ground truth path
    const truthD = trendPoints.reduce((acc, pt, idx) => {
      if (pt.true_rul === null || pt.true_rul === undefined) return acc;
      const x = getX(pt.cycle);
      const y = getY(pt.true_rul);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
    if (truthD) {
      svgContent += `<path d="${truthD}" fill="none" stroke="#52525b" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.7"/>`;
    }

    // Predicted path & area
    const pathD = trendPoints.reduce((acc, pt, idx) => {
      const x = getX(pt.cycle);
      const y = getY(pt.predicted_rul);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
    if (trendPoints.length > 0) {
      const firstX = getX(trendPoints[0].cycle);
      const lastX = getX(trendPoints[trendPoints.length - 1].cycle);
      const baselineY = height - padding.bottom;
      svgContent += `<path d="${pathD} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z" fill="url(#traj-grad-rul)" />`;
    }
    svgContent += `<path d="${pathD}" fill="none" stroke="#22d3ee" stroke-width="2.5" />`;

    const curPt = trendPoints.find((p) => Math.abs(p.cycle - selectedCycle) <= 2) || trendPoints[0];
    if (curPt) curY = getY(curPt.predicted_rul);
  } else if (activeMetric === 'fail') {
    const getY = (p) => height - padding.bottom - p * chartH;

    [1.0, 0.5, 0.0].forEach((v) => {
      const y = getY(v);
      svgContent += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#1f2228" stroke-width="1" />
        <text x="${padding.left - 8}" y="${y + 3}" fill="#71717a" font-size="10" font-family="monospace" text-anchor="end">${Math.round(v * 100)}%</text>
      `;
    });

    const threshY = getY(0.5);
    svgContent += `
      <line x1="${padding.left}" y1="${threshY}" x2="${width - padding.right}" y2="${threshY}" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.85"/>
      <text x="${width - padding.right - 5}" y="${threshY - 5}" fill="#f43f5e" font-size="9" font-family="monospace" font-weight="bold" text-anchor="end">50% RISK CUTOFF</text>
    `;

    const pathD = trendPoints.reduce((acc, pt, idx) => {
      const x = getX(pt.cycle);
      const y = getY(pt.failure_probability);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
    if (trendPoints.length > 0) {
      const firstX = getX(trendPoints[0].cycle);
      const lastX = getX(trendPoints[trendPoints.length - 1].cycle);
      const baselineY = height - padding.bottom;
      svgContent += `<path d="${pathD} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z" fill="url(#traj-grad-fail)" />`;
    }
    svgContent += `<path d="${pathD}" fill="none" stroke="#f59e0b" stroke-width="2.5" />`;

    const curPt = trendPoints.find((p) => Math.abs(p.cycle - selectedCycle) <= 2) || trendPoints[0];
    if (curPt) curY = getY(curPt.failure_probability);
  } else {
    // Anomaly reconstruction error metric
    const maxAnom = 0.5;
    const getY = (a) => height - padding.bottom - (Math.min(maxAnom, a) / maxAnom) * chartH;
    const threshold = trendPoints[0]?.anomaly_threshold || 0.2434;

    [0.4, 0.2434, 0.1, 0.0].forEach((v) => {
      const y = getY(v);
      svgContent += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#1f2228" stroke-width="1" />
        <text x="${padding.left - 8}" y="${y + 3}" fill="#71717a" font-size="10" font-family="monospace" text-anchor="end">${v.toFixed(2)}</text>
      `;
    });

    const threshY = getY(threshold);
    svgContent += `
      <line x1="${padding.left}" y1="${threshY}" x2="${width - padding.right}" y2="${threshY}" stroke="#10b981" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.85"/>
      <text x="${width - padding.right - 5}" y="${threshY - 5}" fill="#10b981" font-size="9" font-family="monospace" font-weight="bold" text-anchor="end">AUTOENCODER THRESHOLD: ${threshold.toFixed(4)}</text>
    `;

    const pathD = trendPoints.reduce((acc, pt, idx) => {
      const x = getX(pt.cycle);
      const y = getY(pt.anomaly_score);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
    if (trendPoints.length > 0) {
      const firstX = getX(trendPoints[0].cycle);
      const lastX = getX(trendPoints[trendPoints.length - 1].cycle);
      const baselineY = height - padding.bottom;
      svgContent += `<path d="${pathD} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z" fill="url(#traj-grad-anom)" />`;
    }
    svgContent += `<path d="${pathD}" fill="none" stroke="#10b981" stroke-width="2.5" />`;

    const curPt = trendPoints.find((p) => Math.abs(p.cycle - selectedCycle) <= 2) || trendPoints[0];
    if (curPt) curY = getY(curPt.anomaly_score);
  }

  // Vertical cursor line & orange intersection node
  const curX = getX(selectedCycle);
  svgContent += `
    <line x1="${curX}" y1="${padding.top}" x2="${curX}" y2="${height - padding.bottom}" stroke="#f59e0b" stroke-width="1.8" />
    <circle cx="${curX}" cy="${curY}" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" filter="drop-shadow(0 0 6px rgba(245,158,11,0.9))" />
    <rect x="${curX - 28}" y="${padding.top - 18}" width="56" height="18" rx="4" fill="#181a1f" stroke="#f59e0b" stroke-width="1" />
    <text x="${curX}" y="${padding.top - 5}" fill="#f59e0b" font-size="10" font-family="monospace" font-weight="bold" text-anchor="middle">C${selectedCycle}</text>
  `;

  svg.innerHTML = svgContent;
}

export function renderTrajectoryStats(selectedCycle, maxCycle, prediction) {
  // 1. Lifespan Progress
  const progressVal = document.getElementById('traj-stat-progress-val');
  const progressBar = document.getElementById('traj-stat-progress-bar');
  const progressDesc = document.getElementById('traj-stat-progress-desc');
  const pct = Math.min(100, Math.max(0, (selectedCycle / maxCycle) * 100)).toFixed(1);
  if (progressVal) progressVal.textContent = `${pct}%`;
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (progressDesc) progressDesc.textContent = `Cycle ${selectedCycle} of ${maxCycle} elapsed`;

  // 2. Predicted End-of-Life (EOL)
  const rul = prediction ? prediction.predicted_rul : Math.max(0, maxCycle - selectedCycle + 35);
  const eolCycle = Math.round(selectedCycle + rul);
  const eolVal = document.getElementById('traj-stat-eol-val');
  if (eolVal) eolVal.textContent = `Cycle ~${eolCycle}`;

  // 3. Critical Horizon (RUL <= 30)
  const horizonVal = document.getElementById('traj-stat-horizon-val');
  const horizonBadge = document.getElementById('traj-stat-horizon-badge');
  const bufferLeft = Math.max(0, Math.round(rul - 30));

  if (horizonVal) {
    if (rul <= 30) {
      horizonVal.textContent = 'CUTOFF BREACHED';
      horizonVal.className = 'text-xl font-bold font-mono tracking-tight text-rose-400';
    } else {
      horizonVal.textContent = `${bufferLeft} Cycles Left`;
      horizonVal.className = 'text-xl font-bold font-mono tracking-tight text-white';
    }
  }
  if (horizonBadge) {
    if (rul <= 30) {
      horizonBadge.textContent = 'CRITICAL';
      horizonBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/40 animate-pulse';
    } else if (rul <= 60) {
      horizonBadge.textContent = 'MONITOR';
      horizonBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/40';
    } else {
      horizonBadge.textContent = 'NOMINAL';
      horizonBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30';
    }
  }

  // 4. Model Trajectory State
  const stateVal = document.getElementById('traj-stat-state-val');
  const stateDot = document.getElementById('traj-stat-state-dot');
  const stateBadge = document.getElementById('traj-stat-state-badge');
  const stateDesc = document.getElementById('traj-stat-state-desc');

  const riskPct = prediction ? (prediction.failure_probability * 100).toFixed(1) : '0.0';
  const failProb = prediction ? prediction.failure_probability : 0.0;
  const isAnom = prediction ? (prediction.anomaly_score > (prediction.anomaly_threshold || 0.2434)) : false;

  if (stateDesc) stateDesc.textContent = `XGBoost: ${riskPct}% risk`;

  if (failProb >= 0.5 || (isAnom && failProb >= 0.35)) {
    if (stateVal) stateVal.textContent = 'CRITICAL';
    if (stateDot) stateDot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-ping';
    if (stateBadge) {
      stateBadge.textContent = 'URGENT';
      stateBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/40';
    }
  } else if (failProb >= 0.2 || isAnom) {
    if (stateVal) stateVal.textContent = 'CAUTION';
    if (stateDot) stateDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 inline-block animate-pulse';
    if (stateBadge) {
      stateBadge.textContent = 'ELEVATED';
      stateBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/40';
    }
  } else {
    if (stateVal) stateVal.textContent = 'NORMAL';
    if (stateDot) stateDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-pulse';
    if (stateBadge) {
      stateBadge.textContent = 'CONFIRMED';
      stateBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    }
  }
}
