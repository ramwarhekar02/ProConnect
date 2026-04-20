import React, { useEffect, useRef, useState } from 'react';
import { machineService, productionService, settingsService } from '../../services/apiService';
import socketService from '../../services/socketService';
import { getLiveMachineStatus } from '../../utils/helpers';

const DEFAULT_SUMMARY = {
  oee: 0,
  availability: 0,
  performance: 0,
  quality: 0,
  runTime: 0,
  idleTime: 0,
  totalTime: 0,
  totalPieces: 0,
  productionOn: 0,
  productionOff: 0,
  badPrints: 0,
  plannedProductionTimeHours: 0,
  plannedProductionTimeMinutes: 0,
};

const DEFAULT_COMPARISON_SUMMARY = {
  machineId: '',
  status: 'disconnected',
  oee: 0,
  availability: 0,
  performance: 0,
  quality: 0,
  totalPieces: 0,
  goodPieces: 0,
  defectivePieces: 0,
  runtimeMinutes: 0,
};

const DEFAULT_BENCHMARK = {
  machineId: 'IDEAL_MACHINE',
  status: 'benchmark',
  oee: 100,
  availability: 100,
  performance: 100,
  quality: 100,
  totalPieces: 1200,
  goodPieces: 1200,
  defectivePieces: 0,
  runtimeMinutes: 60,
};

const ALL_TIME_PRODUCTION_LIMIT = 5000;

const TIME_FILTER_OPTIONS = [
  { label: '1 Hour', value: '1h' },
  { label: '2 Hours', value: '2h' },
  { label: '1 Day', value: '1d' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom Range', value: 'custom' },
];

const ALL_TIME_HOURS = 24 * 365 * 100;

const toDateBoundaryIso = (dateValue, boundary) => {
  if (!dateValue) return null;
  const suffix = boundary === 'start' ? 'T00:00:00.000' : 'T23:59:59.999';
  return new Date(`${dateValue}${suffix}`).toISOString();
};

const resolveHoursBack = (filterValue, fallbackHours = 1) => {
  if (filterValue === 'all') {
    return ALL_TIME_HOURS;
  }

  if (filterValue === 'custom') {
    return fallbackHours || 1;
  }

  if (filterValue === '1d') {
    return 24;
  }

  if (filterValue === '2h') {
    return 2;
  }

  if (filterValue === '1h') {
    return 1;
  }

  return fallbackHours || 1;
};

const getFilterLabel = (filterValue, hoursBack = 1) => {
  if (filterValue === 'all') {
    return 'All Time';
  }

  if (filterValue === 'custom') {
    if (hoursBack?.dateFrom && hoursBack?.dateTo) {
      return `${hoursBack.dateFrom} to ${hoursBack.dateTo}`;
    }

    return 'Custom Range';
  }

  if (filterValue === '1d') {
    return 'Last 1 Day';
  }

  if (filterValue === '2h') {
    return 'Last 2 Hours';
  }

  if (filterValue === '1h') {
    return 'Last 1 Hour';
  }

  return `Last ${hoursBack} Hour(s)`;
};

const getFilterValueFromHours = (hoursBack = 1) => {
  if (hoursBack >= ALL_TIME_HOURS) {
    return 'all';
  }

  if (hoursBack >= 24) {
    return '1d';
  }

  if (hoursBack >= 2) {
    return '2h';
  }

  return '1h';
};

const buildAnalyticsParams = (filterValue, fallbackHours, customRange) => {
  if (filterValue === 'custom') {
    if (!customRange?.dateFrom || !customRange?.dateTo) {
      return null;
    }

    return {
      dateFrom: toDateBoundaryIso(customRange.dateFrom, 'start'),
      dateTo: toDateBoundaryIso(customRange.dateTo, 'end'),
    };
  }

  return { hoursBack: resolveHoursBack(filterValue, fallbackHours) };
};

const normalizeBenchmark = (idealMachine) => ({
  machineId: idealMachine?.machineId || DEFAULT_BENCHMARK.machineId,
  status: 'benchmark',
  oee: idealMachine?.oee ?? DEFAULT_BENCHMARK.oee,
  availability: idealMachine?.availability ?? DEFAULT_BENCHMARK.availability,
  performance: idealMachine?.performance ?? DEFAULT_BENCHMARK.performance,
  quality: idealMachine?.quality ?? DEFAULT_BENCHMARK.quality,
  totalPieces: idealMachine?.totalPieces ?? DEFAULT_BENCHMARK.totalPieces,
  goodPieces: idealMachine?.goodPieces ?? DEFAULT_BENCHMARK.goodPieces,
  defectivePieces: idealMachine?.defectivePieces ?? DEFAULT_BENCHMARK.defectivePieces,
  runtimeMinutes: idealMachine?.runtimeMinutes ?? DEFAULT_BENCHMARK.runtimeMinutes,
});

const getBenchmarkDelta = (value, benchmarkValue, { inverse = false } = {}) => {
  const numericValue = Number(value) || 0;
  const numericBenchmarkValue = Number(benchmarkValue) || 0;

  if (numericValue === numericBenchmarkValue) {
    return 0;
  }

  if (numericBenchmarkValue === 0) {
    if (inverse) {
      return numericValue === 0 ? 0 : -100;
    }

    return numericValue > 0 ? 100 : 0;
  }

  const rawDelta = ((numericValue - numericBenchmarkValue) / numericBenchmarkValue) * 100;
  return inverse ? -rawDelta : rawDelta;
};

const renderValueWithDelta = (
  value,
  benchmarkValue,
  {
    inverse = false,
    valueClassName = 'text-gray-200',
    suffix = '',
    zeroBenchmarkUsesAbsoluteDelta = false,
  } = {}
) => {
  const numericValue = Number(value) || 0;
  const numericBenchmarkValue = Number(benchmarkValue) || 0;
  const useAbsoluteDelta = zeroBenchmarkUsesAbsoluteDelta && numericBenchmarkValue === 0;
  const delta = getBenchmarkDelta(numericValue, numericBenchmarkValue, { inverse });
  const roundedDelta = Math.round(delta);
  const absoluteDelta = inverse
    ? Math.round(numericBenchmarkValue - numericValue)
    : Math.round(numericValue - numericBenchmarkValue);
  const deltaClassName =
    (useAbsoluteDelta ? absoluteDelta : roundedDelta) > 0
      ? 'text-emerald-400'
      : (useAbsoluteDelta ? absoluteDelta : roundedDelta) < 0
      ? 'text-red-400'
      : 'text-gray-500';

  return (
    <div className="flex flex-col leading-tight">
      <span className={valueClassName}>
        {value}
        {suffix}
      </span>
      <span className={`text-[11px] ${deltaClassName}`}>
        {useAbsoluteDelta ? (
          <>
            {absoluteDelta > 0 ? '+' : ''}
            {absoluteDelta}
          </>
        ) : (
          <>
            {roundedDelta > 0 ? '+' : ''}
            {roundedDelta}%
          </>
        )}
      </span>
    </div>
  );
};

export const OEEPage = () => {
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [comparisonRows, setComparisonRows] = useState([DEFAULT_BENCHMARK]);
  const [collectiveTrendData, setCollectiveTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comparisonLoading, setComparisonLoading] = useState(true);
  const [error, setError] = useState('');
  const [comparisonLookbackHours, setComparisonLookbackHours] = useState(1);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({ dateFrom: '', dateTo: '' });
  const [idealMachineBenchmark, setIdealMachineBenchmark] = useState(DEFAULT_BENCHMARK);
  const selectedTimeFilterRef = useRef('all');
  const customDateRangeRef = useRef({ dateFrom: '', dateTo: '' });

  useEffect(() => {
    selectedTimeFilterRef.current = selectedTimeFilter;
  }, [selectedTimeFilter]);

  useEffect(() => {
    customDateRangeRef.current = customDateRange;
  }, [customDateRange]);

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

  const fetchComparisonMetrics = async (
    machineList = machines,
    queryParams = buildAnalyticsParams(selectedTimeFilter, comparisonLookbackHours, customDateRange),
    benchmark = idealMachineBenchmark
  ) => {
    const targetMachines = (machineList || []).filter((machine) => machine?.machineId);
    setComparisonLoading(true);

    if (targetMachines.length === 0 || !queryParams) {
      setComparisonRows([benchmark]);
      setComparisonLoading(false);
      return;
    }

    try {
      const responses = await Promise.allSettled(
        targetMachines.map((machine) =>
          productionService.getOEEMetrics(machine.machineId, queryParams)
        )
      );

      const nextRows = targetMachines
        .map((machine, index) => {
          const response = responses[index];
          const nextSummary =
            response?.status === 'fulfilled' ? response.value?.data?.summary : null;

          if (!nextSummary) {
            return {
              ...DEFAULT_COMPARISON_SUMMARY,
              machineId: machine.machineId,
              status: machine.status,
            };
          }

          return {
            machineId: machine.machineId,
            status: getLiveMachineStatus(machine),
            oee: nextSummary.oee || 0,
            availability: nextSummary.availability || 0,
            performance: nextSummary.performance || 0,
            quality: nextSummary.quality || 0,
            totalPieces: nextSummary.totalPieces || 0,
            goodPieces: nextSummary.goodPieces || 0,
            defectivePieces: nextSummary.defectivePieces || 0,
            runtimeMinutes: Math.round((nextSummary.totalRuntimeSeconds || 0) / 60),
          };
        })
        .sort((a, b) => b.oee - a.oee || b.totalPieces - a.totalPieces);

      setComparisonRows([benchmark, ...nextRows]);
    } catch (comparisonError) {
      console.error('Failed to fetch comparison metrics', comparisonError);
      setComparisonRows((prev) => (prev.length > 0 ? prev : [benchmark]));
    } finally {
      setComparisonLoading(false);
    }
  };

  const fetchMetrics = async (
    machineId,
    queryParams = buildAnalyticsParams(selectedTimeFilter, comparisonLookbackHours, customDateRange)
  ) => {
    if (!machineId || !queryParams) {
      return;
    }

    try {
      setLoading(true);
      const response = await productionService.getOEEMetrics(machineId, queryParams);
      const nextMetrics = response?.data?.metrics || [];
      const nextSummary = response?.data?.summary;

      setMetrics(nextMetrics);
      setSummary(
        nextSummary
          ? {
              oee: nextSummary.oee || 0,
              availability: nextSummary.availability || 0,
              performance: nextSummary.performance || 0,
              quality: nextSummary.quality || 0,
              runTime: Math.round((nextSummary.totalRuntimeSeconds || 0) / 60),
              idleTime: Math.round((nextSummary.totalDowntimeSeconds || 0) / 60),
              totalTime: Math.round(
                ((nextSummary.totalRuntimeSeconds || 0) +
                  (nextSummary.totalDowntimeSeconds || 0)) /
                  60
              ),
              plannedProductionTimeHours: nextSummary.plannedProductionTimeHours || 0,
              plannedProductionTimeMinutes: Math.round(
                (nextSummary.totalPlannedProductionTimeSeconds || 0) / 60
              ),
              totalPieces: nextSummary.totalPieces || 0,
              productionOn: nextSummary.goodPieces || 0,
              productionOff: nextSummary.defectivePieces || 0,
              badPrints: nextSummary.defectivePieces || 0,
            }
          : DEFAULT_SUMMARY
      );
    } catch (metricsError) {
      console.error('Failed to fetch OEE metrics', metricsError);
      setSummary(DEFAULT_SUMMARY);
      setMetrics([]);
      setError('Failed to fetch OEE metrics');
    } finally {
      setLoading(false);
    }
  };

  const fetchPageData = async (preserveSelectedFilter = false) => {
    try {
      setLoading(true);
      setError('');

      const settingsResponse = await settingsService.getSettings();
      const settings = settingsResponse?.data?.settings;
      const defaultHoursBack = settings?.comparisonLookbackHours || 1;
      const benchmark = normalizeBenchmark(settings?.idealMachine);
      const activeFilter = preserveSelectedFilter ? selectedTimeFilterRef.current : 'all';
      const queryParams = buildAnalyticsParams(
        activeFilter,
        defaultHoursBack,
        customDateRangeRef.current
      );

      setComparisonLookbackHours(defaultHoursBack);
      setSelectedTimeFilter(activeFilter);
      setIdealMachineBenchmark(benchmark);

      const machinesResponse = await machineService.getAllMachines();
      const activeMachines = (machinesResponse?.data?.machines || []).filter(
        (machine) => machine.isActive
      );
      const productionResponse = await productionService.getProductionData({
        limit: ALL_TIME_PRODUCTION_LIMIT,
      });
      setCollectiveTrendData(
        buildCollectiveOeeTrendData(productionResponse?.data?.data || [])
      );

      setMachines(activeMachines);

      const nextSelectedMachine =
        activeMachines.find((machine) => machine.machineId === selectedMachine?.machineId) ||
        activeMachines[0] ||
        null;

      setSelectedMachine(nextSelectedMachine);

      await Promise.all([
        fetchComparisonMetrics(activeMachines, queryParams, benchmark),
        nextSelectedMachine
          ? fetchMetrics(nextSelectedMachine.machineId, queryParams)
          : Promise.resolve(),
      ]);

      if (!nextSelectedMachine) {
        setSummary(DEFAULT_SUMMARY);
        setMetrics([]);
        setError('No machines available');
      }
    } catch (fetchError) {
      console.error(fetchError);
      setError('Failed to load OEE analytics');
      setComparisonRows([idealMachineBenchmark]);
      setSummary(DEFAULT_SUMMARY);
      setMetrics([]);
      setCollectiveTrendData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData();
    socketService.connect();

    const handleRealtimeRefresh = () => {
      fetchPageData(true);
    };

    socketService.onAllProductionUpdate(handleRealtimeRefresh);
    socketService.onAllMachineStatus(handleRealtimeRefresh);

    return () => {
      socketService.offAllProductionUpdate(handleRealtimeRefresh);
      socketService.offAllMachineStatus(handleRealtimeRefresh);
    };
  }, []);

  useEffect(() => {
    if (selectedMachine?.machineId) {
      const queryParams = buildAnalyticsParams(
        selectedTimeFilter,
        comparisonLookbackHours,
        customDateRange
      );
      if (queryParams) {
        fetchMetrics(selectedMachine.machineId, queryParams);
      }
    }
  }, [selectedMachine?.machineId, selectedTimeFilter, comparisonLookbackHours, customDateRange]);

  useEffect(() => {
    if (machines.length === 0) {
      return;
    }

    const queryParams = buildAnalyticsParams(
      selectedTimeFilter,
      comparisonLookbackHours,
      customDateRange
    );
    if (!queryParams) {
      return;
    }

    fetchComparisonMetrics(machines, queryParams, idealMachineBenchmark);

    if (selectedMachine?.machineId) {
      fetchMetrics(selectedMachine.machineId, queryParams);
    }
  }, [selectedTimeFilter, customDateRange]);

  const handleApplyCustomRange = async () => {
    const queryParams = buildAnalyticsParams('custom', comparisonLookbackHours, customDateRange);
    if (!queryParams) {
      return;
    }

    if (selectedMachine?.machineId) {
      await fetchMetrics(selectedMachine.machineId, queryParams);
    }
    await fetchComparisonMetrics(machines, queryParams, idealMachineBenchmark);
  };

  const totalTime = Math.max(1, summary.totalTime || summary.runTime + summary.idleTime);
  const runTimePercent = (summary.runTime / totalTime) * 100;
  const idleTimePercent = (summary.idleTime / totalTime) * 100;

  const oeeAnalysis = [
    { label: 'OEE', value: summary.oee, color: 'bg-green-500' },
    { label: 'Availability', value: summary.availability, color: 'bg-orange-500' },
    { label: 'Performance', value: summary.performance, color: 'bg-yellow-500' },
    { label: 'Quality', value: summary.quality, color: 'bg-blue-500' },
  ];

  const productionDetails =
    collectiveTrendData.length > 0
      ? collectiveTrendData
      : [{ label: 'No Data', value: 0 }];
  const productionTrendMax = Math.max(1, ...productionDetails.map((point) => point.value));
  const productionTrendPoints = productionDetails.map((point, index) => {
    const x = 50 + index * (400 / Math.max(1, productionDetails.length - 1));
    const y = 145 - (point.value / productionTrendMax) * 105;
    return { ...point, x, y };
  });
  const productionTrendPath = productionTrendPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const actualMachineRows = comparisonRows.filter(
    (machine) => machine.machineId !== idealMachineBenchmark.machineId
  );
  const bestMachine = actualMachineRows[0] || null;
  const needsAttentionMachine =
    actualMachineRows.length > 0 ? actualMachineRows[actualMachineRows.length - 1] : null;

  if (loading && !selectedMachine && comparisonRows.length <= 1) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading OEE data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(error || !selectedMachine) && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
          <p className="font-bold">Warning</p>
          <p>{error || 'No machines available. Please add machines to view OEE data.'}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">OEE Analytics</h1>
          <p className="text-sm text-gray-400">
            {selectedMachine
              ? `${selectedMachine.machineId} • ${getFilterLabel(
                  selectedTimeFilter,
                  selectedTimeFilter === 'custom' ? customDateRange : comparisonLookbackHours
                )}`
              : 'No machine selected'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTimeFilter}
            onChange={(event) => setSelectedTimeFilter(event.target.value)}
            className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2"
          >
            {TIME_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {selectedTimeFilter === 'custom' && (
            <>
              <input
                type="date"
                value={customDateRange.dateFrom}
                onChange={(event) =>
                  setCustomDateRange((prev) => ({ ...prev, dateFrom: event.target.value }))
                }
                className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2"
              />
              <input
                type="date"
                value={customDateRange.dateTo}
                onChange={(event) =>
                  setCustomDateRange((prev) => ({ ...prev, dateTo: event.target.value }))
                }
                className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2"
              />
              <button
                type="button"
                onClick={handleApplyCustomRange}
                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg"
              >
                Apply Range
              </button>
            </>
          )}
          {machines.length > 0 && (
            <select
              value={selectedMachine?.machineId || ''}
              onChange={(event) =>
                setSelectedMachine(
                  machines.find((machine) => machine.machineId === event.target.value) || null
                )
              }
              className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2"
            >
              {machines.map((machine) => (
                <option key={machine.machineId} value={machine.machineId}>
                  {machine.machineId}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {oeeAnalysis.map((item) => (
          <div key={item.label} className={`rounded-lg p-6 shadow-sm text-white ${item.color}`}>
            <p className="font-semibold mb-2">{item.label}</p>
            <p className="text-4xl font-bold">{Math.round(item.value)}%</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 items-center md:grid-cols-3">
        <div className="bg-gray-900 rounded-lg p-6 flex flex-col gap-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Run Time</span>
            <span className="text-white font-semibold">{summary.runTime} min</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Idle Time</span>
            <span className="text-white font-semibold">{summary.idleTime} min</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Planned Production</span>
            <span className="text-white font-semibold">{summary.plannedProductionTimeHours} hr</span>
          </div>
          <p className="text-xs text-gray-500">Edit planned production time from Settings page.</p>
        </div>

        <div className="flex flex-col items-center">
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="60" fill="none" stroke="#374151" strokeWidth="16" />
            <circle
              cx="80"
              cy="80"
              r="60"
              fill="none"
              stroke="#22c55e"
              strokeWidth="16"
              strokeDasharray={`${runTimePercent * 3.77},377`}
              transform="rotate(-90 80 80)"
            />
            <circle
              cx="80"
              cy="80"
              r="60"
              fill="none"
              stroke="#eab308"
              strokeWidth="16"
              strokeDasharray={`${idleTimePercent * 3.77},377`}
              strokeDashoffset={`-${runTimePercent * 3.77}`}
              transform="rotate(-90 80 80)"
            />
            <text x="80" y="74" textAnchor="middle" fill="#9ca3af" fontSize="12">
              Total
            </text>
            <text x="80" y="96" textAnchor="middle" fill="#ffffff" fontSize="20" fontWeight="700">
              {totalTime}
            </text>
          </svg>
          <div className="flex gap-4 mt-4 flex-wrap justify-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-400">Run: {summary.runTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-gray-400">Idle: {summary.idleTime}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 flex flex-col gap-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Total Pieces</span>
            <span className="text-slate-200 font-semibold">{summary.totalPieces}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Good Pieces</span>
            <span className="text-green-500 font-semibold">{summary.productionOn}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Defective Pieces</span>
            <span className="text-orange-500 font-semibold">{summary.productionOff}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Bad Parts</span>
            <span className="text-red-500 font-semibold">{summary.badPrints}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
          <h3 className="text-white font-semibold mb-4">OEE Analysis</h3>
          <div className="flex gap-4 items-end h-48">
            {oeeAnalysis.map((item) => (
              <div key={item.label} className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 rounded-t-lg ${item.color}`}
                  style={{ height: `${item.value > 0 ? item.value * 1.6 : 10}px` }}
                ></div>
                <span className="text-gray-400 text-xs mt-2">{item.label}</span>
                <span className="text-white text-sm font-semibold">{Math.round(item.value)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
          <h3 className="text-white font-semibold mb-2">Collective OEE Trend</h3>
          <p className="text-xs text-gray-500 mb-4">All-time OEE trend across all machines</p>
          <svg width="100%" height="180" viewBox="0 0 460 170" className="mx-auto">
            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={`grid-${i}`}
                x1="50"
                y1={40 + (105 / 4) * i}
                x2="450"
                y2={40 + (105 / 4) * i}
                stroke="#1f2937"
                strokeDasharray="4,4"
              />
            ))}
            <line x1="50" y1="40" x2="50" y2="145" stroke="#4b5563" strokeWidth="2" />
            <line x1="50" y1="145" x2="450" y2="145" stroke="#4b5563" strokeWidth="2" />
            {productionTrendPath && (
              <path d={productionTrendPath} fill="none" stroke="#3b82f6" strokeWidth="3" />
            )}
            {productionTrendPoints.map((point) => (
              <g key={point.label}>
                <circle cx={point.x} cy={point.y} r="3.5" fill="#60a5fa" />
                <text x={point.x} y={point.y - 8} textAnchor="middle" fontSize="9" fill="#93c5fd">
                  {Math.round(point.value)}
                </text>
                <text x={point.x} y="160" textAnchor="middle" fontSize="8" fill="#9ca3af">
                  {point.label === 'No Data' ? point.label : point.label.slice(5)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg">All Machines Comparison</h3>
            <p className="text-sm text-gray-400">
              Live comparison across all active machines for {getFilterLabel(
                selectedTimeFilter,
                selectedTimeFilter === 'custom' ? customDateRange : comparisonLookbackHours
              ).toLowerCase()}, against the saved benchmark.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-emerald-300">Best Performing</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {bestMachine ? bestMachine.machineId : 'N/A'}
              </p>
              <p className="text-sm text-emerald-200">
                OEE {bestMachine ? `${Math.round(bestMachine.oee)}%` : '--'}
              </p>
            </div>
            <div className="rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-amber-300">Needs Attention</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {needsAttentionMachine ? needsAttentionMachine.machineId : 'N/A'}
              </p>
              <p className="text-sm text-amber-200">
                OEE {needsAttentionMachine ? `${Math.round(needsAttentionMachine.oee)}%` : '--'}
              </p>
            </div>
          </div>
        </div>

        {comparisonLoading && (
          <div className="rounded-lg border border-gray-700 bg-gray-950/40 px-4 py-3 text-sm text-gray-400">
            Refreshing comparison data...
          </div>
        )}

        <div className="rounded-lg border border-cyan-800 bg-cyan-950/30 px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-cyan-300">Benchmark Reference</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-6">
            <div>
              <p className="text-gray-400">Machine</p>
              <p className="font-semibold text-white">{idealMachineBenchmark.machineId}</p>
            </div>
            <div>
              <p className="text-gray-400">OEE</p>
              <p className="font-semibold text-white">{idealMachineBenchmark.oee}%</p>
            </div>
            <div>
              <p className="text-gray-400">Availability</p>
              <p className="font-semibold text-white">{idealMachineBenchmark.availability}%</p>
            </div>
            <div>
              <p className="text-gray-400">Performance</p>
              <p className="font-semibold text-white">{idealMachineBenchmark.performance}%</p>
            </div>
            <div>
              <p className="text-gray-400">Quality</p>
              <p className="font-semibold text-white">{idealMachineBenchmark.quality}%</p>
            </div>
            <div>
              <p className="text-gray-400">Bad Pieces</p>
              <p className="font-semibold text-white">{idealMachineBenchmark.defectivePieces}</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="border-b border-gray-700 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-3 py-3">Rank</th>
                <th className="px-3 py-3">Machine</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">OEE</th>
                <th className="px-3 py-3">Availability</th>
                <th className="px-3 py-3">Performance</th>
                <th className="px-3 py-3">Quality</th>
                <th className="px-3 py-3">Runtime</th>
                <th className="px-3 py-3">Total Pieces</th>
                <th className="px-3 py-3">Good</th>
                <th className="px-3 py-3">Bad</th>
                <th className="px-3 py-3">Assessment</th>
                <th className="px-3 py-3">Gap vs Ideal</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((machine) => {
                const assessment =
                  machine.machineId === idealMachineBenchmark.machineId
                    ? 'Benchmark'
                    : machine.oee >= 85
                    ? 'Excellent'
                    : machine.oee >= 70
                    ? 'Good'
                    : machine.oee >= 50
                    ? 'Average'
                    : 'Critical';
                const oeeGap = idealMachineBenchmark.oee - machine.oee;

                return (
                  <tr
                    key={machine.machineId}
                    className={`border-b border-gray-800 text-sm ${
                      machine.machineId === selectedMachine?.machineId
                        ? 'bg-gray-800/70'
                        : machine.machineId === idealMachineBenchmark.machineId
                        ? 'bg-cyan-950/20'
                        : 'bg-transparent'
                    }`}
                  >
                    <td className="px-3 py-3 text-gray-300">
                      {machine.machineId === idealMachineBenchmark.machineId
                        ? 'REF'
                        : `#${actualMachineRows.findIndex((row) => row.machineId === machine.machineId) + 1}`}
                    </td>
                    <td className="px-3 py-3 font-semibold text-white">{machine.machineId}</td>
                    <td className="px-3 py-3 text-gray-300 capitalize">{machine.status}</td>
                    <td className="px-3 py-3">
                      {renderValueWithDelta(Math.round(machine.oee), idealMachineBenchmark.oee, {
                        valueClassName: 'text-emerald-300 font-semibold',
                        suffix: '%',
                      })}
                    </td>
                    <td className="px-3 py-3">
                      {renderValueWithDelta(
                        Math.round(machine.availability),
                        idealMachineBenchmark.availability,
                        {
                          valueClassName: 'text-cyan-300',
                          suffix: '%',
                        }
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {renderValueWithDelta(
                        Math.round(machine.performance),
                        idealMachineBenchmark.performance,
                        {
                          valueClassName: 'text-amber-300',
                          suffix: '%',
                        }
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {renderValueWithDelta(Math.round(machine.quality), idealMachineBenchmark.quality, {
                        valueClassName: 'text-blue-300',
                        suffix: '%',
                      })}
                    </td>
                    <td className="px-3 py-3">
                      {renderValueWithDelta(
                        machine.runtimeMinutes,
                        idealMachineBenchmark.runtimeMinutes,
                        {
                          valueClassName: 'text-gray-200',
                        }
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {renderValueWithDelta(machine.totalPieces, idealMachineBenchmark.totalPieces, {
                        valueClassName: 'text-gray-200',
                      })}
                    </td>
                    <td className="px-3 py-3">
                      {renderValueWithDelta(machine.goodPieces, idealMachineBenchmark.goodPieces, {
                        valueClassName: 'text-green-400',
                      })}
                    </td>
                    <td className="px-3 py-3">
                      {renderValueWithDelta(
                        machine.defectivePieces,
                        idealMachineBenchmark.defectivePieces,
                        {
                          inverse: true,
                          valueClassName: 'text-red-400',
                          zeroBenchmarkUsesAbsoluteDelta: true,
                        }
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          assessment === 'Benchmark'
                            ? 'bg-cyan-900 text-cyan-200'
                            : assessment === 'Excellent'
                            ? 'bg-emerald-900 text-emerald-200'
                            : assessment === 'Good'
                            ? 'bg-cyan-900 text-cyan-200'
                            : assessment === 'Average'
                            ? 'bg-amber-900 text-amber-200'
                            : 'bg-red-900 text-red-200'
                        }`}
                      >
                        {assessment}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-200">
                      {machine.machineId === idealMachineBenchmark.machineId
                        ? '0%'
                        : `${Math.max(0, Math.round(oeeGap))}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OEEPage;
