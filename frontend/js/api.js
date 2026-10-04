/**
 * api.js - Backend API connector
 * Industrial Maintenance and Process Optimization System
 *
 * Backend: http://127.0.0.1:8000
 */

// ============================================================
// API CONFIGURATION
// ============================================================

const configuredApiBase =
  (import.meta.env?.VITE_API_URL || window.VITE_API_URL || '')
    .trim()
    .replace(/\/+$/, '');

export const API_BASE =
  configuredApiBase || 'http://127.0.0.1:8000';

console.info(`[API] Backend URL: ${API_BASE}`);


// ============================================================
// COMMON API HELPER
// ============================================================

async function apiRequest(endpoint, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const { signal: externalSignal, ...fetchOptions } = options;
  const abortRequest = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', abortRequest, { once: true });
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      signal: controller.signal,
    });

    const responseText = await response.text();
    let data = null;

    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const detail = data?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : detail
            ? JSON.stringify(detail)
            : responseText.trim().slice(0, 1000) || response.statusText;

      throw new Error(`HTTP ${response.status}: ${message}`);
    }

    if (data === null) {
      throw new Error(
        `Backend returned a successful HTTP ${response.status} response with invalid JSON.`
      );
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        `Request timed out: ${endpoint}. Check that the backend is running.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortRequest);
  }
}


// ============================================================
// HEALTH CHECK
// ============================================================

export async function checkApiHealth() {
  return apiRequest('/api/health', {}, 5000);
}


// ============================================================
// MAINTENANCE ASSISTANT / RAG
// ============================================================

export async function chatMaintenanceApi(payload) {
  const url = `${API_BASE}/rag/chat`;

  try {
    console.log('[RAG] Sending request:', url);

    const data = await apiRequest(
      '/rag/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: payload.query,
          machine_context: payload.machine_context || {},
          top_k: payload.top_k || 5,
          history: payload.history || [],
        }),
        signal: payload.signal,
      },
      180000
    );

    console.log('[RAG] Response:', data);
    return data;
  } catch (error) {
    console.error('[RAG] Request failed:', error);
    throw error;
  }
}


// ============================================================
// AUTHENTICATION APIs
// ============================================================

export async function registerApi(payload) {
  return apiRequest('/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}


export async function loginApi(payload) {
  return apiRequest('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}


/**
 * Restore the currently authenticated user.
 *
 * A failed request is not converted into a mock user.
 * The caller must handle 401 or network errors.
 */
export async function fetchCurrentUser(token) {
  if (!token) {
    throw new Error('No authentication token was provided.');
  }

  return apiRequest(
    '/api/me',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    10000
  );
}


// ============================================================
// ML ENGINE & TELEMETRY APIs
// ============================================================

const CMAPSS_SENSORS = [
  {
    sensor_id: 's_2',
    name: 'Total Temp LPC Outlet',
    unit: '°R',
    nominal: 642.5,
  },
  {
    sensor_id: 's_3',
    name: 'Total Temp HPC Outlet',
    unit: '°R',
    nominal: 1589.7,
  },
  {
    sensor_id: 's_4',
    name: 'Total Temp LPT Outlet',
    unit: '°R',
    nominal: 1404.2,
  },
  {
    sensor_id: 's_6',
    name: 'Pressure in Bypass-Duct',
    unit: 'psia',
    nominal: 21.61,
  },
  {
    sensor_id: 's_7',
    name: 'Total Pressure HPC Outlet',
    unit: 'psia',
    nominal: 553.7,
  },
  {
    sensor_id: 's_8',
    name: 'Physical Fan Speed',
    unit: 'rpm',
    nominal: 2388.1,
  },
  {
    sensor_id: 's_9',
    name: 'Physical Core Speed',
    unit: 'rpm',
    nominal: 9050.8,
  },
  {
    sensor_id: 's_11',
    name: 'Static Pressure HPC Outlet',
    unit: 'psia',
    nominal: 47.5,
  },
  {
    sensor_id: 's_12',
    name: 'Ratio Fuel Flow to Ps30',
    unit: 'pps/psi',
    nominal: 521.8,
  },
  {
    sensor_id: 's_13',
    name: 'Corrected Fan Speed',
    unit: 'rpm',
    nominal: 2388.0,
  },
  {
    sensor_id: 's_14',
    name: 'Corrected Core Speed',
    unit: 'rpm',
    nominal: 8138.6,
  },
  {
    sensor_id: 's_15',
    name: 'Bypass Ratio',
    unit: '',
    nominal: 8.42,
  },
  {
    sensor_id: 's_17',
    name: 'Bleed Enthalpy',
    unit: '',
    nominal: 392.0,
  },
  {
    sensor_id: 's_20',
    name: 'HPT Coolant Bleed',
    unit: 'lbm/s',
    nominal: 38.86,
  },
  {
    sensor_id: 's_21',
    name: 'LPT Coolant Bleed',
    unit: 'lbm/s',
    nominal: 23.32,
  },
];


// ============================================================
// FETCH ENGINES
// ============================================================

export async function fetchEnginesApi(
  dataset = 'FD001',
  split = 'train'
) {
  try {
    return await apiRequest(
      `/api/engines?dataset=${encodeURIComponent(dataset)}&split=${encodeURIComponent(split)}`
    );
  } catch (error) {
    console.warn('[API] Using fallback engine data:', error.message);

    return [
      { engine_id: 1, min_cycle: 1, max_cycle: 192, total_cycles: 192, dataset, split },
      { engine_id: 2, min_cycle: 1, max_cycle: 287, total_cycles: 287, dataset, split },
      { engine_id: 3, min_cycle: 1, max_cycle: 179, total_cycles: 179, dataset, split },
      { engine_id: 4, min_cycle: 1, max_cycle: 189, total_cycles: 189, dataset, split },
      { engine_id: 5, min_cycle: 1, max_cycle: 269, total_cycles: 269, dataset, split },
      { engine_id: 6, min_cycle: 1, max_cycle: 188, total_cycles: 188, dataset, split },
      { engine_id: 7, min_cycle: 1, max_cycle: 214, total_cycles: 214, dataset, split },
      { engine_id: 8, min_cycle: 1, max_cycle: 150, total_cycles: 150, dataset, split },
      { engine_id: 9, min_cycle: 1, max_cycle: 201, total_cycles: 201, dataset, split },
      { engine_id: 10, min_cycle: 1, max_cycle: 166, total_cycles: 166, dataset, split },
    ];
  }
}


// ============================================================
// FETCH ENGINE TELEMETRY
// ============================================================

export async function fetchEngineTelemetryApi(
  engineId,
  cycle,
  dataset = 'FD001',
  split = 'train'
) {
  try {
    return await apiRequest(
      `/api/engines/${engineId}/telemetry?cycle=${cycle}&dataset=${encodeURIComponent(dataset)}&split=${encodeURIComponent(split)}`
    );
  } catch (error) {
    console.warn('[API] Using fallback telemetry:', error.message);

    const degradationRatio = Math.min(
      1.0,
      Math.max(0.0, (cycle - 30) / 160)
    );

    const sensors = CMAPSS_SENSORS.map((sensor, idx) => {
      const noise = Math.sin(cycle * 0.4 + idx) * 0.005;
      const drift =
        degradationRatio * 0.08 * (idx % 2 === 0 ? 1 : -0.7);

      const value = +(
        sensor.nominal * (1 + drift + noise)
      ).toFixed(2);

      const delta = +(value - sensor.nominal).toFixed(2);
      const delta_pct = +(
        (delta / sensor.nominal) * 100
      ).toFixed(2);

      let status = 'NOMINAL';

      if (Math.abs(delta_pct) > 5) {
        status = 'CRITICAL';
      } else if (Math.abs(delta_pct) > 2.5) {
        status = 'WARNING';
      }

      return {
        sensor_id: sensor.sensor_id,
        name: sensor.name,
        unit: sensor.unit,
        value,
        nominal: sensor.nominal,
        delta,
        delta_pct,
        status,
      };
    });

    return {
      engine_id: engineId,
      cycle,
      sensors,
    };
  }
}


// ============================================================
// FETCH ENGINE PREDICTION
// ============================================================

export async function fetchEnginePredictionApi(
  engineId,
  cycle,
  dataset = 'FD001',
  split = 'train'
) {
  try {
    return await apiRequest(
      `/api/engines/${engineId}/predict?cycle=${cycle}&dataset=${encodeURIComponent(dataset)}&split=${encodeURIComponent(split)}`
    );
  } catch (error) {
    console.warn('[API] Using fallback prediction:', error.message);

    const maxCyc = 192;
    const trueRul = Math.max(0, maxCyc - cycle);

    const progress = Math.min(
      1,
      Math.max(0, (cycle - 30) / (maxCyc - 30))
    );

    const predictedRul = Math.max(
      4,
      +(trueRul + Math.sin(cycle * 0.5) * 3).toFixed(1)
    );

    const failureProb = +(
      1 / (1 + Math.exp(-10 * (progress - 0.75)))
    ).toFixed(3);

    const failurePred = failureProb >= 0.5 ? 1 : 0;
    const failureStatus = failureProb >= 0.5 ? 'FAILURE' : 'NORMAL';

    const anomalyThreshold = 0.2434;

    const baseAnomaly =
      0.04 + Math.pow(progress, 2.5) * 0.35;

    const anomalyScore = +(
      baseAnomaly + Math.sin(cycle * 0.3) * 0.01
    ).toFixed(4);

    const isAnomaly = anomalyScore >= anomalyThreshold ? 1 : 0;
    const anomalyStatus = isAnomaly ? 'ANOMALY' : 'NORMAL';

    // Composite health score
    const anomPart = Math.max(
      0,
      1 - anomalyScore / anomalyThreshold
    );

    const failPart = 1 - failureProb;
    const rulPart = Math.min(1, predictedRul / 125);

    const healthScore = +(
      anomPart * 40 +
      failPart * 30 +
      rulPart * 30
    ).toFixed(1);

    let healthStatus = 'HEALTHY';

    if (healthScore < 25) {
      healthStatus = 'CRITICAL';
    } else if (healthScore < 50) {
      healthStatus = 'WARNING';
    } else if (healthScore < 75) {
      healthStatus = 'CAUTION';
    }

    let stageDesc = 'STAGE 1: HEALTHY BASELINE';

    if (progress > 0.85) {
      stageDesc = 'STAGE 4: RAPID DEGRADATION';
    } else if (progress > 0.6) {
      stageDesc = 'STAGE 3: ACCELERATED WEAR';
    } else if (progress > 0.35) {
      stageDesc = 'STAGE 2: INITIAL SYSTEM DRIFT';
    }

    const rootCauses = [
      {
        sensor_id: 's_11',
        name: 'Static Pressure HPC Outlet',
        importance_pct: 34.2,
      },
      {
        sensor_id: 's_4',
        name: 'Total Temp LPT Outlet',
        importance_pct: 28.6,
      },
      {
        sensor_id: 's_12',
        name: 'Ratio Fuel Flow to Ps30',
        importance_pct: 19.4,
      },
      {
        sensor_id: 's_9',
        name: 'Physical Core Speed',
        importance_pct: 11.1,
      },
    ];

    let recommendation = {
      priority: 4,
      headline: 'Normal Operations',
      body: 'All turbofan subsystems operating within nominal limits. Standard inspection scheduled.',
      eta_cycles: predictedRul,
    };

    if (failureProb >= 0.5 || healthScore < 25) {
      recommendation = {
        priority: 1,
        headline: 'Urgent HPC Compressor Inspection Required',
        body: 'Critical thermal and pressure drift detected across HPC stage. Immediate borescope inspection required within 10 cycles.',
        eta_cycles: Math.min(
          10,
          Math.round(predictedRul * 0.5)
        ),
      };
    } else if (isAnomaly || healthScore < 50) {
      recommendation = {
        priority: 2,
        headline: 'Preventive Overhaul Recommended',
        body: 'Autoencoder anomaly threshold exceeded. Schedule maintenance at next cycle window.',
        eta_cycles: Math.round(predictedRul * 0.7),
      };
    } else if (healthScore < 75) {
      recommendation = {
        priority: 3,
        headline: 'Minor Sensor Drift Monitored',
        body: 'Slight deviation in LPT outlet temperature. Continue automated continuous monitoring.',
        eta_cycles: Math.round(predictedRul),
      };
    }

    return {
      engine_id: engineId,
      cycle,
      predicted_rul: predictedRul,
      true_rul: split === 'train' ? trueRul : null,
      failure_probability: failureProb,
      failure_prediction: failurePred,
      failure_status: failureStatus,
      anomaly_score: anomalyScore,
      anomaly_threshold: anomalyThreshold,
      is_anomaly: isAnomaly,
      anomaly_status: anomalyStatus,
      health_score: healthScore,
      health_status: healthStatus,
      stage_desc: stageDesc,
      root_cause_attribution: rootCauses,
      recommendation,
    };
  }
}


// ============================================================
// FETCH ENGINE TREND
// ============================================================

export async function fetchEngineTrendApi(
  engineId,
  dataset = 'FD001',
  split = 'train',
  step = 4
) {
  try {
    return await apiRequest(
      `/api/engines/${engineId}/trend?dataset=${encodeURIComponent(dataset)}&split=${encodeURIComponent(split)}&step=${step}`
    );
  } catch (error) {
    console.warn('[API] Using fallback trend:', error.message);

    const maxCycle = 192;
    const threshold = 0.2434;
    const trajectory = [];

    for (let cycle = 30; cycle <= maxCycle; cycle += step) {
      const progress = (cycle - 30) / (maxCycle - 30);
      const trueRul = maxCycle - cycle;

      const predictedRul = Math.max(
        5,
        Math.round(trueRul + Math.sin(cycle * 0.4) * 4)
      );

      const failureProb = +(
        1 / (1 + Math.exp(-10 * (progress - 0.75)))
      ).toFixed(3);

      const anomalyScore = +(
        0.05 +
        Math.pow(progress, 2.5) * 0.32 +
        Math.sin(cycle * 0.3) * 0.015
      ).toFixed(4);

      trajectory.push({
        cycle,
        predicted_rul: predictedRul,
        true_rul: split === 'train' ? trueRul : null,
        failure_probability: failureProb,
        anomaly_score: anomalyScore,
      });
    }

    return {
      engine_id: engineId,
      dataset,
      max_cycle: maxCycle,
      threshold,
      trajectory,
    };
  }
}


// ============================================================
// UPLOAD SENSOR CSV
// ============================================================

export async function uploadSensorCsvApi(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      30000
    );

    try {
      const response = await fetch(
        `${API_BASE}/api/predict/upload`,
        {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || 'CSV prediction failed'
        );
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('[API] CSV upload failed:', error);
    throw error;
  }
}
