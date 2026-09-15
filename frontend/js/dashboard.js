/**
 * dashboard.js - AeroPulse Telemetry System & AI inference cockpit controller
 */

import {
  fetchEnginesApi,
  fetchEnginePredictionApi,
  fetchEngineTelemetryApi,
  fetchEngineTrendApi,
  uploadSensorCsvApi,
} from './api.js';

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
    const debounceMs = this.isPlaying ? 20 : 120;

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
        this.renderAdvisoryTicker();
        this.renderActiveTabContent();
      } catch (err) {
        this.showError('Telemetry error: ' + err.message);
      } finally {
        setTimeout(() => this.setInferringState(false), 140);
      }
    }, debounceMs);
  }

  // ── Header & Workspace Controls ─────────────────────────────────────────────
  bindHeaderEvents() {
    const accountBtn = document.getElementById('dash-btn-account');
    const logoutBtn = document.getElementById('dash-btn-logout');
    const ingestBtn = document.getElementById('dash-btn-ingest');
    const fileInput = document.getElementById('dash-csv-input');

    if (accountBtn) {
      accountBtn.addEventListener('click', () => this.app.setView('authenticated'));
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.app.handleLogout());
    }
    if (ingestBtn && fileInput) {
      ingestBtn.addEventListener('click', () => fileInput.click());
    }
  }

  bindWorkspaceEvents() {
    const engineSelect = document.getElementById('dash-engine-select');
    const stepBackBtn = document.getElementById('dash-btn-step-back');
    const stepFwdBtn = document.getElementById('dash-btn-step-fwd');
    const playBtn = document.getElementById('dash-btn-play');
    const cycleSlider = document.getElementById('dash-cycle-slider');
    const splitBtn = document.getElementById('dash-btn-split');
    const resetBtn = document.getElementById('dash-btn-reset');

    if (engineSelect) {
      engineSelect.addEventListener('change', async (e) => {
        const id = Number(e.target.value);
        this.selectedEngineId = id;
        const eng = this.engines.find((x) => x.engine_id === id);
        if (eng) {
          this.maxCycle = eng.max_cycle;
          this.selectedCycle = Math.min(145, eng.max_cycle);
          this.updateSliderBounds();
        }
        await this.loadTrend();
        await this.runInference();
      });
    }

    if (stepBackBtn) {
      stepBackBtn.addEventListener('click', () => this.stepCycle(-1));
    }
    if (stepFwdBtn) {
      stepFwdBtn.addEventListener('click', () => this.stepCycle(1));
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => this.togglePlayback());
    }

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

    this.renderTrajectoryStats();
  }

  renderTrajectoryStats() {
    // 1. Lifespan Progress
    const progressVal = document.getElementById('traj-stat-progress-val');
    const progressBar = document.getElementById('traj-stat-progress-bar');
    const progressDesc = document.getElementById('traj-stat-progress-desc');
    const pct = Math.min(100, Math.max(0, (this.selectedCycle / this.maxCycle) * 100)).toFixed(1);
    if (progressVal) progressVal.textContent = `${pct}%`;
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressDesc) progressDesc.textContent = `Cycle ${this.selectedCycle} of ${this.maxCycle} elapsed`;

    // 2. Predicted End-of-Life (EOL)
    const rul = this.prediction ? this.prediction.predicted_rul : Math.max(0, this.maxCycle - this.selectedCycle + 35);
    const eolCycle = Math.round(this.selectedCycle + rul);
    const eolVal = document.getElementById('traj-stat-eol-val');
    if (eolVal) eolVal.textContent = `Cycle ~${eolCycle}`;

    // 3. Critical Horizon (RUL <= 30)
    const horizonVal = document.getElementById('traj-stat-horizon-val');
    const horizonBadge = document.getElementById('traj-stat-horizon-badge');
    const buffer = Math.round(rul - 30);
    if (horizonVal) {
      if (buffer > 0) {
        horizonVal.textContent = `${buffer} Cycles Left`;
        horizonVal.className = 'text-2xl font-bold font-mono text-amber-400 tracking-tight';
      } else {
        horizonVal.textContent = `0 Cycles Left`;
        horizonVal.className = 'text-2xl font-bold font-mono text-rose-400 tracking-tight';
      }
    }
    if (horizonBadge) {
      if (buffer <= 0) {
        horizonBadge.textContent = 'CUTOFF REACHED';
        horizonBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/40';
      } else if (buffer <= 30) {
        horizonBadge.textContent = 'IMMINENT CUTOFF';
        horizonBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/40';
      } else {
        horizonBadge.textContent = 'SAFETY BUFFER';
        horizonBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      }
    }

    // 4. Model Trajectory State
    const stateVal = document.getElementById('traj-stat-state-val');
    const stateDesc = document.getElementById('traj-stat-state-desc');
    const stateDot = document.getElementById('traj-stat-state-dot');
    const stateBadge = document.getElementById('traj-stat-state-badge');

    const riskPct = this.prediction ? (this.prediction.failure_probability * 100).toFixed(1) : '0.0';
    const failProb = this.prediction ? this.prediction.failure_probability : 0.0;
    const isAnom = this.prediction ? (this.prediction.anomaly_score > (this.prediction.anomaly_threshold || 0.2434)) : false;

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

  setInferringState(isInferring) {
    const pingDot = document.getElementById('dash-cycle-infer-ping');
    if (pingDot) {
      if (isInferring) pingDot.classList.remove('hidden');
      else pingDot.classList.add('hidden');
    }
  }

  // ── KPI Metrics Rendering & Smooth Numbers ──────────────────────────────────
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
    this.renderTrajectoryStats();
  }

  smoothTransition(key, target, updateFn) {
    const start = this.animValues[key] || target;
    const startTime = performance.now();
    const duration = this.isPlaying ? 80 : 250;

    const frame = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * ease;
      this.animValues[key] = current;
      updateFn(current);
      if (progress < 1) requestAnimationFrame(frame);
      else {
        this.animValues[key] = target;
        updateFn(target);
      }
    };
    requestAnimationFrame(frame);
  }

  renderAdvisoryTicker() {
    const tickerContainer = document.getElementById('dash-advisory-ticker');
    if (!tickerContainer || !this.prediction || !this.prediction.recommendation) return;

    const rec = this.prediction.recommendation;
    const dot = document.getElementById('dash-ticker-dot');
    const priority = document.getElementById('dash-ticker-priority');
    const headline = document.getElementById('dash-ticker-headline');
    const eta = document.getElementById('dash-ticker-eta');

    let dotColor = 'bg-cyan-400';
    let pText = 'INFO';
    if (rec.priority <= 1) {
      dotColor = 'bg-rose-400 animate-ping';
      pText = 'CRITICAL P1';
    } else if (rec.priority <= 2) {
      dotColor = 'bg-amber-400';
      pText = 'ELEVATED P2';
    } else if (rec.priority <= 3) {
      dotColor = 'bg-yellow-400';
      pText = 'PREVENTIVE P3';
    }

    if (dot) dot.className = `w-2 h-2 rounded-full ${dotColor}`;
    if (priority) priority.textContent = `[${pText}]`;
    if (headline) headline.textContent = `${rec.headline} — ${rec.body}`;
    if (eta) eta.textContent = `ACTION ETA: ~${rec.eta_cycles} CYCLES`;

    tickerContainer.classList.remove('hidden');
  }

  // ── Tab Management ──────────────────────────────────────────────────────────
  bindTabEvents() {
    const tabTraj = document.getElementById('dash-tab-btn-trajectory');
    const tabTelem = document.getElementById('dash-tab-btn-telemetry');
    const tabDiag = document.getElementById('dash-tab-btn-diagnostics');

    if (tabTraj) {
      tabTraj.addEventListener('click', () => this.switchTab('trajectory'));
    }
    if (tabTelem) {
      tabTelem.addEventListener('click', () => this.switchTab('telemetry'));
    }
    if (tabDiag) {
      tabDiag.addEventListener('click', () => this.switchTab('diagnostics'));
    }

    // Metric selectors on trajectory chart
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
      this.renderDegradationChart();
    } else if (tab === 'telemetry') {
      if (tabTelem) tabTelem.className = activeClass;
      if (panelTelem) panelTelem.classList.remove('hidden');
      this.renderTelemetryPanel();
    } else {
      if (tabDiag) tabDiag.className = activeClass;
      if (panelDiag) panelDiag.classList.remove('hidden');
      this.renderDiagnosticsPanel();
    }
  }

  updateMetricButtonStyles() {
    const btns = {
      rul: document.getElementById('dash-metric-rul'),
      fail: document.getElementById('dash-metric-fail'),
      anom: document.getElementById('dash-metric-anom'),
    };
    const activeStyles = {
      rul: 'px-3 py-1.5 rounded-lg font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)] cursor-pointer flex items-center gap-1.5 transition-all',
      fail: 'px-3 py-1.5 rounded-lg font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)] cursor-pointer flex items-center gap-1.5 transition-all',
      anom: 'px-3 py-1.5 rounded-lg font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)] cursor-pointer flex items-center gap-1.5 transition-all',
    };
    const inactiveStyle =
      'px-3 py-1.5 rounded-lg font-mono font-medium bg-[#1a1c22] hover:bg-[#252830] text-zinc-300 hover:text-white border border-[#373b45] hover:border-zinc-400 cursor-pointer flex items-center gap-1.5 transition-all shadow-sm';

    Object.keys(btns).forEach((k) => {
      const b = btns[k];
      if (!b) return;
      if (k === this.activeMetric) {
        b.className = activeStyles[k];
      } else {
        b.className = inactiveStyle;
      }
    });
  }

  renderActiveTabContent() {
    if (this.activeTab === 'trajectory') this.renderDegradationChart();
    else if (this.activeTab === 'telemetry') this.renderTelemetryPanel();
    else if (this.activeTab === 'diagnostics') this.renderDiagnosticsPanel();
  }

  // ── Tab 1: Degradation Trajectory Chart ──────────────────────────────────────
  renderDegradationChart() {
    const svg = document.getElementById('dash-trajectory-svg');
    if (!svg || this.trendPoints.length === 0) return;

    const width = 750;
    const height = 280;
    const padding = { top: 25, right: 35, bottom: 35, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const minC = 30;
    const maxC = this.maxCycle;

    const getX = (c) => padding.left + ((c - minC) / (maxC - minC)) * chartW;

    // Build SVG inner elements
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

    // 1. Grid lines and X-axis ticks
    const step = Math.max(20, Math.round((maxC - minC) / 5 / 10) * 10);
    for (let c = minC; c <= maxC; c += step) {
      const x = getX(c);
      svgContent += `
        <line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="#1f2228" stroke-dasharray="3,3" />
        <text x="${x}" y="${height - 12}" fill="#71717a" font-size="10" font-family="monospace" text-anchor="middle">Cycle ${c}</text>
      `;
    }
    // Mark max cycle
    const maxX = getX(maxC);
    svgContent += `
      <text x="${maxX}" y="${height - 12}" fill="#a1a1aa" font-size="10" font-family="monospace" font-weight="bold" text-anchor="end">Cycle ${maxC} (Max)</text>
    `;

    let curY = padding.top + chartH / 2;

    // 2. Trajectory Curves based on active metric
    if (this.activeMetric === 'rul') {
      const maxRul = 200;
      const getY = (r) => height - padding.bottom - (Math.max(0, r) / maxRul) * chartH;

      // Y-axis gridlines & labels
      [200, 100, 0].forEach((v) => {
        const y = getY(v);
        svgContent += `
          <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#1f2228" stroke-width="1" />
          <text x="${padding.left - 8}" y="${y + 3}" fill="#71717a" font-size="10" font-family="monospace" text-anchor="end">${v === 200 ? '200 cycles' : v === 100 ? '100c' : '0'}</text>
        `;
      });

      // Critical Threshold line at RUL = 30
      const threshY = getY(30);
      svgContent += `
        <line x1="${padding.left}" y1="${threshY}" x2="${width - padding.right}" y2="${threshY}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.85"/>
        <text x="${width - padding.right - 5}" y="${threshY - 5}" fill="#f59e0b" font-size="9" font-family="monospace" font-weight="bold" text-anchor="end">Critical Threshold: 30c</text>
      `;

      // Ground truth line if available
      const truthD = this.trendPoints.reduce((acc, pt, idx) => {
        if (pt.true_rul === null || pt.true_rul === undefined) return acc;
        const x = getX(pt.cycle);
        const y = getY(pt.true_rul);
        return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
      }, '');
      if (truthD) {
        svgContent += `<path d="${truthD}" fill="none" stroke="#52525b" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.7"/>`;
      }

      // Predicted path & gradient area
      const pathD = this.trendPoints.reduce((acc, pt, idx) => {
        const x = getX(pt.cycle);
        const y = getY(pt.predicted_rul);
        return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
      }, '');
      if (this.trendPoints.length > 0) {
        const firstX = getX(this.trendPoints[0].cycle);
        const lastX = getX(this.trendPoints[this.trendPoints.length - 1].cycle);
        const baselineY = height - padding.bottom;
        const areaD = `${pathD} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
        svgContent += `<path d="${areaD}" fill="url(#traj-grad-rul)" />`;
      }
      svgContent += `<path d="${pathD}" fill="none" stroke="#22d3ee" stroke-width="2.5" />`;

      // Find Y for selected cycle
      const curPt = this.trendPoints.find((p) => Math.abs(p.cycle - this.selectedCycle) <= 2) || this.trendPoints[0];
      if (curPt) curY = getY(curPt.predicted_rul);
    } else if (this.activeMetric === 'fail') {
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

      const pathD = this.trendPoints.reduce((acc, pt, idx) => {
        const x = getX(pt.cycle);
        const y = getY(pt.failure_probability);
        return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
      }, '');
      if (this.trendPoints.length > 0) {
        const firstX = getX(this.trendPoints[0].cycle);
        const lastX = getX(this.trendPoints[this.trendPoints.length - 1].cycle);
        const baselineY = height - padding.bottom;
        const areaD = `${pathD} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
        svgContent += `<path d="${areaD}" fill="url(#traj-grad-fail)" />`;
      }
      svgContent += `<path d="${pathD}" fill="none" stroke="#f59e0b" stroke-width="2.5" />`;

      const curPt = this.trendPoints.find((p) => Math.abs(p.cycle - this.selectedCycle) <= 2) || this.trendPoints[0];
      if (curPt) curY = getY(curPt.failure_probability);
    } else {
      const maxAnom = 0.4;
      const getY = (a) => height - padding.bottom - (Math.min(maxAnom, a) / maxAnom) * chartH;

      [0.4, 0.2, 0.0].forEach((v) => {
        const y = getY(v);
        svgContent += `
          <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#1f2228" stroke-width="1" />
          <text x="${padding.left - 8}" y="${y + 3}" fill="#71717a" font-size="10" font-family="monospace" text-anchor="end">${v.toFixed(2)}</text>
        `;
      });

      const threshY = getY(this.anomalyThreshold);
      svgContent += `
        <line x1="${padding.left}" y1="${threshY}" x2="${width - padding.right}" y2="${threshY}" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="5,4" opacity="0.85"/>
        <text x="${width - padding.right - 5}" y="${threshY - 5}" fill="#f43f5e" font-size="9" font-family="monospace" font-weight="bold" text-anchor="end">ANOMALY THRESHOLD (${this.anomalyThreshold})</text>
      `;

      const pathD = this.trendPoints.reduce((acc, pt, idx) => {
        const x = getX(pt.cycle);
        const y = getY(pt.anomaly_score);
        return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
      }, '');
      if (this.trendPoints.length > 0) {
        const firstX = getX(this.trendPoints[0].cycle);
        const lastX = getX(this.trendPoints[this.trendPoints.length - 1].cycle);
        const baselineY = height - padding.bottom;
        const areaD = `${pathD} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
        svgContent += `<path d="${areaD}" fill="url(#traj-grad-anom)" />`;
      }
      svgContent += `<path d="${pathD}" fill="none" stroke="#10b981" stroke-width="2.5" />`;

      const curPt = this.trendPoints.find((p) => Math.abs(p.cycle - this.selectedCycle) <= 2) || this.trendPoints[0];
      if (curPt) curY = getY(curPt.anomaly_score);
    }

    // 3. Current Cycle vertical cursor line & orange intersection node
    const curX = getX(this.selectedCycle);
    svgContent += `
      <line x1="${curX}" y1="${padding.top}" x2="${curX}" y2="${height - padding.bottom}" stroke="#f59e0b" stroke-width="1.8" />
      <circle cx="${curX}" cy="${curY}" r="5" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" filter="drop-shadow(0 0 6px rgba(245,158,11,0.9))" />
      <rect x="${curX - 28}" y="${padding.top - 18}" width="56" height="18" rx="4" fill="#181a1f" stroke="#f59e0b" stroke-width="1" />
      <text x="${curX}" y="${padding.top - 5}" fill="#f59e0b" font-size="10" font-family="monospace" font-weight="bold" text-anchor="middle">C${this.selectedCycle}</text>
    `;

    svg.innerHTML = svgContent;
    this.renderTrajectoryStats();
  }

  // ── Tab 2: Sensor Matrix & Telemetry ─────────────────────────────────────────
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
        this.renderTelemetryPanel();
      });
    }

    if (btnTable) {
      btnTable.addEventListener('click', () => {
        this.telemetryView = 'table';
        btnTable.className = gridActive;
        if (btnGrid) btnGrid.className = gridInactive;
        this.renderTelemetryPanel();
      });
    }

    if (btnFilterAll) {
      btnFilterAll.addEventListener('click', () => {
        this.telemetryFilter = 'all';
        btnFilterAll.className = allActive;
        if (btnFilterDrift) btnFilterDrift.className = allInactive;
        this.renderTelemetryPanel();
      });
    }

    if (btnFilterDrift) {
      btnFilterDrift.addEventListener('click', () => {
        this.telemetryFilter = 'drift';
        btnFilterDrift.className = driftActive;
        if (btnFilterAll) btnFilterAll.className = allInactive;
        this.renderTelemetryPanel();
      });
    }
  }

  renderTelemetryPanel() {
    const gridEl = document.getElementById('dash-telemetry-grid');
    const tableEl = document.getElementById('dash-telemetry-table');
    if (!gridEl || !tableEl) return;

    const filtered = this.telemetry.filter((s) => {
      if (this.telemetryFilter === 'drift') return s.status === 'WARNING' || s.status === 'CRITICAL';
      return true;
    });

    const warningCount = this.telemetry.filter((s) => s.status === 'WARNING' || s.status === 'CRITICAL').length;
    const warningBadge = document.getElementById('dash-drift-count-badge');
    if (warningBadge) warningBadge.textContent = `${warningCount} DRIFTING`;
    const tabDriftBadge = document.getElementById('dash-tab-drift-count');
    if (tabDriftBadge) tabDriftBadge.textContent = `${warningCount} Drift`;

    if (this.telemetryView === 'grid') {
      gridEl.classList.remove('hidden');
      tableEl.classList.add('hidden');
      gridEl.innerHTML = filtered
        .map((s) => {
          let badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
          let borderHighlight = 'border-[#27272a]';
          if (s.status === 'CRITICAL') {
            badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
            borderHighlight = 'border-rose-500/40';
          } else if (s.status === 'WARNING') {
            badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            borderHighlight = 'border-amber-500/30';
          }

          return `
            <div class="p-3 bg-[#18181b] rounded-lg border ${borderHighlight} flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between text-[11px] font-mono mb-1">
                  <span class="text-zinc-400">${s.sensor_id.toUpperCase()}</span>
                  <span class="px-1.5 py-0.2 rounded border text-[9px] font-semibold ${badgeColor}">${s.status}</span>
                </div>
                <h4 class="text-xs font-semibold text-zinc-200 truncate" title="${s.name}">${s.name}</h4>
              </div>
              <div class="mt-3 flex items-baseline justify-between font-mono">
                <div>
                  <span class="text-lg font-bold text-white">${s.value}</span>
                  <span class="text-[10px] text-zinc-500 ml-1">${s.unit}</span>
                </div>
                <div class="text-right text-[11px]">
                  <span class="${s.delta >= 0 ? 'text-amber-400' : 'text-cyan-400'}">${s.delta >= 0 ? '+' : ''}${s.delta}</span>
                  <span class="text-zinc-500 text-[9px]"> (${s.delta_pct}%)</span>
                </div>
              </div>
              <div class="mt-2 text-[10px] font-mono text-zinc-500 flex justify-between border-t border-[#27272a] pt-1.5">
                <span>NOMINAL:</span>
                <span>${s.nominal} ${s.unit}</span>
              </div>
            </div>
          `;
        })
        .join('');
    } else {
      gridEl.classList.add('hidden');
      tableEl.classList.remove('hidden');
      const tbody = document.getElementById('dash-telemetry-tbody');
      if (tbody) {
        tbody.innerHTML = filtered
          .map((s) => {
            let badgeColor = 'text-emerald-400';
            if (s.status === 'CRITICAL') badgeColor = 'text-rose-400 font-bold';
            else if (s.status === 'WARNING') badgeColor = 'text-amber-400 font-semibold';

            return `
              <tr class="border-b border-[#27272a] hover:bg-[#18181b]/50">
                <td class="py-2 px-3 font-mono text-cyan-400">${s.sensor_id.toUpperCase()}</td>
                <td class="py-2 px-3 text-zinc-200">${s.name}</td>
                <td class="py-2 px-3 font-mono text-white text-right font-bold">${s.value} <span class="text-zinc-500 text-[10px] font-normal">${s.unit}</span></td>
                <td class="py-2 px-3 font-mono text-zinc-400 text-right">${s.nominal}</td>
                <td class="py-2 px-3 font-mono text-right ${s.delta >= 0 ? 'text-amber-400' : 'text-cyan-400'}">${s.delta >= 0 ? '+' : ''}${s.delta} (${s.delta_pct}%)</td>
                <td class="py-2 px-3 font-mono text-center ${badgeColor}">${s.status}</td>
              </tr>
            `;
          })
          .join('');
      }
    }
  }

  // ── Tab 3: Diagnostics & Prescription ───────────────────────────────────────
  renderDiagnosticsPanel() {
    if (!this.prediction) return;
    const p = this.prediction;

    // Stage badge
    const stageBadge = document.getElementById('dash-diag-stage-badge');
    const stageDesc = document.getElementById('dash-diag-stage-desc');
    if (stageBadge) stageBadge.textContent = p.stage_desc;
    if (stageDesc) {
      if (p.stage_desc.includes('STAGE 4')) {
        stageDesc.textContent = 'High thermal gradients and critical pressure loss across compressor stages. Fast degradation slope toward cycle limit.';
      } else if (p.stage_desc.includes('STAGE 3')) {
        stageDesc.textContent = 'Accelerated degradation detected in turbine blades and coolant bleed. Secondary wear patterns emerging.';
      } else if (p.stage_desc.includes('STAGE 2')) {
        stageDesc.textContent = 'Slight sensor drift observed in HPC pressure and fuel flow ratios. Minor thermal deviations within tolerable margins.';
      } else {
        stageDesc.textContent = 'Normal turbine running clearance. Acoustic, vibrational, and thermal sensor signatures well within healthy envelopes.';
      }
    }

    // Root causes
    const rootCausesContainer = document.getElementById('dash-diag-root-causes');
    if (rootCausesContainer) {
      rootCausesContainer.innerHTML = (p.root_cause_attribution || [])
        .map((rc) => `
          <div class="space-y-1">
            <div class="flex justify-between text-xs font-mono">
              <span class="text-zinc-200">${rc.name} (${rc.sensor_id.toUpperCase()})</span>
              <span class="text-cyan-400 font-bold">${rc.importance_pct}%</span>
            </div>
            <div class="w-full bg-[#18181b] h-1.5 rounded-full overflow-hidden">
              <div class="h-full bg-cyan-400 rounded-full" style="width: ${rc.importance_pct}%"></div>
            </div>
          </div>
        `)
        .join('');
    }

    // Prescriptive card
    if (p.recommendation) {
      const rec = p.recommendation;
      const recTitle = document.getElementById('dash-diag-rec-title');
      const recBody = document.getElementById('dash-diag-rec-body');
      const recEta = document.getElementById('dash-diag-rec-eta');
      if (recTitle) recTitle.textContent = rec.headline;
      if (recBody) recBody.textContent = rec.body;
      if (recEta) recEta.textContent = `ETA: ~${rec.eta_cycles} Cycles`;
    }
  }

  // ── CSV Ingest ──────────────────────────────────────────────────────────────
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
        fileInput.value = '';
      }
    });
  }

  showError(msg) {
    const banner = document.getElementById('dash-error-banner');
    const text = document.getElementById('dash-error-text');
    if (banner && text) {
      text.textContent = msg;
      banner.classList.remove('hidden');
    }
  }

  hideError() {
    const banner = document.getElementById('dash-error-banner');
    if (banner) banner.classList.add('hidden');
  }
}
