/**
 * telemetryView.js - 15-Channel Telemetry Matrix (Grid & Table Views)
 */

export function renderTelemetryPanel(telemetry, viewMode = 'grid', filter = 'all') {
  const gridEl = document.getElementById('dash-telemetry-grid');
  const tableEl = document.getElementById('dash-telemetry-table');
  if (!gridEl || !tableEl || !telemetry) return;

  const filtered = telemetry.filter((s) => {
    if (filter === 'drift') return s.status === 'WARNING' || s.status === 'CRITICAL';
    return true;
  });

  const warningCount = telemetry.filter((s) => s.status === 'WARNING' || s.status === 'CRITICAL').length;
  const warningBadge = document.getElementById('dash-drift-count-badge');
  if (warningBadge) warningBadge.textContent = `${warningCount} DRIFTING`;
  const tabDriftBadge = document.getElementById('dash-tab-drift-count');
  if (tabDriftBadge) tabDriftBadge.textContent = `${warningCount} Drift`;

  if (viewMode === 'grid') {
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
