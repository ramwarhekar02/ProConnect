import React, { useEffect, useState } from 'react';

import { MachineStatusBadge } from '../../components/status/StatusComponents';
import { useSocket } from '../../hooks/useSocket';
import { machineService, productionService } from '../../services/apiService';
import socketService from '../../services/socketService';
import { getLiveMachineStatus, isMachineOnlineStatus } from '../../utils/helpers';

const DEFAULT_OEE_METRICS = {
  oee: 0,
  availability: 0,
  performance: 0,
  quality: 0,
  runtimeMinutes: 0,
  idleMinutes: 0,
  plannedProductionTimeMinutes: 0,
  plannedProductionTimeHours: 0,
  totalPieces: 0,
  productionOn: 0,
  productionOff: 0,
  badParts: 0,
};

const DASHBOARD_LOOKBACK_HOURS = 24;
const ALL_TIME_PRODUCTION_LIMIT = 5000;

const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined || Number.isNaN(num)) return '0';
  return Number(num).toFixed(decimals);
};

export const DashboardPage = () => {
  const { isConnected } = useSocket();
  const [machines, setMachines] = useState([]);
  const [machineSummaries, setMachineSummaries] = useState({});
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [oeeMetrics, setOeeMetrics] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchMachines();
    socketService.connect();

    const handleMachineStatus = (updatedMachine) => {
      setMachines((prevMachines) =>
        prevMachines.map((machine) =>
          machine.machineId === updatedMachine.machineId ? { ...machine, ...updatedMachine } : machine
        )
      );

      setSelectedMachine((prevSelectedMachine) => {
        if (!prevSelectedMachine || prevSelectedMachine.machineId !== updatedMachine.machineId) {
          return prevSelectedMachine;
        }

        return { ...prevSelectedMachine, ...updatedMachine };
      });
    };

    socketService.onAllMachineStatus(handleMachineStatus);
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      window.clearInterval(intervalId);
      socketService.offAllMachineStatus(handleMachineStatus);
    };
  }, []);

  useEffect(() => {
    if (selectedMachine) {
      fetchOeeMetrics();
    }
  }, [selectedMachine]);

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const response = await machineService.getAllMachines();
      const activeMachines = response.data.machines.filter((machine) => machine.isActive);

      if (activeMachines.length > 0) {
        setMachines(activeMachines);
        setSelectedMachine(activeMachines[0]);
      } else {
        setError('No machines available');
      }
    } catch (err) {
      setError('Failed to fetch machines');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const buildCollectiveOeeTrendData = (rows) => {
    const buckets = rows.reduce((accumulator, row) => {
      const timestamp = new Date(row.timestamp);
      if (Number.isNaN(timestamp.getTime())) {
        return accumulator;
      }

      const key = timestamp.toISOString().slice(0, 10);
      if (!accumulator[key]) {
        accumulator[key] = {
          label: key,
          runtimeSeconds: 0,
          plannedSeconds: 0,
          totalPieces: 0,
          defectivePieces: 0,
          idealTimeSeconds: 0,
        };
      }

      accumulator[key].runtimeSeconds += row.runtimeSeconds || 0;
      accumulator[key].plannedSeconds += row.plannedProductionTimeSeconds || 0;
      accumulator[key].totalPieces += row.totalPieces || 0;
      accumulator[key].defectivePieces += row.defectivePieces || 0;
      accumulator[key].idealTimeSeconds += (row.idealCycleTimeSeconds || 1) * (row.totalPieces || 0);
      return accumulator;
    }, {});

    return Object.values(buckets)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((bucket) => {
        const availability =
          bucket.plannedSeconds > 0 ? (bucket.runtimeSeconds / bucket.plannedSeconds) * 100 : 0;
        const performance =
          bucket.runtimeSeconds > 0 ? (bucket.idealTimeSeconds / bucket.runtimeSeconds) * 100 : 0;
        const quality =
          bucket.totalPieces > 0
            ? ((bucket.totalPieces - bucket.defectivePieces) / bucket.totalPieces) * 100
            : 100;
        const oee = Math.max(
          0,
          Math.min(100, (availability * performance * quality) / 10000)
        );

        return {
          label: bucket.label,
          value: Number(oee.toFixed(2)),
        };
      });
  };

  const fetchOeeMetrics = async () => {
    try {
      if (!selectedMachine) return;

      const [metricsResponse, productionResponse] = await Promise.all([
        productionService.getOverallOEEMetrics(DASHBOARD_LOOKBACK_HOURS),
        productionService.getProductionData({ limit: ALL_TIME_PRODUCTION_LIMIT }),
      ]);

      const summary = metricsResponse?.data?.summary;
      const machineRows = metricsResponse?.data?.machines || [];
      const productionRows = productionResponse?.data?.data || [];

      if (!summary) {
        setOeeMetrics(DEFAULT_OEE_METRICS);
        setTrendData([]);
        return;
      }

      setOeeMetrics({
        oee: summary.oee || 0,
        availability: summary.availability || 0,
        performance: summary.performance || 0,
        quality: summary.quality || 0,
        runtimeMinutes: Math.round((summary.totalRuntimeSeconds || 0) / 60),
        idleMinutes: Math.round((summary.totalDowntimeSeconds || 0) / 60),
        plannedProductionTimeMinutes: Math.round((summary.totalPlannedProductionTimeSeconds || 0) / 60),
        plannedProductionTimeHours: summary.plannedProductionTimeHours || 0,
        totalPieces: summary.totalPieces || 0,
        productionOn: summary.goodPieces || 0,
        productionOff: summary.defectivePieces || 0,
        badParts: summary.defectivePieces || 0,
      });

      setMachineSummaries(
        machineRows.reduce((accumulator, machine) => {
          accumulator[machine.machineId] = machine.summary;
          return accumulator;
        }, {})
      );

      setTrendData(buildCollectiveOeeTrendData(productionRows));
    } catch (err) {
      if (err?.response?.status === 404) {
        setOeeMetrics(DEFAULT_OEE_METRICS);
        setTrendData([]);
        return;
      }

      console.error('Failed to fetch OEE metrics:', err);
      setOeeMetrics(DEFAULT_OEE_METRICS);
      setTrendData([]);
    }
  };

  const syncMachineInState = (updatedMachine) => {
    setMachines((prev) =>
      prev.map((machine) => (machine.machineId === updatedMachine.machineId ? updatedMachine : machine))
    );
    setSelectedMachine(updatedMachine);
  };

  const handleMachineImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !selectedMachine) {
      return;
    }

    try {
      setImageBusy(true);
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });

      const response = await machineService.updateMachine(selectedMachine.machineId, {
        machineImage: {
          dataUrl,
          mimeType: file.type || 'image/png',
        },
      });

      if (response?.data?.machine) {
        syncMachineInState(response.data.machine);
      }
    } catch (uploadError) {
      console.error('Failed to upload machine image:', uploadError);
      setError('Failed to upload machine image');
    } finally {
      setImageBusy(false);
    }
  };

  const handleRemoveMachineImage = async () => {
    if (!selectedMachine) {
      return;
    }

    try {
      setImageBusy(true);
      const response = await machineService.updateMachine(selectedMachine.machineId, {
        removeImage: true,
      });

      if (response?.data?.machine) {
        syncMachineInState(response.data.machine);
      }
    } catch (removeError) {
      console.error('Failed to remove machine image:', removeError);
      setError('Failed to remove machine image');
    } finally {
      setImageBusy(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchMachines();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const runTime = oeeMetrics?.runtimeMinutes || 0;
  const idleTime = oeeMetrics?.idleMinutes || 0;
  const plannedProductionTimeMinutes = oeeMetrics?.plannedProductionTimeMinutes || 0;
  const totalPieces = oeeMetrics?.totalPieces || 0;
  const oee = oeeMetrics?.oee || 0;
  const availability = oeeMetrics?.availability || 0;
  const performance = oeeMetrics?.performance || 0;
  const quality = oeeMetrics?.quality || 0;
  const productionOn = oeeMetrics?.productionOn || 0;
  const badParts = oeeMetrics?.badParts || 0;
  const totalTime = Math.max(runTime + idleTime, 1);
  const runTimePercent = ((runTime / totalTime) * 100).toFixed(1);
  const idleTimePercent = ((idleTime / totalTime) * 100).toFixed(1);
  const isMachineOnline = isConnected && isMachineOnlineStatus(selectedMachine, now);
  const trendMax = Math.max(1, ...trendData.map((point) => point.value));
  const trendPoints = trendData.map((point, index) => {
    const x = 60 + index * (420 / Math.max(1, trendData.length - 1));
    const y = 170 - (point.value / trendMax) * 110;
    return { ...point, x, y };
  });
  const trendPath = trendPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const kpiCards = [
    {
      label: 'OEE',
      value: `${formatNumber(oee)}%`,
      className: 'border-emerald-900/70 bg-emerald-950/30 text-emerald-300',
    },
    {
      label: 'Availability',
      value: `${formatNumber(availability)}%`,
      className: 'border-cyan-900/70 bg-cyan-950/30 text-cyan-300',
    },
    {
      label: 'Performance',
      value: `${formatNumber(performance)}%`,
      className: 'border-amber-900/70 bg-amber-950/30 text-amber-300',
    },
    {
      label: 'Quality',
      value: `${formatNumber(quality)}%`,
      className: 'border-violet-900/70 bg-violet-950/30 text-violet-300',
    },
  ];

  const machineSnapshotRows = [
    ['Run Time', `${runTime} min`],
    ['Down Time', `${idleTime} min`],
    ['Planned Time', `${plannedProductionTimeMinutes} min`],
    ['Total Pieces', formatNumber(totalPieces)],
    ['Good Pieces', formatNumber(productionOn)],
    ['Bad Pieces', formatNumber(badParts)],
  ];

  const selectedMachineState = getLiveMachineStatus(selectedMachine, now);

  return (
    <div className="min-h-full rounded-[24px] border border-slate-800 bg-[#060913] text-slate-100 shadow-[0_20px_70px_rgba(2,6,23,0.55)]">
      <div className="flex flex-col gap-2 border-b border-slate-800 bg-[#0b1120] px-4 py-3 font-mono sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span className="text-[11px] uppercase tracking-[0.3em] text-emerald-400">Overall Dashboard</span>
          <span className="hidden text-slate-700 sm:inline">|</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>
            IoT:{' '}
            <span className={isMachineOnline ? 'text-emerald-300' : 'text-rose-300'}>
              {isMachineOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </span>
          <span>Range: {DASHBOARD_LOOKBACK_HOURS}H</span>
          <span>Machines: {machines.length}</span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>        </div>
      </div>

      <div className="p-3 sm:p-4">
        {(error || !selectedMachine) && (
          <div className="mb-3 rounded-xl border border-amber-900/70 bg-amber-950/40 p-3 text-amber-100">
            <p className="font-semibold uppercase tracking-[0.25em] text-amber-300">Warning</p>
            <p>{error || 'No machines available. Please add machines to view OEE data.'}</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-4">
            <div className="space-y-3 xl:col-span-1">
              <div className="rounded-xl border border-slate-800 bg-[#0b1120] p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  <span>Machine Image</span>
                  <span>{selectedMachine?.machineId || 'N/A'}</span>
                </div>
                <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-[#020617]">
                    {selectedMachine?.machineImage?.dataUrl ? (
                      <>
                        <img
                          src={selectedMachine.machineImage.dataUrl}
                          alt={`${selectedMachine.machineId} machine`}
                          className="h-full w-full object-cover opacity-85"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveMachineImage}
                          disabled={imageBusy}
                          className="absolute bottom-2 right-2 rounded-md border border-slate-700 bg-slate-950/85 px-2 py-1 text-[10px] text-slate-100 disabled:opacity-50"
                        >
                          CLEAR
                        </button>
                      </>
                    ) : (
                      <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center text-sm text-slate-500">
                        <span>{imageBusy ? 'Uploading...' : 'No machine image'}</span>
                        <span className="mt-3 rounded-md border border-sky-800 bg-sky-950/40 px-3 py-2 text-xs font-medium text-sky-200">
                          Attach Image
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleMachineImageChange}
                          disabled={imageBusy}
                        />
                      </label>
                    )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#0b1120] p-3">
                <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">Machine Run Time</div>
                <svg width="100%" height="180" viewBox="0 0 200 200" className="mx-auto">
                  <circle cx="100" cy="100" r="76" fill="none" stroke="#1e293b" strokeWidth="18" />
                  <circle
                    cx="100"
                    cy="100"
                    r="76"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="18"
                    strokeDasharray={`${runTimePercent * 4.77},477`}
                    transform="rotate(-90 100 100)"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="76"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="18"
                    strokeDasharray={`${idleTimePercent * 4.77},477`}
                    strokeDashoffset={`-${runTimePercent * 4.77}`}
                    transform="rotate(-90 100 100)"
                  />
                  <text x="100" y="96" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#e2e8f0">
                    Run {runTimePercent}%
                  </text>
                  <text x="100" y="119" textAnchor="middle" fontSize="13" fill="#94a3b8">
                    Idle {idleTimePercent}%
                  </text>
                  <text x="100" y="140" textAnchor="middle" fontSize="10" fill="#64748b">
                    Planned basis
                  </text>
                </svg>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-2">Run {runTime} min</div>
                  <div className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-2">Idle {idleTime} min</div>
                </div>
              </div>
            </div>

            <div className="space-y-3 xl:col-span-3">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-[#0b1120] p-3">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Run Time</div>
                  <div className="mt-2 text-2xl font-bold text-emerald-300">{runTime} min</div>
                  <div className="mt-1 text-xs text-slate-500">Combined all active machines</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0b1120] p-3">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Idle Time</div>
                  <div className="mt-2 text-2xl font-bold text-amber-300">{idleTime} min</div>
                  <div className="mt-1 text-xs text-slate-500">Combined all active machines</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0b1120] p-3">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Planned Production</div>
                  <div className="mt-2 text-2xl font-bold text-cyan-300">{plannedProductionTimeMinutes} min</div>
                  <div className="mt-1 text-xs text-slate-500">Settings x active machines</div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {kpiCards.map((item) => (
                  <div key={item.label} className={`rounded-xl border p-3 ${item.className}`}>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{item.label}</p>
                    <p className="mt-2 text-3xl font-bold text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-[#0b1120] p-3">
                  <div className="mb-3 text-[11px] uppercase tracking-[0.28em] text-slate-500">OEE Analysis</div>
                  <div className="flex h-44 items-end justify-around gap-3">
                    {[
                      ['OEE', oee, 'bg-emerald-500'],
                      ['Availability', availability, 'bg-cyan-500'],
                      ['Performance', performance, 'bg-amber-500'],
                      ['Quality', quality, 'bg-violet-500'],
                    ].map(([label, value, barClass]) => (
                      <div key={label} className="flex w-full flex-col items-center">
                        <div className={`w-10 rounded-t ${barClass}`} style={{ height: `${Math.min(Number(value) * 1.4, 140)}px` }}></div>
                        <div className="mt-2 text-[11px] text-slate-400">{label}</div>
                        <div className="text-sm font-semibold text-slate-100">{formatNumber(value)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#0b1120] p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">Collective OEE Trend</div>
                  <div className="mb-3 text-xs text-slate-500">All-time OEE trend across all machines</div>
                  <svg width="100%" height="210" viewBox="0 0 500 200" className="mx-auto">
                    <defs>
                      <linearGradient id="trendGradientClassic" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#38bdf8', stopOpacity: 0.3 }} />
                        <stop offset="100%" style={{ stopColor: '#38bdf8', stopOpacity: 0 }} />
                      </linearGradient>
                    </defs>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <line
                        key={`h-${i}`}
                        x1="60"
                        y1={40 + (120 / 4) * i}
                        x2="480"
                        y2={40 + (120 / 4) * i}
                        stroke="#1e293b"
                        strokeDasharray="4,4"
                      />
                    ))}
                    <text x="20" y="30" fontSize="10" fill="#94a3b8" fontWeight="600">
                      OEE %
                    </text>
                    <line x1="60" y1="40" x2="60" y2="170" stroke="#64748b" strokeWidth="2" />
                    <line x1="60" y1="170" x2="480" y2="170" stroke="#64748b" strokeWidth="2" />
                    {trendPath && (
                      <>
                        <path d={`${trendPath} L 480 170 L 60 170 Z`} fill="url(#trendGradientClassic)" />
                        <path d={trendPath} fill="none" stroke="#38bdf8" strokeWidth="3" />
                      </>
                    )}
                    {trendPoints.map((point) => (
                      <g key={point.label}>
                        <circle cx={point.x} cy={point.y} r="4" fill="#38bdf8" />
                        <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="9" fill="#7dd3fc">
                          {Math.round(point.value)}
                        </text>
                        <text x={point.x} y="188" textAnchor="middle" fontSize="9" fill="#94a3b8">
                          {point.label.slice(5)}
                        </text>
                      </g>
                    ))}
                    {[0, 1, 2, 3, 4].map((i) => {
                      const value = Math.round((trendMax / 4) * (4 - i));
                      return (
                        <text
                          key={`y-${i}`}
                          x="52"
                          y={44 + (120 / 4) * i}
                          textAnchor="end"
                          fontSize="9"
                          fill="#94a3b8"
                        >
                          {value}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-[#0b1120] p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">Performance</div>
                  <div className="text-3xl font-bold text-amber-300">{formatNumber(performance)}%</div>
                  <div className="mt-2 space-y-1 text-sm text-slate-300">
                    <div>Runtime: {runTime} min</div>
                    <div>Total Pieces: {formatNumber(totalPieces)}</div>
                    <div>Planned: {plannedProductionTimeMinutes} min</div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#0b1120] p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">Machine State</div>
                  <div className="mb-2">
                    <MachineStatusBadge machine={selectedMachine} now={now} />
                  </div>
                  <div className="space-y-1 text-sm text-slate-300">
                    <div>Heartbeat: {selectedMachine?.lastHeartbeat ? new Date(selectedMachine.lastHeartbeat).toLocaleString() : 'N/A'}</div>
                    <div>Location: {selectedMachine?.location || 'Unassigned'}</div>
                    <div>Connection: {isMachineOnline ? 'Online' : 'Offline'}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#0b1120] p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">Production Metrics</div>
                  <div className="grid grid-cols-2 gap-2">
                    {machineSnapshotRows.map(([label, value]) => (
                      <div key={label} className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
                        <div className="mt-1 text-base font-semibold text-slate-100">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="rounded-xl border border-slate-800 bg-[#0b1120] p-3">
            <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">Machine List</div>
            <div className="overflow-x-auto">
              <div className="min-w-[760px] overflow-hidden rounded-lg border border-slate-800">
                <div className="grid grid-cols-[1.1fr_1fr_0.8fr_0.8fr_1fr] border-b border-slate-800 bg-slate-900/90 px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  <span>Machine</span>
                  <span>Status</span>
                  <span>Runtime</span>
                  <span>Pieces</span>
                  <span>Heartbeat</span>
                </div>
                <div className="divide-y divide-slate-800">
                  {machines.map((machine) => {
                    const online = isConnected && isMachineOnlineStatus(machine, now);
                    const isSelected = selectedMachine?.machineId === machine.machineId;
                    const machineSummary = machineSummaries[machine.machineId];

                    return (
                      <button
                        key={machine.machineId}
                        type="button"
                        onClick={() => setSelectedMachine(machine)}
                        className={`grid w-full grid-cols-[1.1fr_1fr_0.8fr_0.8fr_1fr] items-center px-3 py-2 text-left transition ${
                          isSelected ? 'bg-slate-900/90' : 'bg-slate-950/60 hover:bg-slate-900/70'
                        }`}
                      >
                        <div>
                          <div className="font-medium text-slate-100">{machine.machineId}</div>
                          <div className="text-xs text-slate-500">{machine.location || 'Unassigned'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                          <MachineStatusBadge machine={machine} now={now} />
                        </div>
                        <span className="text-sm text-slate-200">
                          {machineSummary ? `${Math.round((machineSummary.totalRuntimeSeconds || 0) / 60)} min` : '--'}
                        </span>
                        <span className="text-sm text-slate-200">
                          {machineSummary ? formatNumber(machineSummary.totalPieces || 0) : '--'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {machine.lastHeartbeat ? new Date(machine.lastHeartbeat).toLocaleString() : 'N/A'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
