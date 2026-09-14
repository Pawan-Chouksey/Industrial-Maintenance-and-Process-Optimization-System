/**
 * diagnosticsView.js - AI Root-Cause Diagnostics & Prescriptive Actions
 */

export function renderDiagnosticsPanel(prediction) {
  if (!prediction) return;
  const p = prediction;

  // Degradation Stage badge & description
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

  // Root causes feature importance ranking bars
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

  // Prescriptive Maintenance Card
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

export function renderAdvisoryTicker(prediction) {
  const tickerContainer = document.getElementById('dash-advisory-ticker');
  if (!tickerContainer || !prediction || !prediction.recommendation) return;

  const rec = prediction.recommendation;
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
