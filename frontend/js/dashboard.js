/**
 * dashboard.js - AeroPulse Industrial Cockpit Controller
 * Modular architecture: coordinates chart.js, telemetryView.js, and diagnosticsView.js
 */

import {
  fetchEnginesApi,
  fetchEnginePredictionApi,
  fetchEngineTelemetryApi,
  fetchEngineTrendApi,
  uploadSensorCsvApi,
} from './api.js';

import { renderDegradationChart, renderTrajectoryStats } from './chart.js';
import { renderTelemetryPanel } from './telemetryView.js';
import { renderDiagnosticsPanel, renderAdvisoryTicker } from './diagnosticsView.js';

export class DashboardController {
  constructor(app) {
    this.app = app;

    // State
    this.dataset = 'FD001';
    this.split = 'train';
    this.engines = [];
    this.selectedEngineId = 1;
    this.selectedCycle = 145;
    this.maxCycle = 192;

    this.prediction = null;
    this.telemetry = [];
    this.trendPoints = [];
    this.anomalyThreshold = 0.2434;

    this.activeTab = 'trajectory'; // 'trajectory' | 'telemetry' | 'diagnostics'
    this.telemetryView = 'grid'; // 'grid' | 'table'
    this.telemetryFilter = 'all'; // 'all' | 'drift'
    this.activeMetric = 'rul'; // 'rul' | 'fail' | 'anom'

    this.isPlaying = false;
    this.playbackTimer = null;
    this.inferTimer = null;
    this.animFrameIds = {};

    // Number smoothing state
    this.animValues = {
      health: 69.4,
      rul: 43.1,
      fail: 0.9,
      anom: 0.0518,
    };
  }

  init() {
    this.bindHeaderEvents();
    this.bindWorkspaceEvents();
    this.bindTabEvents();
    this.bindTelemetryFilterEvents();
    this.bindCsvEvents();
  }

  async activate() {
    const userLabel = document.getElementById('dash-top-user-name');
    if (userLabel && this.app.currentUser) {
      userLabel.textContent = `ACCOUNT (${this.app.currentUser.username.toUpperCase()})`;
    }
    await this.loadEngines();
  }

  deactivate() {
    this.stopPlayback();
  }

  // ── Engine & Data Loading ───────────────────────────────────────────────────
  async loadEngines() {
    try {
      this.engines = await fetchEnginesApi(this.dataset, this.split);
      this.renderEngineDropdown();

      const fleetCountEl = document.getElementById('dash-fleet-count');
      if (fleetCountEl) fleetCountEl.textContent = `${this.engines.length} ENGINES`;

      if (this.engines.length > 0) {
        const first = this.engines[0];
        this.selectedEngineId = first.engine_id;
        this.maxCycle = first.max_cycle;
        this.selectedCycle = Math.min(145, first.max_cycle);
        this.updateSliderBounds();
        await this.loadTrend();
        await this.runInference();
      }
    } catch (err) {
      this.showError('Failed to load engines: ' + err.message);
    }
  }

  renderEngineDropdown() {
    const select = document.getElementById('dash-engine-select');
    if (!select) return;
    select.innerHTML = '';
    this.engines.forEach((eng) => {
      const opt = document.createElement('option');
      opt.value = eng.engine_id;
      opt.textContent = `ENG-${String(eng.engine_id).padStart(3, '0')} (Max: ${eng.max_cycle}c)`;
      select.appendChild(opt);
    });
    select.value = this.selectedEngineId;

    const tabEng = document.getElementById('dash-tab-badge-eng');
    if (tabEng) tabEng.textContent = `ENG-${String(this.selectedEngineId).padStart(3, '0')}`;
    const tabMax = document.getElementById('dash-tab-badge-max');
    if (tabMax) tabMax.textContent = this.maxCycle;
  }

  async loadTrend() {
    try {
      const res = await fetchEngineTrendApi(this.selectedEngineId, this.dataset, this.split, 4);
      this.trendPoints = res.trajectory || [];
      this.anomalyThreshold = res.threshold || 0.2434;
      this.maxCycle = res.max_cycle || 192;
      this.updateSliderBounds();
      this.renderDegradationChart();
    } catch (err) {
      console.warn('Failed to load degradation trend:', err);
    }
  }

  async runInference() {
    this.setInferringState(true);

    if (this.inferTimer) clearTimeout(this.inferTimer);
    const debounceMs = this.isPlaying ? 20 : 100;

    this.inferTimer = setTimeout(async () => {
      try {
        const [predRes, telemRes] = await Promise.all([
          fetchEnginePredictionApi(this.selectedEngineId, this.selectedCycle, this.dataset, this.split),
          fetchEngineTelemetryApi(this.selectedEngineId, this.selectedCycle, this.dataset, this.split),
        ]);

        this.prediction = predRes;
        this.telemetry = telemRes.sensors || [];
        this.hideError();

        this.renderKpiMetrics();
        renderAdvisoryTicker(this.prediction);
        this.renderActiveTabContent();
      } catch (err) {
        this.showError('Inference pipeline error: ' + err.message);
      } finally {
        this.setInferringState(false);
      }
    }, debounceMs);
  }

  // ── Header & Workspace Controls ─────────────────────────────────────────────
  bindHeaderEvents() {
    const returnBtn = document.getElementById('dash-btn-return-portal');
    if (returnBtn) {
      returnBtn.addEventListener('click', () => this.app.setView('login'));
    }

    const engSelect = document.getElementById('dash-engine-select');
    if (engSelect) {
      engSelect.addEventListener('change', async (e) => {
        this.selectedEngineId = Number(e.target.value);
        const eng = this.engines.find((x) => x.engine_id === this.selectedEngineId);
        if (eng) {
          this.maxCycle = eng.max_cycle;
          this.selectedCycle = Math.min(this.selectedCycle, this.maxCycle);
        }
        this.renderEngineDropdown();
        this.updateSliderBounds();
        await this.loadTrend();
        await this.runInference();
      });
    }
  }

  bindWorkspaceEvents() {
    const btnStepBack = document.getElementById('dash-btn-step-back');
    const btnStepForward = document.getElementById('dash-btn-step-forward');
    const playBtn = document.getElementById('dash-btn-play');
    const cycleSlider = document.getElementById('dash-cycle-slider');
    const splitBtn = document.getElementById('dash-split-toggle');
    const resetBtn = document.getElementById('dash-btn-reset');

    if (btnStepBack) btnStepBack.addEventListener('click', () => this.stepCycle(-1));
    if (btnStepForward) btnStepForward.addEventListener('click', () => this.stepCycle(1));
    if (playBtn) playBtn.addEventListener('click', () => this.togglePlayback());

    if (cycleSlider) {
      cycleSlider.addEventListener('input', (e) => {
        this.selectedCycle = Number(e.target.value);
        this.updateCycleBadge();
        this.runInference();
      });
    }

    if (splitBtn) {
      splitBtn.addEventListener('click', async () => {
        this.split = this.split === 'train' ? 'test' : 'train';
        const splitText = document.getElementById('dash-split-label');
        if (splitText) splitText.textContent = this.split.toUpperCase();
        await this.loadEngines();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.selectedCycle = 30;
        this.updateCycleBadge();
        if (cycleSlider) cycleSlider.value = 30;
        this.runInference();
      });
    }
  }

  stepCycle(delta) {
    const next = Math.max(30, Math.min(this.maxCycle, this.selectedCycle + delta));
    this.selectedCycle = next;
    const cycleSlider = document.getElementById('dash-cycle-slider');
    if (cycleSlider) cycleSlider.value = next;
    this.updateCycleBadge();
    this.runInference();
  }

  togglePlayback() {
    this.isPlaying = !this.isPlaying;
    const playBtn = document.getElementById('dash-btn-play');
    if (!playBtn) return;

    if (this.isPlaying) {
      playBtn.className =
        'px-3 py-1.5 border rounded text-xs font-mono font-medium flex items-center gap-1.5 transition bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-pointer';
      playBtn.innerHTML = `
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        <span>HALT</span>
      `;

      this.playbackTimer = setInterval(() => {
        if (this.selectedCycle < this.maxCycle) {
          this.stepCycle(1);
        } else {
          this.stopPlayback();
        }
      }, 150);
    } else {
      this.stopPlayback();
    }
  }

  stopPlayback() {
    this.isPlaying = false;
    if (this.playbackTimer) clearInterval(this.playbackTimer);
    const playBtn = document.getElementById('dash-btn-play');
    if (playBtn) {
      playBtn.className =
        'px-3 py-1.5 border rounded text-xs font-mono font-medium flex items-center gap-1.5 transition bg-[#18181b] hover:bg-[#27272a] border-[#27272a] text-cyan-400 cursor-pointer';
      playBtn.innerHTML = `
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>STREAM</span>
      `;
    }
  }

  updateSliderBounds() {
    const slider = document.getElementById('dash-cycle-slider');
    const maxLabel = document.getElementById('dash-slider-max-label');
    if (slider) {
      slider.min = 30;
      slider.max = this.maxCycle;
      slider.value = this.selectedCycle;
    }
    if (maxLabel) maxLabel.textContent = `C${this.maxCycle}`;
    this.updateCycleBadge();
  }

  updateCycleBadge() {
    const badge = document.getElementById('dash-current-cycle-value');
    if (badge) badge.textContent = this.selectedCycle;
    const tabCyc = document.getElementById('dash-tab-badge-cyc');
    if (tabCyc) tabCyc.textContent = this.selectedCycle;
    const tabMax = document.getElementById('dash-tab-badge-max');
    if (tabMax) tabMax.textContent = this.maxCycle;

    renderTrajectoryStats(this.selectedCycle, this.maxCycle, this.prediction);
  }

  setInferringState(isInferring) {
    const pingDot = document.getElementById('dash-cycle-infer-ping');
    if (pingDot) {
      if (isInferring) pingDot.classList.remove('hidden');
      else pingDot.classList.add('hidden');
    }
  }

  // ── KPI Metrics Rendering & Number Smoothing ────────────────────────────────
  renderKpiMetrics() {
    if (!this.prediction) return;
    const p = this.prediction;

    this.smoothTransition('health', p.health_score, (v) => {
      const el = document.getElementById('kpi-val-health');
      if (el) el.textContent = v.toFixed(1);
      const bar = document.getElementById('kpi-bar-health');
      if (bar) bar.style.width = `${v}%`;
    });

    this.smoothTransition('rul', p.predicted_rul, (v) => {
      const el = document.getElementById('kpi-val-rul');
      if (el) el.textContent = Math.round(v);
      const bar = document.getElementById('kpi-bar-rul');
      if (bar) bar.style.width = `${Math.min(100, (v / 180) * 100)}%`;
    });

    this.smoothTransition('fail', p.failure_probability * 100, (v) => {
      const el = document.getElementById('kpi-val-fail');
      if (el) el.textContent = `${v.toFixed(1)}%`;
      const bar = document.getElementById('kpi-bar-fail');
      if (bar) bar.style.width = `${Math.min(100, v)}%`;
    });

    this.smoothTransition('anom', p.anomaly_score, (v) => {
      const el = document.getElementById('kpi-val-anom');
      if (el) el.textContent = v.toFixed(4);
      const bar = document.getElementById('kpi-bar-anom');
      if (bar) bar.style.width = `${Math.min(100, (v / (p.anomaly_threshold || 0.2434)) * 100)}%`;
    });

    // Badges & status styling
    const healthBadge = document.getElementById('kpi-badge-health');
    const healthStage = document.getElementById('kpi-stage-health');
    const healthBar = document.getElementById('kpi-bar-health');
    if (healthBadge) {
      healthBadge.textContent = p.health_status;
      if (p.health_score >= 75) {
        healthBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
        if (healthBar) healthBar.className = 'h-full rounded-full transition-all duration-300 bg-emerald-400';
      } else if (p.health_score >= 50) {
        healthBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-amber-500/10 text-amber-400 border-amber-500/30';
        if (healthBar) healthBar.className = 'h-full rounded-full transition-all duration-300 bg-amber-400';
      } else if (p.health_score >= 25) {
        healthBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-orange-500/10 text-orange-400 border-orange-500/30';
        if (healthBar) healthBar.className = 'h-full rounded-full transition-all duration-300 bg-orange-400';
      } else {
        healthBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-rose-500/10 text-rose-400 border-rose-500/30';
        if (healthBar) healthBar.className = 'h-full rounded-full transition-all duration-300 bg-rose-400';
      }
    }
    if (healthStage) healthStage.textContent = p.stage_desc;

    const rulTruth = document.getElementById('kpi-truth-rul');
    if (rulTruth) {
      rulTruth.textContent = p.true_rul !== null && p.true_rul !== undefined ? `${p.true_rul} CYC` : 'N/A (TEST)';
    }

    const failBadge = document.getElementById('kpi-badge-fail');
    const failBar = document.getElementById('kpi-bar-fail');
    if (failBadge) {
      failBadge.textContent = p.failure_status;
      if (p.failure_probability >= 0.5) {
        failBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30';
        if (failBar) failBar.className = 'h-full rounded-full transition-all duration-300 bg-rose-500';
      } else if (p.failure_probability >= 0.25) {
        failBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30';
        if (failBar) failBar.className = 'h-full rounded-full transition-all duration-300 bg-amber-400';
      } else {
        failBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#18181b] text-zinc-400 border border-[#27272a]';
        if (failBar) failBar.className = 'h-full rounded-full transition-all duration-300 bg-cyan-400';
      }
    }

    const anomBadge = document.getElementById('kpi-badge-anom');
    const anomBar = document.getElementById('kpi-bar-anom');
    const anomThresh = document.getElementById('kpi-thresh-anom');
    if (anomBadge) {
      anomBadge.textContent = p.anomaly_status;
      if (p.is_anomaly) {
        anomBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30';
        if (anomBar) anomBar.className = 'h-full rounded-full transition-all duration-300 bg-rose-500';
      } else {
        anomBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        if (anomBar) anomBar.className = 'h-full rounded-full transition-all duration-300 bg-emerald-400';
      }
    }
    if (anomThresh) anomThresh.textContent = (p.anomaly_threshold || 0.2434).toFixed(4);

    renderTrajectoryStats(this.selectedCycle, this.maxCycle, this.prediction);
  }

  smoothTransition(key, target, updateFn) {
    if (this.animFrameIds[key]) {
      cancelAnimationFrame(this.animFrameIds[key]);
    }

    const start = this.animValues[key] !== undefined ? this.animValues[key] : target;
    const startTime = performance.now();
    const duration = this.isPlaying ? 80 : 220;

    const frame = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * ease;
      this.animValues[key] = current;
      updateFn(current);
      if (progress < 1) {
        this.animFrameIds[key] = requestAnimationFrame(frame);
      } else {
        this.animValues[key] = target;
        updateFn(target);
      }
    };
    this.animFrameIds[key] = requestAnimationFrame(frame);
  }

  // ── Tab Management ──────────────────────────────────────────────────────────
  bindTabEvents() {
    const tabTraj = document.getElementById('dash-tab-btn-trajectory');
    const tabTelem = document.getElementById('dash-tab-btn-telemetry');
    const tabDiag = document.getElementById('dash-tab-btn-diagnostics');

    if (tabTraj) tabTraj.addEventListener('click', () => this.switchTab('trajectory'));
    if (tabTelem) tabTelem.addEventListener('click', () => this.switchTab('telemetry'));
    if (tabDiag) tabDiag.addEventListener('click', () => this.switchTab('diagnostics'));

    const metricRul = document.getElementById('dash-metric-rul');
    const metricFail = document.getElementById('dash-metric-fail');
    const metricAnom = document.getElementById('dash-metric-anom');

    if (metricRul) {
      metricRul.addEventListener('click', () => {
        this.activeMetric = 'rul';
        this.updateMetricButtonStyles();
        this.renderDegradationChart();
      });
    }
    if (metricFail) {
      metricFail.addEventListener('click', () => {
        this.activeMetric = 'fail';
        this.updateMetricButtonStyles();
        this.renderDegradationChart();
      });
    }
    if (metricAnom) {
      metricAnom.addEventListener('click', () => {
        this.activeMetric = 'anom';
        this.updateMetricButtonStyles();
        this.renderDegradationChart();
      });
    }
  }

  switchTab(tab) {
    this.activeTab = tab;
    const tabTraj = document.getElementById('dash-tab-btn-trajectory');
    const tabTelem = document.getElementById('dash-tab-btn-telemetry');
    const tabDiag = document.getElementById('dash-tab-btn-diagnostics');

    const panelTraj = document.getElementById('dash-panel-trajectory');
    const panelTelem = document.getElementById('dash-panel-telemetry');
    const panelDiag = document.getElementById('dash-panel-diagnostics');

    const inactiveClass =
      'px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-2 bg-[#181a1f] hover:bg-[#22262d] text-zinc-300 hover:text-white border border-[#2e333d] hover:border-zinc-400 shadow-sm';
    const activeClass =
      'px-3.5 py-2 rounded-lg text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-2 bg-cyan-500/15 text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(34,211,238,0.2)]';

    [tabTraj, tabTelem, tabDiag].forEach((t) => {
      if (t) t.className = inactiveClass;
    });
    [panelTraj, panelTelem, panelDiag].forEach((p) => {
      if (p) p.classList.add('hidden');
    });

    if (tab === 'trajectory') {
      if (tabTraj) tabTraj.className = activeClass;
      if (panelTraj) panelTraj.classList.remove('hidden');
    } else if (tab === 'telemetry') {
      if (tabTelem) tabTelem.className = activeClass;
      if (panelTelem) panelTelem.classList.remove('hidden');
    } else if (tab === 'diagnostics') {
      if (tabDiag) tabDiag.className = activeClass;
      if (panelDiag) panelDiag.classList.remove('hidden');
    }

    this.renderActiveTabContent();
  }

  updateMetricButtonStyles() {
    const btns = {
      rul: document.getElementById('dash-metric-rul'),
      fail: document.getElementById('dash-metric-fail'),
      anom: document.getElementById('dash-metric-anom'),
    };
    const activeStyles = {
      rul: 'px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer bg-cyan-500/25 text-cyan-300 border border-cyan-500/60 shadow-[0_0_8px_rgba(34,211,238,0.3)]',
      fail: 'px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer bg-amber-500/25 text-amber-300 border border-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.3)]',
      anom: 'px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.3)]',
    };
    const inactiveStyle =
      'px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer bg-[#181a1f] hover:bg-[#22262d] text-zinc-300 hover:text-white border border-[#2e333d] hover:border-zinc-400';

    Object.entries(btns).forEach(([k, b]) => {
      if (!b) return;
      b.className = k === this.activeMetric ? activeStyles[k] : inactiveStyle;
    });
  }

  renderActiveTabContent() {
    if (this.activeTab === 'trajectory') this.renderDegradationChart();
    else if (this.activeTab === 'telemetry') this.renderTelemetry();
    else if (this.activeTab === 'diagnostics') this.renderDiagnostics();
  }

  renderDegradationChart() {
    const svg = document.getElementById('dash-trajectory-svg');
    renderDegradationChart(svg, this.trendPoints, this.selectedCycle, this.maxCycle, this.activeMetric);
    renderTrajectoryStats(this.selectedCycle, this.maxCycle, this.prediction);
  }

  renderTelemetry() {
    renderTelemetryPanel(this.telemetry, this.telemetryView, this.telemetryFilter);
  }

  renderDiagnostics() {
    renderDiagnosticsPanel(this.prediction);
  }

  bindTelemetryFilterEvents() {
    const btnGrid = document.getElementById('dash-view-grid');
    const btnTable = document.getElementById('dash-view-table');
    const btnFilterAll = document.getElementById('dash-filter-all');
    const btnFilterDrift = document.getElementById('dash-filter-drift');

    const gridActive = 'p-2 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 cursor-pointer shadow-sm';
    const gridInactive = 'p-2 rounded-md bg-[#1a1c22] hover:bg-[#252830] text-zinc-400 hover:text-white border border-[#373b45] hover:border-zinc-400 cursor-pointer transition';
    const allActive = 'px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm cursor-pointer';
    const allInactive = 'px-3 py-1.5 rounded-lg bg-[#1a1c22] hover:bg-[#252830] text-zinc-300 hover:text-white border border-[#373b45] hover:border-zinc-400 cursor-pointer shadow-sm transition';
    const driftActive = 'px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm cursor-pointer';

    if (btnGrid) {
      btnGrid.addEventListener('click', () => {
        this.telemetryView = 'grid';
        btnGrid.className = gridActive;
        if (btnTable) btnTable.className = gridInactive;
        this.renderTelemetry();
      });
    }

    if (btnTable) {
      btnTable.addEventListener('click', () => {
        this.telemetryView = 'table';
        btnTable.className = gridActive;
        if (btnGrid) btnGrid.className = gridInactive;
        this.renderTelemetry();
      });
    }

    if (btnFilterAll) {
      btnFilterAll.addEventListener('click', () => {
        this.telemetryFilter = 'all';
        btnFilterAll.className = allActive;
        if (btnFilterDrift) btnFilterDrift.className = allInactive;
        this.renderTelemetry();
      });
    }

    if (btnFilterDrift) {
      btnFilterDrift.addEventListener('click', () => {
        this.telemetryFilter = 'drift';
        btnFilterDrift.className = driftActive;
        if (btnFilterAll) btnFilterAll.className = allInactive;
        this.renderTelemetry();
      });
    }
  }

  bindCsvEvents() {
    const fileInput = document.getElementById('dash-csv-input');
    if (!fileInput) return;

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const ingestBtn = document.getElementById('dash-btn-ingest');
      if (ingestBtn) {
        ingestBtn.innerHTML = `<span>SCORING...</span>`;
        ingestBtn.disabled = true;
      }

      try {
        const res = await uploadSensorCsvApi(file);
        alert(
          `Custom CSV Ingest & Scoring Success!\n\nCycle Evaluated: ${res.cycle}\nPredicted RUL: ${res.predicted_rul} cycles\nFailure Probability: ${(res.failure_probability * 100).toFixed(1)}%\nReconstruction MSE: ${res.anomaly_score}\nHealth Status: ${res.health_status}`
        );
      } catch (err) {
        alert('CSV scoring failed: ' + err.message);
      } finally {
        if (ingestBtn) {
          ingestBtn.innerHTML = `
            <svg class="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>INGEST CSV</span>
          `;
          ingestBtn.disabled = false;
        }
      }
    });
  }

  showError(msg) {
    const errBanner = document.getElementById('dash-error-banner');
    const errText = document.getElementById('dash-error-text');
    if (errBanner && errText) {
      errText.textContent = msg;
      errBanner.classList.remove('hidden');
    }
  }

  hideError() {
    const errBanner = document.getElementById('dash-error-banner');
    if (errBanner) errBanner.classList.add('hidden');
  }
}
