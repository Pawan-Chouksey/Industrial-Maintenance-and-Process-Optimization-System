/**
 * Industrial Maintenance Prognostics — Cockpit Dashboard Controller
 * Handles engine selection, cycle streaming, telemetry matrix, SVG charts, and diagnostics.
 */

const Dashboard = (() => {
  // State
  let currentEngineId = 1;
  let currentCycle = 1;
  let maxCycle = 192;
  let currentDataset = "FD001";
  let currentSplit = "train";

  let isPlaying = false;
  let playInterval = null;
  let playSpeed = 1; // 1x, 2x, 5x

  let trendData = null;
  let telemetryFilter = "ALL";
  let activeChartMetrics = {
    rul: true,
    trueRul: true,
    failProb: true,
    anomaly: true
  };

  // Cache of engines list
  let availableEngines = [];

  // DOM Elements cache
  let dom = {};

  function initDomElements() {
    dom = {
      engineSelect: document.getElementById("engine-select"),
      datasetSelect: document.getElementById("dataset-select"),
      cycleSlider: document.getElementById("cycle-slider"),
      cycleDisplay: document.getElementById("current-cycle-display"),
      maxCycleDisplay: document.getElementById("max-cycle-display"),
      cycleProgressPercent: document.getElementById("cycle-progress-percent"),
      btnPlayPause: document.getElementById("btn-play-pause"),
      playIcon: document.getElementById("play-icon"),
      pauseIcon: document.getElementById("pause-icon"),
      speedSelect: document.getElementById("speed-select"),
      btnStepPrev10: document.getElementById("btn-step-prev-10"),
      btnStepPrev1: document.getElementById("btn-step-prev-1"),
      btnStepNext1: document.getElementById("btn-step-next-1"),
      btnStepNext10: document.getElementById("btn-step-next-10"),
      btnResetCycle: document.getElementById("btn-reset-cycle"),
      btnCriticalCutoff: document.getElementById("btn-critical-cutoff"),

      // KPI Elements
      healthScoreVal: document.getElementById("health-score-val"),
      healthScoreMeter: document.getElementById("health-score-meter"),
      healthStatusBadge: document.getElementById("health-status-badge"),
      stageDescText: document.getElementById("stage-desc-text"),

      predictedRulVal: document.getElementById("predicted-rul-val"),
      trueRulVal: document.getElementById("true-rul-val"),
      rulErrorDelta: document.getElementById("rul-error-delta"),
      rulHorizonBadge: document.getElementById("rul-horizon-badge"),

      failureProbVal: document.getElementById("failure-prob-val"),
      failureProbMeter: document.getElementById("failure-prob-meter"),
      failureStatusBadge: document.getElementById("failure-status-badge"),

      anomalyScoreVal: document.getElementById("anomaly-score-val"),
      anomalyThresholdVal: document.getElementById("anomaly-threshold-val"),
      anomalyStatusBadge: document.getElementById("anomaly-status-badge"),
      anomalyMeter: document.getElementById("anomaly-meter"),

      // Telemetry Matrix
      telemetryTableBody: document.getElementById("telemetry-table-body"),
      telemetrySearch: document.getElementById("telemetry-search"),
      telemetryFilterButtons: document.querySelectorAll(".telemetry-filter-btn"),

      // SVG Chart
      chartContainer: document.getElementById("chart-svg-container"),
      chartTooltip: document.getElementById("chart-tooltip"),

      // Root Causes & Maintenance
      rootCausesList: document.getElementById("root-causes-list"),
      recPriorityBadge: document.getElementById("rec-priority-badge"),
      recHeadline: document.getElementById("rec-headline"),
      recBody: document.getElementById("rec-body"),
      recEtaCycles: document.getElementById("rec-eta-cycles"),

      // Scrubber & Value Loaders
      cycleInferenceLoader: document.getElementById("cycle-inference-loader"),
      healthScoreLoader: document.getElementById("health-score-loader"),
      predictedRulLoader: document.getElementById("predicted-rul-loader"),
      failureProbLoader: document.getElementById("failure-prob-loader"),
      anomalyScoreLoader: document.getElementById("anomaly-score-loader"),
      overviewRecLoader: document.getElementById("overview-rec-loader"),
      chartLoaderIndicator: document.getElementById("chart-loader-indicator"),
      telemetryLoadingBar: document.getElementById("telemetry-loading-bar"),
      telemetryLoaderBadge: document.getElementById("telemetry-loader-badge"),
      recLoaderBadge: document.getElementById("rec-loader-badge"),

      // CSV Upload Modal
      btnOpenUploadModal: document.getElementById("btn-open-upload-modal"),
      uploadModal: document.getElementById("upload-modal"),
      btnCloseUploadModal: document.getElementById("btn-close-upload-modal"),
      csvFileInput: document.getElementById("csv-file-input"),
      csvDropZone: document.getElementById("csv-drop-zone"),
      csvUploadStatus: document.getElementById("csv-upload-status"),
      btnDownloadSampleCsv: document.getElementById("btn-download-sample-csv"),
      uploadResultCard: document.getElementById("upload-result-card"),
      uploadResultOutput: document.getElementById("upload-result-output")
    };
  }

  // Load Engines into dropdown
  async function loadEngines() {
    try {
      availableEngines = await API.getEngines(currentDataset, currentSplit);
      if (dom.engineSelect) {
        dom.engineSelect.innerHTML = availableEngines.map(eng => 
          `<option value="${eng.engine_id}">Engine #${String(eng.engine_id).padStart(2, '0')} (${eng.total_cycles} Cycles)</option>`
        ).join("");

        // Select initial
        const match = availableEngines.find(e => e.engine_id === currentEngineId) || availableEngines[0];
        if (match) {
          currentEngineId = match.engine_id;
          maxCycle = match.max_cycle;
          dom.engineSelect.value = currentEngineId;
        }
      }
      updateCycleRange();
      await loadTrendData();
      await refreshData();
    } catch (err) {
      console.error("Failed to load engines", err);
    }
  }

  function updateCycleRange() {
    const eng = availableEngines.find(e => e.engine_id === currentEngineId);
    maxCycle = eng ? eng.max_cycle : 192;

    if (dom.cycleSlider) {
      dom.cycleSlider.min = 1;
      dom.cycleSlider.max = maxCycle;
      dom.cycleSlider.value = currentCycle;
    }
    if (dom.maxCycleDisplay) {
      dom.maxCycleDisplay.textContent = `/ ${maxCycle}`;
    }
    updateCycleDisplay();
  }

  function updateCycleDisplay() {
    if (dom.cycleDisplay) {
      dom.cycleDisplay.textContent = `CYCLE ${currentCycle}`;
    }
    if (dom.cycleProgressPercent) {
      const pct = Math.round((currentCycle / maxCycle) * 100);
      dom.cycleProgressPercent.textContent = `${pct}% Complete`;
    }
  }

  // Fetch full trend data for SVG chart
  async function loadTrendData() {
    try {
      trendData = await API.getTrend(currentEngineId, currentDataset, currentSplit, 3);
      renderSvgChart();
    } catch (err) {
      console.error("Failed to load trend data", err);
    }
  }

  let currentRefreshId = 0;

  function showLoaders() {
    if (dom.cycleInferenceLoader) dom.cycleInferenceLoader.style.display = "inline-flex";
    if (dom.healthScoreLoader) dom.healthScoreLoader.style.display = "inline-flex";
    if (dom.predictedRulLoader) dom.predictedRulLoader.style.display = "inline-flex";
    if (dom.failureProbLoader) dom.failureProbLoader.style.display = "inline-flex";
    if (dom.anomalyScoreLoader) dom.anomalyScoreLoader.style.display = "inline-flex";
    if (dom.overviewRecLoader) dom.overviewRecLoader.style.display = "inline-flex";
    if (dom.chartLoaderIndicator) dom.chartLoaderIndicator.style.display = "flex";
    if (dom.telemetryLoadingBar) dom.telemetryLoadingBar.style.display = "block";
    if (dom.telemetryLoaderBadge) dom.telemetryLoaderBadge.style.display = "inline-flex";
    if (dom.recLoaderBadge) dom.recLoaderBadge.style.display = "inline-flex";

    dom.healthScoreVal?.classList.add("value-updating");
    dom.predictedRulVal?.classList.add("value-updating");
    dom.failureProbVal?.classList.add("value-updating");
    dom.anomalyScoreVal?.classList.add("value-updating");
    dom.telemetryTableBody?.classList.add("table-loading-dim");
  }

  function hideLoaders() {
    if (dom.cycleInferenceLoader) dom.cycleInferenceLoader.style.display = "none";
    if (dom.healthScoreLoader) dom.healthScoreLoader.style.display = "none";
    if (dom.predictedRulLoader) dom.predictedRulLoader.style.display = "none";
    if (dom.failureProbLoader) dom.failureProbLoader.style.display = "none";
    if (dom.anomalyScoreLoader) dom.anomalyScoreLoader.style.display = "none";
    if (dom.overviewRecLoader) dom.overviewRecLoader.style.display = "none";
    if (dom.chartLoaderIndicator) dom.chartLoaderIndicator.style.display = "none";
    if (dom.telemetryLoadingBar) dom.telemetryLoadingBar.style.display = "none";
    if (dom.telemetryLoaderBadge) dom.telemetryLoaderBadge.style.display = "none";
    if (dom.recLoaderBadge) dom.recLoaderBadge.style.display = "none";

    dom.healthScoreVal?.classList.remove("value-updating");
    dom.predictedRulVal?.classList.remove("value-updating");
    dom.failureProbVal?.classList.remove("value-updating");
    dom.anomalyScoreVal?.classList.remove("value-updating");
    dom.telemetryTableBody?.classList.remove("table-loading-dim");
  }

  // Fetch telemetry & ML prognostics for current cycle
  async function refreshData() {
    const requestId = ++currentRefreshId;
    showLoaders();
    try {
      const [telemetry, prediction] = await Promise.all([
        API.getTelemetry(currentEngineId, currentCycle, currentDataset, currentSplit),
        API.getPrediction(currentEngineId, currentCycle, currentDataset, currentSplit)
      ]);

      // Guard against race conditions if user has scrubbed further
      if (requestId !== currentRefreshId) return;

      renderKpis(prediction);
      renderTelemetryTable(telemetry.sensors);
      renderRootCauses(prediction.root_cause_attribution);
      renderRecommendation(prediction.recommendation);
      updateChartCursor();
    } catch (err) {
      if (requestId === currentRefreshId) {
        console.error("Error refreshing data:", err);
      }
    } finally {
      if (requestId === currentRefreshId) {
        hideLoaders();
      }
    }
  }

  // Render KPI Summary Panels
  function renderKpis(pred) {
    if (!pred) return;

    // 1. Health Score
    const hs = Math.round(pred.health_score || 0);
    if (dom.healthScoreVal) dom.healthScoreVal.textContent = hs;
    if (dom.healthScoreMeter) {
      dom.healthScoreMeter.style.width = `${hs}%`;
      dom.healthScoreMeter.className = `meter-fill ${
        hs < 40 ? "meter-fill-critical" : hs < 70 ? "meter-fill-warning" : "meter-fill-nominal"
      }`;
    }
    if (dom.healthStatusBadge) {
      dom.healthStatusBadge.textContent = pred.health_status || (hs < 40 ? "CRITICAL" : hs < 70 ? "WARNING" : "HEALTHY");
      dom.healthStatusBadge.className = `badge ${
        hs < 40 ? "badge-critical" : hs < 70 ? "badge-warning" : "badge-nominal"
      }`;
    }
    if (dom.stageDescText) {
      dom.stageDescText.textContent = pred.stage_desc || "STAGE 1: NOMINAL BASELINE";
    }

    // 2. Remaining Useful Life (RUL)
    const rul = Math.round(pred.predicted_rul || 0);
    const trueRul = pred.true_rul !== null && pred.true_rul !== undefined ? Math.round(pred.true_rul) : null;
    
    if (dom.predictedRulVal) dom.predictedRulVal.textContent = rul;
    if (dom.trueRulVal) {
      dom.trueRulVal.textContent = trueRul !== null ? `${trueRul} Cycles` : "N/A (Test Set)";
    }
    if (dom.rulErrorDelta) {
      if (trueRul !== null) {
        const delta = rul - trueRul;
        const sign = delta > 0 ? "+" : "";
        dom.rulErrorDelta.textContent = `Error: ${sign}${delta} cycles`;
        dom.rulErrorDelta.style.color = Math.abs(delta) <= 5 ? "var(--status-nominal-text)" : "var(--status-warning-text)";
      } else {
        dom.rulErrorDelta.textContent = "";
      }
    }
    if (dom.rulHorizonBadge) {
      if (rul <= 30) {
        dom.rulHorizonBadge.textContent = "CRITICAL: RUL ≤ 30";
        dom.rulHorizonBadge.className = "badge badge-critical";
      } else if (rul <= 60) {
        dom.rulHorizonBadge.textContent = "CAUTION: RUL ≤ 60";
        dom.rulHorizonBadge.className = "badge badge-warning";
      } else {
        dom.rulHorizonBadge.textContent = "NOMINAL LIFESPAN";
        dom.rulHorizonBadge.className = "badge badge-nominal";
      }
    }

    // 3. Failure Probability (XGBoost)
    const failProb = typeof pred.failure_probability === "number" ? pred.failure_probability : 0;
    const failPct = (failProb * 100).toFixed(1);
    if (dom.failureProbVal) dom.failureProbVal.textContent = `${failPct}%`;
    if (dom.failureProbMeter) {
      dom.failureProbMeter.style.width = `${failPct}%`;
      dom.failureProbMeter.className = `meter-fill ${
        failProb >= 0.5 ? "meter-fill-critical" : failProb >= 0.2 ? "meter-fill-warning" : "meter-fill-nominal"
      }`;
    }
    if (dom.failureStatusBadge) {
      const isRisk = failProb >= 0.5 || pred.failure_prediction === 1;
      dom.failureStatusBadge.textContent = isRisk ? "CRITICAL RISK (≤30c)" : "SAFE (>30c)";
      dom.failureStatusBadge.className = `badge ${isRisk ? "badge-critical" : "badge-nominal"}`;
    }

    // 4. Autoencoder Anomaly Score
    const anomScore = typeof pred.anomaly_score === "number" ? pred.anomaly_score : 0.05;
    const anomThreshold = typeof pred.anomaly_threshold === "number" ? pred.anomaly_threshold : 0.2434;
    const isAnom = pred.is_anomaly === 1 || anomScore >= anomThreshold;

    if (dom.anomalyScoreVal) dom.anomalyScoreVal.textContent = anomScore.toFixed(4);
    if (dom.anomalyThresholdVal) dom.anomalyThresholdVal.textContent = anomThreshold.toFixed(4);
    if (dom.anomalyStatusBadge) {
      dom.anomalyStatusBadge.textContent = isAnom ? "ANOMALY DETECTED" : "NOMINAL";
      dom.anomalyStatusBadge.className = `badge ${isAnom ? "badge-critical" : "badge-nominal"}`;
    }
    if (dom.anomalyMeter) {
      const ratio = Math.min(100, Math.round((anomScore / (anomThreshold * 1.5)) * 100));
      dom.anomalyMeter.style.width = `${ratio}%`;
      dom.anomalyMeter.className = `meter-fill ${isAnom ? "meter-fill-critical" : "meter-fill-nominal"}`;
    }
  }

  // Render 15-Channel Telemetry Matrix
  function renderTelemetryTable(sensors) {
    if (!dom.telemetryTableBody || !sensors) return;

    const searchTerm = (dom.telemetrySearch ? dom.telemetrySearch.value.trim().toLowerCase() : "");

    const filtered = sensors.filter(s => {
      // Search filter
      const matchesSearch = !searchTerm ||
        s.sensor_id.toLowerCase().includes(searchTerm) ||
        s.name.toLowerCase().includes(searchTerm) ||
        s.unit.toLowerCase().includes(searchTerm);

      if (!matchesSearch) return false;

      // Group category filter
      if (telemetryFilter === "TEMP") {
        return s.name.toLowerCase().includes("temp");
      } else if (telemetryFilter === "PRESSURE") {
        return s.name.toLowerCase().includes("pressure");
      } else if (telemetryFilter === "SPEED") {
        return s.name.toLowerCase().includes("speed");
      } else if (telemetryFilter === "BLEED") {
        return s.name.toLowerCase().includes("bleed") || s.name.toLowerCase().includes("fuel") || s.name.toLowerCase().includes("ratio");
      }
      return true;
    });

    dom.telemetryTableBody.innerHTML = filtered.map(s => {
      const deltaSign = s.delta > 0 ? "+" : "";
      const statusBadgeClass = s.status === "CRITICAL" ? "badge-critical" : s.status === "WARNING" ? "badge-warning" : "badge-nominal";

      return `
        <tr>
          <td>
            <span class="badge badge-neutral">${s.sensor_id.toUpperCase()}</span>
          </td>
          <td style="font-family: var(--font-sans); font-weight: 500;">
            ${s.name}
          </td>
          <td style="color: var(--text-secondary);">${s.unit || "—"}</td>
          <td style="font-weight: 600; color: var(--text-primary);">${s.value.toFixed(2)}</td>
          <td style="color: var(--text-muted);">${s.nominal.toFixed(2)}</td>
          <td style="color: ${s.delta >= 0 ? 'var(--text-primary)' : 'var(--text-secondary)'};">
            ${deltaSign}${s.delta.toFixed(2)}
          </td>
          <td style="color: ${Math.abs(s.delta_pct) > 3 ? (s.status === 'CRITICAL' ? 'var(--status-critical-text)' : 'var(--status-warning-text)') : 'var(--status-nominal-text)'};">
            ${deltaSign}${s.delta_pct.toFixed(2)}%
          </td>
          <td>
            <span class="badge ${statusBadgeClass}">${s.status}</span>
          </td>
        </tr>
      `;
    }).join("");
  }

  // Render Root Causes Attribution
  function renderRootCauses(causes) {
    if (!causes || !causes.length) {
      if (dom.rootCausesList) dom.rootCausesList.innerHTML = `<p style="color: var(--text-muted); font-size: 12px;">No significant drift detected in sensor channels.</p>`;
      const oRc = document.getElementById("overview-root-causes");
      if (oRc) oRc.innerHTML = `<p style="color: var(--text-muted); font-size: 12px;">No significant drift detected.</p>`;
      return;
    }

    const html = causes.map(c => `
      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
          <span style="font-weight: 500; color: var(--text-primary);">${c.name}</span>
          <span class="font-mono" style="color: var(--text-secondary);">${c.importance_pct.toFixed(1)}%</span>
        </div>
        <div class="meter-container">
          <div class="meter-fill meter-fill-primary" style="width: ${c.importance_pct}%"></div>
        </div>
      </div>
    `).join("");

    if (dom.rootCausesList) dom.rootCausesList.innerHTML = html;

    const oRc = document.getElementById("overview-root-causes");
    if (oRc) {
      oRc.innerHTML = causes.slice(0, 3).map(c => `
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
            <span style="font-weight: 500; color: var(--text-primary);">${c.name}</span>
            <span class="font-mono" style="color: var(--text-secondary);">${c.importance_pct.toFixed(1)}%</span>
          </div>
          <div class="meter-container">
            <div class="meter-fill meter-fill-primary" style="width: ${c.importance_pct}%"></div>
          </div>
        </div>
      `).join("");
    }
  }

  // Render Maintenance Recommendation Directive
  function renderRecommendation(rec) {
    if (!rec) return;

    let priorityClass = "badge-nominal";
    let priorityText = "PRIORITY 4: NORMAL";

    if (rec.priority === 1) {
      priorityClass = "badge-critical";
      priorityText = "PRIORITY 1: URGENT";
    } else if (rec.priority === 2) {
      priorityClass = "badge-warning";
      priorityText = "PRIORITY 2: PREVENTIVE";
    } else if (rec.priority === 3) {
      priorityClass = "badge-neutral";
      priorityText = "PRIORITY 3: MONITORING";
    }

    if (dom.recPriorityBadge) {
      dom.recPriorityBadge.className = `badge ${priorityClass}`;
      dom.recPriorityBadge.textContent = priorityText;
    }
    if (dom.recHeadline) dom.recHeadline.textContent = rec.headline || "Turbofan Operating Within Nominal Limits";
    if (dom.recBody) dom.recBody.textContent = rec.body || "Standard operating cycle verified. No maintenance intervention currently indicated.";
    if (dom.recEtaCycles) dom.recEtaCycles.textContent = rec.eta_cycles !== undefined ? `${rec.eta_cycles} Cycles` : "—";

    const oPri = document.getElementById("overview-rec-priority");
    const oHead = document.getElementById("overview-rec-headline");
    const oBody = document.getElementById("overview-rec-body");
    if (oPri) {
      oPri.className = `badge ${priorityClass}`;
      oPri.textContent = priorityText;
    }
    if (oHead) oHead.textContent = rec.headline || "Turbofan Operating Within Nominal Limits";
    if (oBody) oBody.textContent = rec.body || "Standard operating cycle verified. No maintenance intervention currently indicated.";
  }

  // Render Clean Industrial SVG Trajectory Chart (No Gradients)
  function renderSvgChart() {
    if (!dom.chartContainer || !trendData || !trendData.trajectory || !trendData.trajectory.length) return;

    const traj = trendData.trajectory;
    const width = dom.chartContainer.clientWidth || 900;
    const height = 360;
    const padding = { top: 25, right: 30, bottom: 35, left: 55 };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const minC = traj[0].cycle;
    const maxC = traj[traj.length - 1].cycle;

    // X scale: cycle -> x coordinate
    const scaleX = (c) => padding.left + ((c - minC) / (maxC - minC || 1)) * plotWidth;

    // Y scale for RUL (0 to max RUL observed + 10)
    const maxRul = Math.max(...traj.map(d => Math.max(d.predicted_rul || 0, d.true_rul || 0, 150))) + 10;
    const scaleYRul = (r) => padding.top + plotHeight - ((r / maxRul) * plotHeight);

    // Y scale for Probability (0 to 1) and Anomaly (0 to 0.5)
    const scaleYProb = (p) => padding.top + plotHeight - (Math.min(1, Math.max(0, p)) * plotHeight);

    // Build Paths
    const pathRul = traj.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.cycle).toFixed(1)} ${scaleYRul(d.predicted_rul).toFixed(1)}`).join(' ');
    
    const truePoints = traj.filter(d => d.true_rul !== null && d.true_rul !== undefined);
    const pathTrueRul = truePoints.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.cycle).toFixed(1)} ${scaleYRul(d.true_rul).toFixed(1)}`).join(' ');

    const pathFail = traj.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.cycle).toFixed(1)} ${scaleYProb(d.failure_probability).toFixed(1)}`).join(' ');
    
    // Scale anomaly to fit height nicely (threshold 0.2434 around 50% height)
    const scaleYAnom = (a) => padding.top + plotHeight - (Math.min(1, a / 0.5) * plotHeight);
    const pathAnom = traj.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(d.cycle).toFixed(1)} ${scaleYAnom(d.anomaly_score).toFixed(1)}`).join(' ');

    // Current cursor X
    const cursorX = scaleX(currentCycle);

    // Gridlines count
    const numGridY = 4;
    let gridLinesY = "";
    for (let i = 0; i <= numGridY; i++) {
      const yVal = padding.top + (plotHeight / numGridY) * i;
      const rulVal = Math.round(maxRul - (maxRul / numGridY) * i);
      gridLinesY += `
        <line x1="${padding.left}" y1="${yVal}" x2="${width - padding.right}" y2="${yVal}" stroke="var(--chart-grid)" stroke-width="1" />
        <text x="${padding.left - 8}" y="${yVal + 4}" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)" text-anchor="end">${rulVal}</text>
      `;
    }

    // Gridlines X
    const numGridX = 6;
    let gridLinesX = "";
    for (let i = 0; i <= numGridX; i++) {
      const cVal = Math.round(minC + ((maxC - minC) / numGridX) * i);
      const xVal = scaleX(cVal);
      gridLinesX += `
        <line x1="${xVal}" y1="${padding.top}" x2="${xVal}" y2="${padding.top + plotHeight}" stroke="var(--chart-grid)" stroke-width="1" />
        <text x="${xVal}" y="${height - padding.bottom + 16}" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)" text-anchor="middle">C-${cVal}</text>
      `;
    }

    // Threshold lines (Critical RUL = 30; Failure Prob = 0.50)
    const critRulY = scaleYRul(30);
    const failThreshY = scaleYProb(0.5);

    const svgHtml = `
      <svg id="trajectory-svg" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible; display: block;">
        <!-- Background Grid -->
        ${gridLinesY}
        ${gridLinesX}

        <!-- Axes -->
        <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${width - padding.right}" y2="${padding.top + plotHeight}" stroke="var(--chart-axis)" stroke-width="1.5" />
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotHeight}" stroke="var(--chart-axis)" stroke-width="1.5" />

        <!-- Critical RUL Threshold Reference Line (30 Cycles) -->
        <line x1="${padding.left}" y1="${critRulY}" x2="${width - padding.right}" y2="${critRulY}" stroke="var(--status-critical)" stroke-width="1" stroke-dasharray="4,4" opacity="0.6" />
        <text x="${width - padding.right}" y="${critRulY - 4}" fill="var(--status-critical-text)" font-size="9" font-family="var(--font-mono)" text-anchor="end">Cutoff (30c)</text>

        <!-- True RUL Curve (Ground Truth) -->
        ${activeChartMetrics.trueRul && pathTrueRul ? `
          <path d="${pathTrueRul}" fill="none" stroke="var(--chart-rul-true)" stroke-width="1.8" stroke-dasharray="3,3" />
        ` : ''}

        <!-- Predicted RUL Curve (LSTM) -->
        ${activeChartMetrics.rul ? `
          <path d="${pathRul}" fill="none" stroke="var(--chart-rul)" stroke-width="2.2" stroke-linecap="round" />
        ` : ''}

        <!-- Failure Probability Curve (XGBoost) -->
        ${activeChartMetrics.failProb ? `
          <path d="${pathFail}" fill="none" stroke="var(--chart-fail)" stroke-width="2" stroke-linecap="round" />
        ` : ''}

        <!-- Anomaly Reconstruction Score Curve (Autoencoder) -->
        ${activeChartMetrics.anomaly ? `
          <path d="${pathAnom}" fill="none" stroke="var(--chart-anom)" stroke-width="1.8" stroke-dasharray="5,2" />
        ` : ''}

        <!-- Scrubber Cursor Line -->
        <line id="svg-cursor-line" x1="${cursorX}" y1="${padding.top}" x2="${cursorX}" y2="${padding.top + plotHeight}" stroke="var(--text-white)" stroke-width="2" stroke-dasharray="2,2" />
        <circle id="svg-cursor-dot" cx="${cursorX}" cy="${scaleYRul(trendData.trajectory.find(t => t.cycle >= currentCycle)?.predicted_rul || 100)}" r="4.5" fill="var(--text-white)" stroke="var(--bg-canvas)" stroke-width="2" />

        <!-- Interactive Overlay Rect -->
        <rect id="svg-chart-overlay" x="${padding.left}" y="${padding.top}" width="${plotWidth}" height="${plotHeight}" fill="transparent" style="cursor: crosshair;" />
      </svg>
    `;

    dom.chartContainer.innerHTML = svgHtml;
    attachChartEvents(scaleX, scaleYRul, minC, maxC, plotWidth, padding);
  }

  function updateChartCursor() {
    if (!trendData || !trendData.trajectory || !dom.chartContainer) return;
    const traj = trendData.trajectory;
    const width = dom.chartContainer.clientWidth || 800;
    const height = 280;
    const padding = { top: 25, right: 30, bottom: 35, left: 55 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const minC = traj[0].cycle;
    const maxC = traj[traj.length - 1].cycle;
    const cursorX = padding.left + ((currentCycle - minC) / (maxC - minC || 1)) * plotWidth;

    const maxRul = Math.max(...traj.map(d => Math.max(d.predicted_rul || 0, d.true_rul || 0, 150))) + 10;
    const currentPoint = traj.find(t => t.cycle >= currentCycle) || traj[traj.length - 1];
    const cursorY = padding.top + plotHeight - (((currentPoint.predicted_rul || 0) / maxRul) * plotHeight);

    const cursorLine = document.getElementById("svg-cursor-line");
    const cursorDot = document.getElementById("svg-cursor-dot");

    if (cursorLine) {
      cursorLine.setAttribute("x1", cursorX);
      cursorLine.setAttribute("x2", cursorX);
    }
    if (cursorDot) {
      cursorDot.setAttribute("cx", cursorX);
      cursorDot.setAttribute("cy", cursorY);
    }
  }

  function attachChartEvents(scaleX, scaleYRul, minC, maxC, plotWidth, padding) {
    const overlay = document.getElementById("svg-chart-overlay");
    if (!overlay || !dom.chartTooltip) return;

    overlay.addEventListener("mousemove", (e) => {
      const rect = overlay.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const progress = Math.max(0, Math.min(1, mouseX / plotWidth));
      const targetCycle = Math.round(minC + progress * (maxC - minC));

      const point = trendData.trajectory.reduce((prev, curr) => 
        Math.abs(curr.cycle - targetCycle) < Math.abs(prev.cycle - targetCycle) ? curr : prev
      , trendData.trajectory[0]);

      if (point) {
        dom.chartTooltip.style.display = "block";
        dom.chartTooltip.style.left = `${e.clientX + 14}px`;
        dom.chartTooltip.style.top = `${e.clientY - 20}px`;
        dom.chartTooltip.innerHTML = `
          <div style="font-weight: 600; border-bottom: 1px solid var(--border-default); padding-bottom: 3px; margin-bottom: 5px;">CYCLE ${point.cycle}</div>
          <div style="color: var(--chart-rul);">LSTM RUL: <span style="font-weight: 600;">${Math.round(point.predicted_rul)}</span> c</div>
          ${point.true_rul !== null ? `<div style="color: var(--chart-rul-true);">True RUL: <span style="font-weight: 600;">${Math.round(point.true_rul)}</span> c</div>` : ''}
          <div style="color: var(--chart-fail);">Fail Risk: <span style="font-weight: 600;">${(point.failure_probability * 100).toFixed(1)}%</span></div>
          <div style="color: var(--chart-anom);">Anomaly MSE: <span style="font-weight: 600;">${point.anomaly_score.toFixed(4)}</span></div>
        `;
      }
    });

    overlay.addEventListener("mouseleave", () => {
      if (dom.chartTooltip) dom.chartTooltip.style.display = "none";
    });

    overlay.addEventListener("click", (e) => {
      const rect = overlay.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const progress = Math.max(0, Math.min(1, mouseX / plotWidth));
      const targetCycle = Math.round(minC + progress * (maxC - minC));
      setCycle(targetCycle);
    });
  }

  // Scrubber & Step Functions
  function setCycle(c) {
    currentCycle = Math.max(1, Math.min(maxCycle, Number(c)));
    if (dom.cycleSlider) dom.cycleSlider.value = currentCycle;
    updateCycleDisplay();
    updateChartCursor();
    showLoaders();
    refreshData();
  }

  function stepCycle(delta) {
    setCycle(currentCycle + delta);
  }

  // Streaming Playback Controller
  function togglePlayback() {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function startPlayback() {
    if (currentCycle >= maxCycle) {
      currentCycle = 1;
    }
    isPlaying = true;
    updatePlaybackControls();

    const intervalMs = Math.round(250 / playSpeed);
    playInterval = setInterval(() => {
      if (currentCycle < maxCycle) {
        setCycle(currentCycle + 1);
      } else {
        pausePlayback();
      }
    }, intervalMs);
  }

  function pausePlayback() {
    isPlaying = false;
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
    updatePlaybackControls();
  }

  function updatePlaybackControls() {
    if (dom.playIcon && dom.pauseIcon) {
      if (isPlaying) {
        dom.playIcon.style.display = "none";
        dom.pauseIcon.style.display = "inline-block";
      } else {
        dom.playIcon.style.display = "inline-block";
        dom.pauseIcon.style.display = "none";
      }
    }
  }

  // Bind all UI Listeners
  function attachEventListeners() {
    // Engine selector
    if (dom.engineSelect) {
      dom.engineSelect.addEventListener("change", async (e) => {
        currentEngineId = Number(e.target.value);
        currentCycle = 1;
        pausePlayback();
        updateCycleRange();
        await loadTrendData();
        await refreshData();
      });
    }

    // Dataset selector
    if (dom.datasetSelect) {
      dom.datasetSelect.addEventListener("change", async (e) => {
        currentDataset = e.target.value;
        currentCycle = 1;
        pausePlayback();
        await loadEngines();
      });
    }

    // Scrubber slider
    let scrubDebounceTimer = null;
    if (dom.cycleSlider) {
      dom.cycleSlider.addEventListener("input", (e) => {
        currentCycle = Number(e.target.value);
        updateCycleDisplay();
        updateChartCursor();
        showLoaders();
        if (scrubDebounceTimer) clearTimeout(scrubDebounceTimer);
        scrubDebounceTimer = setTimeout(() => {
          refreshData();
        }, 50);
      });

      dom.cycleSlider.addEventListener("change", (e) => {
        if (scrubDebounceTimer) clearTimeout(scrubDebounceTimer);
        currentCycle = Number(e.target.value);
        updateCycleDisplay();
        updateChartCursor();
        showLoaders();
        refreshData();
      });
    }

    // Step buttons
    if (dom.btnStepPrev10) dom.btnStepPrev10.addEventListener("click", () => stepCycle(-10));
    if (dom.btnStepPrev1) dom.btnStepPrev1.addEventListener("click", () => stepCycle(-1));
    if (dom.btnStepNext1) dom.btnStepNext1.addEventListener("click", () => stepCycle(1));
    if (dom.btnStepNext10) dom.btnStepNext10.addEventListener("click", () => stepCycle(10));
    if (dom.btnResetCycle) dom.btnResetCycle.addEventListener("click", () => setCycle(1));
    if (dom.btnCriticalCutoff) dom.btnCriticalCutoff.addEventListener("click", () => setCycle(Math.max(1, maxCycle - 30)));

    // Play/Pause & Speed
    if (dom.btnPlayPause) dom.btnPlayPause.addEventListener("click", togglePlayback);
    if (dom.speedSelect) {
      dom.speedSelect.addEventListener("change", (e) => {
        playSpeed = Number(e.target.value) || 1;
        if (isPlaying) {
          pausePlayback();
          startPlayback();
        }
      });
    }

    // Telemetry search & filters
    if (dom.telemetrySearch) {
      dom.telemetrySearch.addEventListener("input", () => refreshData());
    }

    if (dom.telemetryFilterButtons) {
      dom.telemetryFilterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
          dom.telemetryFilterButtons.forEach(b => b.classList.remove("badge-primary"));
          btn.classList.add("badge-primary");
          telemetryFilter = btn.dataset.filter || "ALL";
          refreshData();
        });
      });
    }

    // Chart metric toggles
    document.querySelectorAll(".chart-metric-toggle").forEach(chk => {
      chk.addEventListener("change", (e) => {
        const metric = e.target.dataset.metric;
        if (metric && activeChartMetrics.hasOwnProperty(metric)) {
          activeChartMetrics[metric] = e.target.checked;
          renderSvgChart();
        }
      });
    });

    // Window resize chart re-render
    window.addEventListener("resize", () => {
      renderSvgChart();
    });

    // CSV Upload Modal controls
    if (dom.btnOpenUploadModal && dom.uploadModal) {
      dom.btnOpenUploadModal.addEventListener("click", () => {
        dom.uploadModal.style.display = "flex";
      });
    }
    if (dom.btnCloseUploadModal && dom.uploadModal) {
      dom.btnCloseUploadModal.addEventListener("click", () => {
        dom.uploadModal.style.display = "none";
      });
    }

    // Drag and drop CSV
    if (dom.csvDropZone && dom.csvFileInput) {
      dom.csvDropZone.addEventListener("click", () => dom.csvFileInput.click());
      dom.csvDropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dom.csvDropZone.style.borderColor = "var(--border-focus)";
      });
      dom.csvDropZone.addEventListener("dragleave", () => {
        dom.csvDropZone.style.borderColor = "var(--border-default)";
      });
      dom.csvDropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dom.csvDropZone.style.borderColor = "var(--border-default)";
        if (e.dataTransfer.files.length) {
          handleCsvFile(e.dataTransfer.files[0]);
        }
      });
      dom.csvFileInput.addEventListener("change", (e) => {
        if (e.target.files.length) {
          handleCsvFile(e.target.files[0]);
        }
      });
    }

    // Sample CSV download
    if (dom.btnDownloadSampleCsv) {
      dom.btnDownloadSampleCsv.addEventListener("click", downloadSampleCsv);
    }
  }

  async function handleCsvFile(file) {
    if (!file || !file.name.endsWith(".csv")) {
      alert("Please select a valid CSV telemetry file.");
      return;
    }

    if (dom.csvUploadStatus) {
      dom.csvUploadStatus.textContent = `Analyzing "${file.name}" with ML inference pipeline...`;
      dom.csvUploadStatus.style.display = "block";
    }

    try {
      const res = await API.uploadCSV(file);
      if (dom.uploadResultCard && dom.uploadResultOutput) {
        dom.uploadResultCard.style.display = "block";
        dom.uploadResultOutput.innerHTML = `
          <div style="font-size: 13px; line-height: 1.8;">
            <div><strong>Status:</strong> <span class="badge badge-nominal">INFERENCE COMPLETE</span></div>
            <div><strong>Predicted RUL:</strong> <span class="font-mono">${res.predicted_rul || '—'} Cycles</span></div>
            <div><strong>Failure Risk:</strong> <span class="font-mono">${((res.failure_probability || 0) * 100).toFixed(1)}%</span></div>
            <div><strong>Autoencoder Anomaly MSE:</strong> <span class="font-mono">${res.anomaly_score || '0.042'}</span></div>
            <div><strong>Health Index:</strong> <span class="font-mono">${res.health_score || 85} / 100</span></div>
            ${res.recommendation ? `
              <div style="margin-top: 10px; padding: 10px; background: var(--bg-surface-2); border-radius: var(--radius-sm); border: 1px solid var(--border-muted);">
                <div style="font-weight: 600; color: var(--text-primary);">${res.recommendation.headline}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${res.recommendation.body}</div>
              </div>
            ` : ''}
          </div>
        `;
      }
      if (dom.csvUploadStatus) {
        dom.csvUploadStatus.textContent = `File successfully processed!`;
      }
    } catch (err) {
      if (dom.csvUploadStatus) {
        dom.csvUploadStatus.textContent = `Error processing CSV: ${err.message}`;
        dom.csvUploadStatus.style.color = "var(--status-critical-text)";
      }
    }
  }

  function downloadSampleCsv() {
    const header = "engine_id,cycle,setting_1,setting_2,setting_3,sensor_2,sensor_3,sensor_4,sensor_6,sensor_7,sensor_8,sensor_9,sensor_11,sensor_12,sensor_13,sensor_14,sensor_15,sensor_17,sensor_20,sensor_21";
    const sampleRow = "1,35,-0.0007,-0.0004,100.0,642.35,1588.62,1402.44,21.61,553.75,2388.08,9052.22,47.45,521.90,2388.07,8137.95,8.4230,392,38.88,23.33";
    const csvContent = "data:text/csv;charset=utf-8," + [header, sampleRow].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "cmapss_sample_telemetry.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return {
    async init() {
      initDomElements();
      attachEventListeners();
      await loadEngines();
    },

    refresh() {
      refreshData();
    },

    step(delta) {
      stepCycle(delta);
    },

    togglePlay() {
      togglePlayback();
    },

    renderChart() {
      renderSvgChart();
    },

    getCurrentState() {
      return {
        engine_id: currentEngineId,
        dataset: currentDataset,
        cycle: currentCycle,
        max_cycle: maxCycle
      };
    }
  };
})();
