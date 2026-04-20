import React, { Fragment, useEffect, useRef, useState } from 'react';

import { MachineStatusBadge } from '../../components/status/StatusComponents';
import { machineService, productionService, settingsService } from '../../services/apiService';
import socketService from '../../services/socketService';
import { formatDate, getLiveMachineStatus } from '../../utils/helpers';

const MAX_LOGS_PER_MACHINE = 25;
const METRICS_LOOKBACK_HOURS = 1;
const ALL_TIME_HOURS = 24 * 365 * 100;
const CUSTOM_RANGE_VALUE = -1;
const TIME_RANGE_OPTIONS = [
  { label: 'Past 1 Hour', value: 1 },
  { label: 'Past 2 Hours', value: 2 },
  { label: 'Past 1 Day', value: 24 },
  { label: 'Past 1 Week', value: 168 },
  { label: 'All Time', value: ALL_TIME_HOURS },
  { label: 'Custom Range', value: CUSTOM_RANGE_VALUE },
];

const toDateBoundaryIso = (dateValue, boundary) => {
  if (!dateValue) return null;
  const suffix = boundary === 'start' ? 'T00:00:00.000' : 'T23:59:59.999';
  return new Date(`${dateValue}${suffix}`).toISOString();
};

const buildRangeParams = (rangeValue, customRange) => {
  if (rangeValue === CUSTOM_RANGE_VALUE) {
    if (!customRange?.dateFrom || !customRange?.dateTo) {
      return null;
    }

    return {
      dateFrom: toDateBoundaryIso(customRange.dateFrom, 'start'),
      dateTo: toDateBoundaryIso(customRange.dateTo, 'end'),
    };
  }

  return { hoursBack: rangeValue };
};

const getRangeLabel = (rangeValue, customRange) => {
  if (rangeValue === ALL_TIME_HOURS) {
    return 'All Time';
  }

  if (rangeValue === CUSTOM_RANGE_VALUE) {
    if (customRange?.dateFrom && customRange?.dateTo) {
      return `${customRange.dateFrom} to ${customRange.dateTo}`;
    }

    return 'Custom Range';
  }

  return `${rangeValue} hour(s)`;
};

const DEFAULT_MACHINE_METRICS = {
  summary: {
    oee: 0,
    availability: 0,
    performance: 0,
    quality: 0,
    totalPieces: 0,
    defectivePieces: 0,
    goodPieces: 0,
    totalRuntimeSeconds: 0,
    totalDowntimeSeconds: 0,
    totalPlannedProductionTimeSeconds: 0,
    plannedProductionTimeHours: 0,
  },
  latestData: null,
  latestOee: null,
};

const formatLogTimestamp = (value) => {
  if (!value) return 'No timestamp';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Invalid timestamp';
  }

  return date.toLocaleString();
};

const formatPayload = (payload) => {
  if (typeof payload === 'string') {
    return payload;
  }

  return JSON.stringify(payload, null, 2) || 'No payload';
};

const formatMetricValue = (value, suffix = '') => {
  const numericValue = Number(value || 0);

  return `${Number.isInteger(numericValue) ? numericValue : numericValue.toFixed(2)}${suffix}`;
};

const formatDurationMinutes = (seconds) => {
  return `${Math.round((seconds || 0) / 60)} min`;
};

const getApproxMachineRpm = (machine, summary) => {
  const runtimeMinutes = Math.max(0, Number(summary?.totalRuntimeSeconds || 0) / 60);
  const totalPieces = Math.max(0, Number(summary?.totalPieces || 0));
  const observedRpm = runtimeMinutes > 0 && totalPieces > 0 ? totalPieces / runtimeMinutes : 0;
  const idealCycleTimeSeconds = Math.max(0.1, Number(machine?.defaultIdealCycleTimeSeconds) || 1);
  const idealBasedRpm = 60 / idealCycleTimeSeconds;
  const baseRpm = Math.max(observedRpm, idealBasedRpm, 200);

  return Math.min(230, Math.max(200, Math.round(baseRpm)));
};

const createRpmSeries = (baseRpm) => {
  const safeBaseRpm = Math.max(1, Number(baseRpm) || 1);
  const seriesLength = 10;
  const spikeChance = Math.random();
  const spikeIndexes = new Set();
  const spikeCount = spikeChance > 0.88 ? 1 : 0;

  while (spikeIndexes.size < spikeCount) {
    spikeIndexes.add(Math.floor(Math.random() * seriesLength));
  }

  let previousValue = safeBaseRpm;

  return Array.from({ length: seriesLength }, (_, index) => {
    if (spikeIndexes.has(index)) {
      previousValue = Math.max(1, Math.round(safeBaseRpm * (1.08 + Math.random() * 0.05)));
      return previousValue;
    }

    const drift = Math.round((Math.random() - 0.5) * Math.max(2, safeBaseRpm * 0.08));
    const pullToBase = Math.round((safeBaseRpm - previousValue) * 0.35);
    previousValue = Math.max(1, previousValue + drift + pullToBase);

    return previousValue;
  }).sort(() => Math.random() - 0.5);
};

const getRpmWarningMessage = (machineId, currentRpm, normalRpm) => {
  if (currentRpm > normalRpm * 1.08) {
    return `Issue in ${machineId}: RPM spiked to ${currentRpm}.`;
  }

  return '';
};

const upsertMachine = (machines, machine) => {
  const machineId = machine?.machineId;
  if (!machineId) {
    return machines;
  }

  const index = machines.findIndex((item) => item.machineId === machineId);
  if (index === -1) {
    return [...machines, machine];
  }

  const nextMachines = [...machines];
  nextMachines[index] = { ...nextMachines[index], ...machine };
  return nextMachines;
};

export const MachinesPage = () => {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMachine, setNewMachine] = useState({ machineId: '', location: '' });
  const [editMachineId, setEditMachineId] = useState('');
  const [editMachineForm, setEditMachineForm] = useState({
    location: '',
    manualDefectivePieces: '0',
  });
  const [savingMachineEdit, setSavingMachineEdit] = useState(false);
  const [logsByMachine, setLogsByMachine] = useState({});
  const [expandedLogsByMachine, setExpandedLogsByMachine] = useState({});
  const [expandedMachineId, setExpandedMachineId] = useState('');
  const [liveLogsEnabledByMachine, setLiveLogsEnabledByMachine] = useState({});
  const [powerActionMachineId, setPowerActionMachineId] = useState('');
  const [metricsByMachine, setMetricsByMachine] = useState({});
  const [metricsLoadingByMachine, setMetricsLoadingByMachine] = useState({});
  const [metricsErrorByMachine, setMetricsErrorByMachine] = useState({});
  const [selectedRangeHours, setSelectedRangeHours] = useState(METRICS_LOOKBACK_HOURS);
  const [selectedRangeByMachine, setSelectedRangeByMachine] = useState({});
  const [customDateRange, setCustomDateRange] = useState({ dateFrom: '', dateTo: '' });
  const [customDateRangeByMachine, setCustomDateRangeByMachine] = useState({});
  const [plannedProductionTimeSeconds, setPlannedProductionTimeSeconds] = useState(0);
  const [settingsSnapshot, setSettingsSnapshot] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [machineSummaries, setMachineSummaries] = useState({});
  const [idealMachineReference, setIdealMachineReference] = useState({
    machineId: 'IDEAL_MACHINE',
    oee: 100,
    availability: 100,
    performance: 100,
    quality: 100,
    totalPieces: 1200,
    goodPieces: 1200,
    defectivePieces: 0,
    runtimeMinutes: 60,
    idealCycleTimeHours: 1,
  });
  const [isEditingReference, setIsEditingReference] = useState(false);
  const [referenceForm, setReferenceForm] = useState({
    plannedProductionTimeHours: '1',
    comparisonLookbackHours: '1',
    machineId: 'IDEAL_MACHINE',
    oee: '100',
    availability: '100',
    performance: '100',
    quality: '100',
    totalPieces: '1200',
    goodPieces: '1200',
    defectivePieces: '0',
    runtimeHours: '1',
    idealCycleTimeHours: '1',
  });
  const [savingReference, setSavingReference] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [rpmTelemetryByMachine, setRpmTelemetryByMachine] = useState({});
  const [rpmWarning, setRpmWarning] = useState(null);
  const liveLogsEnabledRef = useRef({});

  useEffect(() => {
    liveLogsEnabledRef.current = liveLogsEnabledByMachine;
  }, [liveLogsEnabledByMachine]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (machines.length === 0) {
      setRpmTelemetryByMachine({});
      return undefined;
    }

    const syncTelemetry = () => {
      setRpmTelemetryByMachine((prev) => {
        const next = {};

        machines.forEach((machine) => {
          const summary = machineSummaries[machine.machineId] || DEFAULT_MACHINE_METRICS.summary;
          const isRunning = getLiveMachineStatus(machine) === 'running';
          const normalRpm = getApproxMachineRpm(machine, summary);
          const existing = prev[machine.machineId];

          if (existing) {
            if (!isRunning) {
              next[machine.machineId] = {
                ...existing,
                normalRpm,
                values: existing.values.map(() => 0),
                currentIndex: 0,
              };
              return;
            }

            const nextIndex = (existing.currentIndex + 1) % existing.values.length;
            const nextCurrentRpm = existing.values[nextIndex];
            const warningMessage = getRpmWarningMessage(
              machine.machineId,
              nextCurrentRpm,
              existing.normalRpm
            );

            if (warningMessage) {
              setRpmWarning({
                machineId: machine.machineId,
                message: warningMessage,
                currentRpm: nextCurrentRpm,
              });
            }

            next[machine.machineId] = {
              ...existing,
              normalRpm,
              currentIndex: nextIndex,
            };
            return;
          }

          if (!isRunning) {
            next[machine.machineId] = {
              normalRpm,
              values: Array.from({ length: 10 }, () => 0),
              currentIndex: 0,
            };
            return;
          }

          const values = createRpmSeries(normalRpm);
          next[machine.machineId] = {
            normalRpm,
            values,
            currentIndex: 0,
          };
        });

        return next;
      });
    };

    syncTelemetry();
    const intervalId = window.setInterval(syncTelemetry, 1800);

    return () => window.clearInterval(intervalId);
  }, [machines, machineSummaries]);

  useEffect(() => {
    if (!rpmWarning) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setRpmWarning(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [rpmWarning]);

  useEffect(() => {
    setMetricsByMachine({});
    setMetricsErrorByMachine({});
    setMachineSummaries({});

    const globalRangeParams = buildRangeParams(selectedRangeHours, customDateRange);
    if (!globalRangeParams) {
      return;
    }

    if (expandedMachineId) {
      const machineRange = selectedRangeByMachine[expandedMachineId] || selectedRangeHours;
      const machineRangeParams = buildRangeParams(
        machineRange,
        customDateRangeByMachine[expandedMachineId] || customDateRange
      );
      if (machineRangeParams) {
        fetchMachineMetrics(expandedMachineId, machineRangeParams);
      }
    }
    if (machines.length > 0) {
      fetchAllMachineSummaries(machines, globalRangeParams);
    }
  }, [selectedRangeHours, customDateRange]);

    useEffect(() => {
      fetchMachines();
      fetchSettings();
      socketService.connect();
      socketService.onAllMachineStatus(handleMachineStatus);
      socketService.onAllMachineLog(handleMachineLog);

      return () => {
      socketService.offAllMachineStatus(handleMachineStatus);
      socketService.offAllMachineLog(handleMachineLog);
      };
    }, []);

  const fetchSettings = async () => {
    try {
      const response = await settingsService.getSettings();
      const settings = response?.data?.settings;
      setSettingsSnapshot(settings || null);
      setPlannedProductionTimeSeconds(settings?.plannedProductionTimeSeconds || 0);
      setMachines((prev) =>
        prev.map((machine) => ({
          ...machine,
          defaultIdealCycleTimeSeconds: settings?.defaultIdealCycleTimeSeconds || 1,
        }))
      );
      setSelectedRangeHours(settings?.comparisonLookbackHours || 1);
      if (settings?.idealMachine) {
        const nextReference = {
          machineId: settings.idealMachine.machineId || 'IDEAL_MACHINE',
          oee: settings.idealMachine.oee ?? 100,
          availability: settings.idealMachine.availability ?? 100,
          performance: settings.idealMachine.performance ?? 100,
          quality: settings.idealMachine.quality ?? 100,
          totalPieces: settings.idealMachine.totalPieces ?? 1200,
          goodPieces: settings.idealMachine.goodPieces ?? 1200,
          defectivePieces: settings.idealMachine.defectivePieces ?? 0,
          runtimeMinutes: settings.idealMachine.runtimeMinutes ?? 60,
          idealCycleTimeHours: settings.idealMachine.idealCycleTimeHours ?? 1,
        };
        setIdealMachineReference(nextReference);
        setReferenceForm({
          plannedProductionTimeHours: String(settings?.plannedProductionTimeHours || 1),
          comparisonLookbackHours: String(settings?.comparisonLookbackHours || 1),
          machineId: nextReference.machineId,
          oee: String(nextReference.oee),
          availability: String(nextReference.availability),
          performance: String(nextReference.performance),
          quality: String(nextReference.quality),
          totalPieces: String(nextReference.totalPieces),
          goodPieces: String(nextReference.goodPieces),
          defectivePieces: String(nextReference.defectivePieces),
          runtimeHours: String((nextReference.runtimeMinutes || 0) / 60),
          idealCycleTimeHours: String(nextReference.idealCycleTimeHours ?? 1),
        });
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  const handleReferenceChange = (event) => {
    const { name, value } = event.target;
    setReferenceForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleReferenceSave = async () => {
    if (!settingsSnapshot) {
      setError('Settings are not loaded yet. Please refresh and try again.');
      return;
    }

    try {
      setSavingReference(true);
      setError('');

      await settingsService.updateSettings({
        apiUrl: settingsSnapshot.apiUrl,
        socketUrl: settingsSnapshot.socketUrl,
        refreshInterval: Number(settingsSnapshot.refreshInterval),
        plannedProductionTimeHours: Number(referenceForm.plannedProductionTimeHours),
        comparisonLookbackHours: Number(referenceForm.comparisonLookbackHours),
        defaultIdealCycleTimeSeconds: Number(settingsSnapshot.defaultIdealCycleTimeSeconds || 1),
        defaultBadPieces: Number(settingsSnapshot.defaultBadPieces || 0),
        idealMachine: {
          machineId: referenceForm.machineId,
          oee: Number(referenceForm.oee),
          availability: Number(referenceForm.availability),
          performance: Number(referenceForm.performance),
          quality: Number(referenceForm.quality),
          totalPieces: Number(referenceForm.totalPieces),
          goodPieces: Number(referenceForm.goodPieces),
          defectivePieces: Number(referenceForm.defectivePieces),
          runtimeMinutes: Number(referenceForm.runtimeHours) * 60,
          idealCycleTimeHours: Number(referenceForm.idealCycleTimeHours),
        },
      });

      setIsEditingReference(false);
      await fetchSettings();
    } catch (err) {
      setError('Failed to save reference benchmark');
      console.error(err);
    } finally {
      setSavingReference(false);
    }
  };

  const handleReferenceCancel = () => {
    setReferenceForm({
      plannedProductionTimeHours: String(
        settingsSnapshot?.plannedProductionTimeHours ||
          (settingsSnapshot?.plannedProductionTimeSeconds || 3600) / 3600
      ),
      comparisonLookbackHours: String(
        settingsSnapshot?.comparisonLookbackHours || selectedRangeHours || 1
      ),
      machineId: idealMachineReference.machineId,
      oee: String(idealMachineReference.oee),
      availability: String(idealMachineReference.availability),
      performance: String(idealMachineReference.performance),
      quality: String(idealMachineReference.quality),
      totalPieces: String(idealMachineReference.totalPieces),
      goodPieces: String(idealMachineReference.goodPieces),
      defectivePieces: String(idealMachineReference.defectivePieces),
      runtimeHours: String((idealMachineReference.runtimeMinutes || 0) / 60),
      idealCycleTimeHours: String(idealMachineReference.idealCycleTimeHours ?? 1),
    });
    setIsEditingReference(false);
  };

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const response = await machineService.getAllMachines();
      const fetchedMachines = response?.data?.machines || [];

      setMachines(
        fetchedMachines.map((machine) => ({
          ...machine,
          defaultIdealCycleTimeSeconds: settingsSnapshot?.defaultIdealCycleTimeSeconds || 1,
        }))
      );
      setExpandedLogsByMachine((prev) => {
        const nextState = { ...prev };
        fetchedMachines.forEach((machine) => {
          if (typeof nextState[machine.machineId] !== 'boolean') {
            nextState[machine.machineId] = false;
          }
        });
        return nextState;
      });
      setLiveLogsEnabledByMachine((prev) => {
        const nextState = { ...prev };
        fetchedMachines.forEach((machine) => {
          if (typeof nextState[machine.machineId] !== 'boolean') {
            nextState[machine.machineId] = true;
          }
        });
        return nextState;
      });
      const rangeParams = buildRangeParams(selectedRangeHours, customDateRange);
      if (rangeParams) {
        fetchAllMachineSummaries(fetchedMachines, rangeParams);
      }
    } catch (err) {
      setError('Failed to fetch machines');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMachineStatus = (machine) => {
    setMachines((prev) => upsertMachine(prev, machine));
    setExpandedLogsByMachine((prev) => {
      if (typeof prev[machine.machineId] === 'boolean') {
        return prev;
      }

      return {
        ...prev,
        [machine.machineId]: false,
      };
    });
    setLiveLogsEnabledByMachine((prev) => {
      if (typeof prev[machine.machineId] === 'boolean') {
        return prev;
      }

      return {
        ...prev,
        [machine.machineId]: true,
      };
    });
  };

  const handleMachineLog = (logEntry) => {
    const machineId = logEntry?.machineId;
    if (!machineId) {
      return;
    }

    setMachines((prev) =>
      upsertMachine(prev, {
        machineId,
        location: 'Auto-registered (MQTT)',
        isActive: true,
      })
    );

    setExpandedLogsByMachine((prev) => {
      if (typeof prev[machineId] === 'boolean') {
        return prev;
      }

      return {
        ...prev,
        [machineId]: false,
      };
    });

    setLiveLogsEnabledByMachine((prev) => {
      if (typeof prev[machineId] === 'boolean') {
        return prev;
      }

      return {
        ...prev,
        [machineId]: true,
      };
    });

    if (liveLogsEnabledRef.current[machineId] === false) {
      return;
    }

    setLogsByMachine((prev) => {
      const nextMachineLogs = prev[machineId]
        ? [logEntry, ...prev[machineId]]
        : [logEntry];

      return {
        ...prev,
        [machineId]: nextMachineLogs.slice(0, MAX_LOGS_PER_MACHINE),
      };
    });
  };

  const handleAddMachine = async (e) => {
    e.preventDefault();
    try {
      await machineService.createMachine({
        machineId: newMachine.machineId,
        location: newMachine.location,
      });
      setNewMachine({ machineId: '', location: '' });
      setShowAddForm(false);
      fetchMachines();
    } catch (err) {
      setError('Failed to add machine');
      console.error(err);
    }
  };

  const handleStartEditMachine = async (machine) => {
    try {
      setError('');
      const response = await machineService.getMachineById(machine.machineId);
      const latestMachine = response?.data?.machine || machine;

      setEditMachineId(latestMachine.machineId);
      setEditMachineForm({
        location: latestMachine.location || '',
        manualDefectivePieces: '0',
      });
    } catch (err) {
      console.error(err);
      setError(`Failed to load ${machine.machineId} for editing`);
      setEditMachineId(machine.machineId);
      setEditMachineForm({
        location: machine.location || '',
        manualDefectivePieces: '0',
      });
    }
  };

  const handleCancelEditMachine = () => {
    setEditMachineId('');
    setEditMachineForm({
      location: '',
      manualDefectivePieces: '0',
    });
  };

  const handleMachineEditChange = (event) => {
    const { name, value } = event.target;
    setEditMachineForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveMachineEdit = async (machineId) => {
    try {
      setSavingMachineEdit(true);
      setError('');
      const response = await machineService.updateMachine(machineId, {
        location: editMachineForm.location,
        manualDefectivePieces: Number(editMachineForm.manualDefectivePieces),
      });

      if (response?.data?.machine) {
        setMachines((prev) => upsertMachine(prev, response.data.machine));
      }

      const refreshedMachines = await machineService.getAllMachines();
      const nextMachines = refreshedMachines?.data?.machines || [];
      setMachines(
        nextMachines.map((machine) => ({
          ...machine,
          defaultIdealCycleTimeSeconds: settingsSnapshot?.defaultIdealCycleTimeSeconds || 1,
        }))
      );

      handleCancelEditMachine();

      const globalRangeParams = buildRangeParams(selectedRangeHours, customDateRange);
      if (globalRangeParams) {
        await fetchAllMachineSummaries(nextMachines, globalRangeParams);
      }

      if (expandedMachineId === machineId || expandedMachineId === '') {
        const machineRange = selectedRangeByMachine[machineId] || selectedRangeHours;
        const machineRangeParams = buildRangeParams(
          machineRange,
          customDateRangeByMachine[machineId] || customDateRange
        );

        if (machineRangeParams) {
          await fetchMachineMetrics(machineId, machineRangeParams);
        }
      }
    } catch (err) {
      setError(`Failed to update ${machineId}`);
      console.error(err);
    } finally {
      setSavingMachineEdit(false);
    }
  };

  const handleDeleteMachine = async (machineId) => {
    if (!confirm('Are you sure you want to delete this machine?')) return;

    try {
      await machineService.deleteMachine(machineId);
      setMachines((prev) => prev.filter((m) => m.machineId !== machineId));
      setExpandedMachineId((prev) => (prev === machineId ? '' : prev));
      setLogsByMachine((prev) => {
        const nextLogs = { ...prev };
        delete nextLogs[machineId];
        return nextLogs;
      });
      setMetricsByMachine((prev) => {
        const nextMetrics = { ...prev };
        delete nextMetrics[machineId];
        return nextMetrics;
      });
    } catch (err) {
      setError('Failed to delete machine');
      console.error(err);
    }
  };

  const handlePowerToggle = async (machine) => {
    const nextPowerState = machine.powerState === 'off' ? 'on' : 'off';
    const confirmationMessage =
      nextPowerState === 'off'
        ? `Turn off ${machine.machineId}? This will stop backend-side MQTT processing for this machine until you turn it on again.`
        : `Turn on ${machine.machineId}?`;

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    try {
      setPowerActionMachineId(machine.machineId);
      const response = await machineService.updateMachine(machine.machineId, {
        powerState: nextPowerState,
      });

      if (response?.data?.machine) {
        setMachines((prev) => upsertMachine(prev, response.data.machine));
      }
    } catch (err) {
      setError(`Failed to turn ${nextPowerState} ${machine.machineId}`);
      console.error(err);
    } finally {
      setPowerActionMachineId('');
    }
  };

  const toggleLogs = (machineId) => {
    setExpandedLogsByMachine((prev) => ({
      ...prev,
      [machineId]: !prev[machineId],
    }));
  };

  const toggleLiveLogs = (machineId) => {
    setLiveLogsEnabledByMachine((prev) => ({
      ...prev,
      [machineId]: !prev[machineId],
    }));
  };

  const fetchMachineMetrics = async (
    machineId,
    rangeParams = buildRangeParams(selectedRangeHours, customDateRange)
  ) => {
    if (!rangeParams) {
      return;
    }

    try {
      setMetricsLoadingByMachine((prev) => ({ ...prev, [machineId]: true }));
      setMetricsErrorByMachine((prev) => ({ ...prev, [machineId]: '' }));

      const [metricsResponse, latestResponse] = await Promise.all([
        productionService.getOEEMetrics(machineId, rangeParams),
        productionService.getLatestProduction(machineId),
      ]);

      setMetricsByMachine((prev) => ({
        ...prev,
        [machineId]: {
          summary: metricsResponse?.data?.summary || DEFAULT_MACHINE_METRICS.summary,
          latestData: latestResponse?.data?.data || null,
          latestOee: latestResponse?.data?.oeeMetrics || null,
        },
      }));
    } catch (err) {
      setMetricsErrorByMachine((prev) => ({
        ...prev,
        [machineId]: 'Failed to load machine metrics',
      }));
      console.error(err);
    } finally {
      setMetricsLoadingByMachine((prev) => ({ ...prev, [machineId]: false }));
    }
  };

  const fetchAllMachineSummaries = async (
    machineList,
    rangeParams = buildRangeParams(selectedRangeHours, customDateRange)
  ) => {
    const validMachines = (machineList || []).filter((machine) => machine?.machineId);
    if (validMachines.length === 0 || !rangeParams) {
      setMachineSummaries({});
      return;
    }

    try {
      const responses = await Promise.all(
        validMachines.map((machine) => productionService.getOEEMetrics(machine.machineId, rangeParams))
      );

      const nextSummaries = validMachines.reduce((accumulator, machine, index) => {
        accumulator[machine.machineId] = responses[index]?.data?.summary || DEFAULT_MACHINE_METRICS.summary;
        return accumulator;
      }, {});

      setMachineSummaries(nextSummaries);
    } catch (err) {
      console.error('Failed to fetch machine summaries:', err);
    }
  };

  const toggleMachineDetails = async (machineId) => {
    if (expandedMachineId === machineId) {
      setExpandedMachineId('');
      return;
    }

    const machineRange = selectedRangeByMachine[machineId] || selectedRangeHours;
    const machineRangeParams = buildRangeParams(
      machineRange,
      customDateRangeByMachine[machineId] || customDateRange
    );
    setExpandedMachineId(machineId);
    await fetchMachineMetrics(machineId, machineRangeParams);
  };

  const handleMachineRangeChange = async (machineId, hoursBack) => {
    setSelectedRangeByMachine((prev) => ({
      ...prev,
      [machineId]: hoursBack,
    }));

    const rangeParams = buildRangeParams(
      hoursBack,
      customDateRangeByMachine[machineId] || customDateRange
    );

    if (rangeParams) {
      await fetchMachineMetrics(machineId, rangeParams);
    }
  };

  const handleApplyCustomRange = async () => {
    const rangeParams = buildRangeParams(CUSTOM_RANGE_VALUE, customDateRange);
    if (!rangeParams) {
      return;
    }

    if (expandedMachineId) {
      await fetchMachineMetrics(expandedMachineId, rangeParams);
    }
    await fetchAllMachineSummaries(machines, rangeParams);
  };

  const handleApplyMachineCustomRange = async (machineId) => {
    const rangeParams = buildRangeParams(
      CUSTOM_RANGE_VALUE,
      customDateRangeByMachine[machineId] || { dateFrom: '', dateTo: '' }
    );
    if (!rangeParams) {
      return;
    }

    await fetchMachineMetrics(machineId, rangeParams);
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([fetchMachines(), fetchSettings()]);

      if (expandedMachineId) {
        const machineRange = selectedRangeByMachine[expandedMachineId] || selectedRangeHours;
        const rangeParams = buildRangeParams(
          machineRange,
          customDateRangeByMachine[expandedMachineId] || customDateRange
        );
        if (rangeParams) {
          await fetchMachineMetrics(expandedMachineId, rangeParams);
        }
      }
      const globalRangeParams = buildRangeParams(selectedRangeHours, customDateRange);
      if (globalRangeParams) {
        await fetchAllMachineSummaries(machines, globalRangeParams);
      }
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading machines...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* {rpmWarning && (
        <div className="fixed right-6 top-24 z-50 rounded-lg border border-amber-600 bg-amber-950/95 px-4 py-3 shadow-2xl">
          <p className="text-xs uppercase tracking-wide text-amber-300">Machine Warning</p>
          <p className="mt-1 text-sm font-medium text-white">{rpmWarning.message}</p>
        </div>
      )} */}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Machines</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedRangeHours}
            onChange={(event) => setSelectedRangeHours(Number(event.target.value))}
            className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2"
          >
            {TIME_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {selectedRangeHours === CUSTOM_RANGE_VALUE && (
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
                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg transition-colors"
              >
                Apply Range
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white rounded-lg transition-colors"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {showAddForm ? 'Cancel' : 'Add Machine'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddMachine} className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 mb-2">Machine ID</label>
              <input
                type="text"
                value={newMachine.machineId}
                onChange={(e) => setNewMachine({ ...newMachine, machineId: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter machine ID"
                required
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-2">Location</label>
              <input
                type="text"
                value={newMachine.location}
                onChange={(e) => setNewMachine({ ...newMachine, location: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter location"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            Add Machine
          </button>
        </form>
      )}

      {machines.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-cyan-800 bg-cyan-950/30 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-cyan-300">Reference Benchmark</p>
                <p className="mt-1 text-lg font-semibold text-white">{idealMachineReference.machineId}</p>
                <p className="text-sm text-gray-400">
                  Machines page is showing the last {selectedRangeHours} hour(s) by default and comparing against this saved benchmark.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isEditingReference ? (
                  <>
                    <button
                      type="button"
                      onClick={handleReferenceSave}
                      disabled={savingReference}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm"
                    >
                      {savingReference ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={handleReferenceCancel}
                      disabled={savingReference}
                      className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingReference(true)}
                    className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-sm"
                  >
                    Edit Benchmark
                  </button>
                )}
              </div>
            </div>

            {isEditingReference ? (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border border-cyan-900 bg-black/20 px-3 py-3">
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">
                    Planned Production Time (hours)
                  </label>
                  <input
                    type="number"
                    name="plannedProductionTimeHours"
                    min="0.1"
                    step="0.1"
                    value={referenceForm.plannedProductionTimeHours}
                    onChange={handleReferenceChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  />
                </div>
                <div className="rounded-lg border border-cyan-900 bg-black/20 px-3 py-3">
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">
                    Default Comparison Window (hours)
                  </label>
                  <input
                    type="number"
                    name="comparisonLookbackHours"
                    min="1"
                    max="168"
                    value={referenceForm.comparisonLookbackHours}
                    onChange={handleReferenceChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  />
                </div>
                <div className="rounded-lg border border-cyan-900 bg-black/20 px-3 py-3">
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Machine ID</label>
                  <input
                    type="text"
                    name="machineId"
                    value={referenceForm.machineId}
                    onChange={handleReferenceChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  />
                </div>
                <div className="rounded-lg border border-cyan-900 bg-black/20 px-3 py-3">
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">OEE</label>
                  <input
                    type="number"
                    name="oee"
                    min="0"
                    max="100"
                    value={referenceForm.oee}
                    onChange={handleReferenceChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  />
                </div>
                <div className="rounded-lg border border-cyan-900 bg-black/20 px-3 py-3">
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Availability</label>
                  <input
                    type="number"
                    name="availability"
                    min="0"
                    max="100"
                    value={referenceForm.availability}
                    onChange={handleReferenceChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  />
                </div>
                <div className="rounded-lg border border-cyan-900 bg-black/20 px-3 py-3">
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Performance</label>
                  <input
                    type="number"
                    name="performance"
                    min="0"
                    max="100"
                    value={referenceForm.performance}
                    onChange={handleReferenceChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  />
                </div>
                <div className="rounded-lg border border-cyan-900 bg-black/20 px-3 py-3">
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Quality</label>
                  <input
                    type="number"
                    name="quality"
                    min="0"
                    max="100"
                    value={referenceForm.quality}
                    onChange={handleReferenceChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  />
                </div>
                <div className="rounded-lg border border-cyan-900 bg-black/20 px-3 py-3">
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Runtime Hours</label>
                  <input
                    type="number"
                    name="runtimeHours"
                    min="0"
                    step="0.1"
                    value={referenceForm.runtimeHours}
                    onChange={handleReferenceChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  />
                </div>
                <div className="rounded-lg border border-cyan-900 bg-black/20 px-3 py-3">
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Ideal Cycle Time (seconds)</label>
                  <input
                    type="number"
                    name="idealCycleTimeHours"
                    min="0"
                    step="0.1"
                    value={referenceForm.idealCycleTimeHours}
                    onChange={handleReferenceChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  />
                </div>
                <div className="rounded-lg border border-cyan-900 bg-black/20 px-3 py-3">
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Total Pieces</label>
                  <input
                    type="number"
                    name="totalPieces"
                    min="0"
                    value={referenceForm.totalPieces}
                    onChange={handleReferenceChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  />
                </div>
                <div className="rounded-lg border border-cyan-900 bg-black/20 px-3 py-3">
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Good Pieces</label>
                  <input
                    type="number"
                    name="goodPieces"
                    min="0"
                    value={referenceForm.goodPieces}
                    onChange={handleReferenceChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  />
                </div>
                <div className="rounded-lg border border-cyan-900 bg-black/20 px-3 py-3">
                  <label className="block text-xs uppercase tracking-wide text-gray-400 mb-2">Bad Pieces</label>
                  <input
                    type="number"
                    name="defectivePieces"
                    min="0"
                    value={referenceForm.defectivePieces}
                    onChange={handleReferenceChange}
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6 text-sm">
                <div>
                  <p className="text-gray-400">OEE</p>
                  <p className="font-semibold text-white">{idealMachineReference.oee}%</p>
                </div>
                <div>
                  <p className="text-gray-400">Availability</p>
                  <p className="font-semibold text-white">{idealMachineReference.availability}%</p>
                </div>
                <div>
                  <p className="text-gray-400">Performance</p>
                  <p className="font-semibold text-white">{idealMachineReference.performance}%</p>
                </div>
                <div>
                  <p className="text-gray-400">Quality</p>
                  <p className="font-semibold text-white">{idealMachineReference.quality}%</p>
                </div>
                <div>
                  <p className="text-gray-400">Runtime</p>
                  <p className="font-semibold text-white">
                    {formatMetricValue((idealMachineReference.runtimeMinutes || 0) / 60)} hr
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Ideal Cycle</p>
                  <p className="font-semibold text-white">
                    {formatMetricValue(idealMachineReference.idealCycleTimeHours || 0)} sec
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Bad Pieces</p>
                  <p className="font-semibold text-white">
                    {formatMetricValue(idealMachineReference.defectivePieces || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Good Pieces</p>
                  <p className="font-semibold text-white">
                    {formatMetricValue(idealMachineReference.goodPieces || 0)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {machines.map((machine) => {
            const summary = machineSummaries[machine.machineId] || DEFAULT_MACHINE_METRICS.summary;

            return (
              <div
                key={`summary-${machine.machineId}`}
                className="rounded-xl border border-gray-700 bg-gray-900/80 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">{machine.machineId}</p>
                    <p className="text-xs text-gray-400">{machine.location}</p>
                  </div>
                  <MachineStatusBadge machine={machine} now={now} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-700 bg-black/20 px-3 py-3">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Total Pieces</p>
                    <p className="mt-2 text-xl font-semibold text-white">{formatMetricValue(summary.totalPieces)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-black/20 px-3 py-3">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Good Pieces</p>
                    <p className="mt-2 text-xl font-semibold text-emerald-300">{formatMetricValue(summary.goodPieces)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-black/20 px-3 py-3">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Bad Pieces</p>
                    <p className="mt-2 text-xl font-semibold text-amber-300">{formatMetricValue(summary.defectivePieces)}</p>
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-black/20 px-3 py-3">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Run Time</p>
                    <p className="mt-2 text-xl font-semibold text-cyan-300">{formatDurationMinutes(summary.totalRuntimeSeconds)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <thead className="bg-gray-900 border-b border-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-gray-300 font-medium">Machine ID</th>
              <th className="px-6 py-3 text-left text-gray-300 font-medium">Location</th>
              <th className="px-6 py-3 text-left text-gray-300 font-medium">Status</th>
              <th className="px-6 py-3 text-left text-gray-300 font-medium">Last Run</th>
              <th className="px-6 py-3 text-right text-gray-300 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((machine) => {
              const machineLogs = logsByMachine[machine.machineId] || [];
              const isExpanded = expandedMachineId === machine.machineId;
              const isLogsExpanded = !!expandedLogsByMachine[machine.machineId];
              const isLiveEnabled = liveLogsEnabledByMachine[machine.machineId] !== false;
              const isPowerBusy = powerActionMachineId === machine.machineId;
              const isPoweredOff = machine.powerState === 'off';
              const metrics = metricsByMachine[machine.machineId] || DEFAULT_MACHINE_METRICS;
              const summary = metrics.summary || DEFAULT_MACHINE_METRICS.summary;
              const metricsLoading = !!metricsLoadingByMachine[machine.machineId];
              const metricsError = metricsErrorByMachine[machine.machineId];
              const isEditingMachine = editMachineId === machine.machineId;
              const machineSelectedRange = selectedRangeByMachine[machine.machineId] || selectedRangeHours;
              const machineCustomRange =
                customDateRangeByMachine[machine.machineId] || customDateRange;
              const configuredPlannedTimeSeconds =
                plannedProductionTimeSeconds || summary.totalPlannedProductionTimeSeconds || 0;
              const rpmTelemetry = rpmTelemetryByMachine[machine.machineId];
              const rpmValues = rpmTelemetry?.values || [];
              const liveMachineStatus = getLiveMachineStatus(machine, now);
              const isMachineRunning = liveMachineStatus === 'running';
              const currentRpm = isMachineRunning
                ? rpmValues[rpmTelemetry?.currentIndex || 0] || 0
                : 0;
              const normalRpm = Math.round(rpmTelemetry?.normalRpm || getApproxMachineRpm(machine, summary));
              const isRpmWarning = isMachineRunning && currentRpm > normalRpm * 1.08;
              const primaryMetricCards = [
                { label: 'Quality', value: formatMetricValue(summary.quality, '%'), tone: 'emerald' },
                { label: 'OEE', value: formatMetricValue(summary.oee, '%'), tone: 'violet' },
                {
                  label: 'Performance',
                  value: formatMetricValue(summary.performance, '%'),
                  tone: 'amber',
                },
                {
                  label: 'Availability',
                  value: formatMetricValue(summary.availability, '%'),
                  tone: 'sky',
                },
              ];
              const secondaryMetricCards = [
                { label: 'Run Time', value: formatDurationMinutes(summary.totalRuntimeSeconds) },
                { label: 'Total Pieces', value: formatMetricValue(summary.totalPieces) },
                { label: 'Good Pieces', value: formatMetricValue(summary.goodPieces) },
                { label: 'Bad Pieces', value: formatMetricValue(summary.defectivePieces) },
                { label: 'Down Time', value: formatDurationMinutes(summary.totalDowntimeSeconds) },
                {
                  label: 'Default Ideal Cycle',
                  value: `${machine.defaultIdealCycleTimeSeconds || 1} sec`,
                },
                {
                  label: 'Planned Time',
                  value: formatDurationMinutes(configuredPlannedTimeSeconds),
                },
              ];

              return (
                <Fragment key={machine.machineId}>
                  <tr
                    className={`border-b border-gray-700 transition-colors cursor-pointer ${
                      isExpanded ? 'bg-gray-900/70' : 'hover:bg-gray-750'
                    }`}
                    onClick={() => toggleMachineDetails(machine.machineId)}
                  >
                    <td className="px-6 py-4 text-white font-medium">{machine.machineId}</td>
                    <td className="px-6 py-4 text-gray-300">{machine.location}</td>
                    <td className="px-6 py-4">
                      <MachineStatusBadge machine={machine} now={now} />
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {machine.lastHeartbeat ? formatDate(machine.lastHeartbeat) : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleMachineDetails(machine.machineId);
                          }}
                          className="px-3 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition"
                        >
                          {isExpanded ? 'Hide Details' : 'View Details'}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleLiveLogs(machine.machineId);
                          }}
                          disabled={isPoweredOff}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                            isPoweredOff
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                              : isLiveEnabled
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                          }`}
                        >
                          {isPoweredOff ? 'Powered Off' : isLiveEnabled ? 'Live On' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handlePowerToggle(machine);
                          }}
                          disabled={isPowerBusy}
                          className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                            isPoweredOff
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-amber-600 hover:bg-amber-700 text-white'
                          } disabled:opacity-50`}
                        >
                          {isPowerBusy ? 'Saving...' : isPoweredOff ? 'Turn On' : 'Turn Off'}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (isEditingMachine) {
                              handleCancelEditMachine();
                            } else {
                              handleStartEditMachine(machine);
                            }
                          }}
                          className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white transition"
                        >
                          {isEditingMachine ? 'Cancel Edit' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleLogs(machine.machineId);
                          }}
                          className="px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition"
                        >
                          {isLogsExpanded ? 'Hide Logs' : `Logs (${machineLogs.length})`}
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteMachine(machine.machineId);
                          }}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isEditingMachine && (
                    <tr className="border-b border-gray-700 bg-gray-950/70">
                      <td colSpan="5" className="px-6 py-5">
                        <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-4">
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              Edit {machine.machineId}
                            </h3>
                            <p className="text-sm text-gray-400 mt-1">
                              Update machine info and the manual bad-piece count used for quality and OEE.
                            </p>
                          </div>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <label className="block text-gray-300 mb-2">Location</label>
                              <input
                                type="text"
                                name="location"
                                value={editMachineForm.location}
                                onChange={handleMachineEditChange}
                                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-300 mb-2">
                                Add Bad Pieces
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                name="manualDefectivePieces"
                                value={editMachineForm.manualDefectivePieces}
                                onChange={handleMachineEditChange}
                                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-white"
                              />
                              <p className="mt-2 text-xs text-gray-500">
                                Current saved bad pieces: {machine.manualDefectivePieces ?? 0}. New value will be added to this total.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleSaveMachineEdit(machine.machineId)}
                              disabled={savingMachineEdit}
                              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white"
                            >
                              {savingMachineEdit ? 'Saving...' : 'Save Machine'}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditMachine}
                              disabled={savingMachineEdit}
                              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {isExpanded && (
                    <tr className="border-b border-gray-700 bg-gray-900/40">
                      <td colSpan="5" className="px-6 py-5">
                        <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-lg font-semibold text-white">
                                {machine.machineId} Performance Snapshot
                              </h3>
                              <p className="text-sm text-gray-400 mt-1">
                                Values below are calculated only for this machine and only for the selected time range.
                              </p>
                            </div>
                            <MachineStatusBadge machine={machine} now={now} />
                          </div>

                          {metricsLoading ? (
                            <div className="rounded-lg border border-dashed border-gray-600 px-4 py-6 text-sm text-gray-400">
                              Loading machine metrics...
                            </div>
                          ) : metricsError ? (
                            <div className="rounded-lg border border-red-700 bg-red-950/40 px-4 py-4 text-sm text-red-200">
                              {metricsError}
                            </div>
                          ) : (
                            <>
                              <div className="rounded-lg border border-gray-700 bg-black/20 px-4 py-3">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                  <p className="text-sm text-gray-300">
                                    Selected range:{' '}
                                    <span className="font-semibold text-white">
                                      {getRangeLabel(machineSelectedRange, machineCustomRange)}
                                    </span>
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <select
                                      value={machineSelectedRange}
                                      onChange={(event) =>
                                        handleMachineRangeChange(
                                          machine.machineId,
                                          Number(event.target.value)
                                        )
                                      }
                                      className="bg-gray-950 border border-gray-700 text-white rounded-lg px-4 py-2"
                                    >
                                      {TIME_RANGE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                    {machineSelectedRange === CUSTOM_RANGE_VALUE && (
                                      <>
                                        <input
                                          type="date"
                                          value={machineCustomRange.dateFrom || ''}
                                          onChange={(event) =>
                                            setCustomDateRangeByMachine((prev) => ({
                                              ...prev,
                                              [machine.machineId]: {
                                                ...(prev[machine.machineId] || { dateFrom: '', dateTo: '' }),
                                                dateFrom: event.target.value,
                                              },
                                            }))
                                          }
                                          className="bg-gray-950 border border-gray-700 text-white rounded-lg px-3 py-2"
                                        />
                                        <input
                                          type="date"
                                          value={machineCustomRange.dateTo || ''}
                                          onChange={(event) =>
                                            setCustomDateRangeByMachine((prev) => ({
                                              ...prev,
                                              [machine.machineId]: {
                                                ...(prev[machine.machineId] || { dateFrom: '', dateTo: '' }),
                                                dateTo: event.target.value,
                                              },
                                            }))
                                          }
                                          className="bg-gray-950 border border-gray-700 text-white rounded-lg px-3 py-2"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleApplyMachineCustomRange(machine.machineId)}
                                          className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg transition-colors"
                                        >
                                          Apply Range
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr]">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  {primaryMetricCards.map((item) => (
                                    <div
                                      key={item.label}
                                      className={`rounded-xl border px-5 py-4 ${
                                        item.tone === 'emerald'
                                          ? 'border-emerald-700 bg-emerald-950/40'
                                          : item.tone === 'violet'
                                          ? 'border-violet-700 bg-violet-950/40'
                                          : item.tone === 'amber'
                                          ? 'border-amber-700 bg-amber-950/40'
                                          : 'border-sky-700 bg-sky-950/40'
                                      }`}
                                    >
                                      <p className="text-xs uppercase tracking-[0.2em] text-gray-300">
                                        {item.label}
                                      </p>
                                      <p className="mt-3 text-3xl font-bold text-white">{item.value}</p>
                                    </div>
                                  ))}
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                  {secondaryMetricCards.map((item) => (
                                    <div
                                      key={item.label}
                                      className="rounded-lg border border-gray-700 bg-black/20 px-4 py-3"
                                    >
                                      <p className="text-xs uppercase tracking-wide text-gray-400">
                                        {item.label}
                                      </p>
                                      <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-xl border border-gray-700 bg-black/20 px-4 py-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                                      Live RPM Monitor
                                    </p>
                                    <div className="mt-2 flex items-end gap-3">
                                      <p className="text-3xl font-bold text-white">{currentRpm} RPM</p>
                                      <p className="pb-1 text-sm text-gray-400">
                                        {isMachineRunning
                                          ? `Normal around ${normalRpm} RPM`
                                          : 'RPM stopped with machine'}
                                      </p>
                                    </div>
                                  </div>
                                  <div
                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                      isRpmWarning
                                        ? 'bg-amber-900 text-amber-200 border border-amber-700'
                                        : 'bg-emerald-900 text-emerald-200 border border-emerald-700'
                                    }`}
                                  >
                                    {isRpmWarning
                                      ? `Issue in ${machine.machineId}`
                                      : isMachineRunning
                                      ? `${machine.machineId} RPM stable`
                                      : `${machine.machineId} RPM stopped`}
                                  </div>
                                </div>

                                {/* <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5 xl:grid-cols-10">
                                  {rpmValues.map((value, index) => {
                                    const isCurrent = index === (rpmTelemetry?.currentIndex || 0);
                                    const isSpike = value > normalRpm * 1.08;
                                    const barHeight = Math.max(
                                      24,
                                      Math.min(88, (value / Math.max(normalRpm * 1.2, 1)) * 88)
                                    );

                                    return (
                                      <div
                                        key={`${machine.machineId}-rpm-${index}`}
                                        className={`rounded-lg border px-3 py-3 transition-all ${
                                          isCurrent
                                            ? isSpike
                                              ? 'border-amber-500 bg-amber-950/60'
                                              : 'border-cyan-500 bg-cyan-950/40'
                                            : isSpike
                                            ? 'border-amber-800 bg-amber-950/20'
                                            : 'border-gray-700 bg-gray-950/40'
                                        }`}
                                      >
                                        <div className="flex h-24 items-end justify-center">
                                          <div
                                            className={`w-full rounded-md transition-all ${
                                              isSpike
                                                ? 'bg-amber-400'
                                                : isCurrent
                                                ? 'bg-cyan-400'
                                                : 'bg-gray-500'
                                            }`}
                                            style={{ height: `${barHeight}px` }}
                                          ></div>
                                        </div>
                                        <p className="mt-2 text-center text-[10px] uppercase tracking-wide text-gray-500">
                                          {isSpike ? 'Spike' : isCurrent ? 'Live' : 'RPM'}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div> */}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {isLogsExpanded && (
                    <tr className="border-b border-gray-700 bg-gray-900/40">
                      <td colSpan="5" className="px-6 py-5">
                        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
                          <div className="flex items-center justify-between gap-4 mb-4">
                            <div>
                              <h3 className="text-sm font-semibold text-white">
                                Live Logs for {machine.machineId}
                              </h3>
                              <p className="text-xs text-gray-400 mt-1">
                                Messages for this machine only.
                              </p>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-900 text-blue-200">
                              {machineLogs.length} recent logs
                            </span>
                          </div>

                          {machineLogs.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-600 px-4 py-6 text-sm text-gray-400">
                              No logs received for this machine yet.
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
                              {machineLogs.map((logEntry, index) => (
                                <article
                                  key={`${machine.machineId}-${logEntry.timestamp}-${index}`}
                                  className="rounded-lg border border-gray-700 bg-black/30 p-4"
                                >
                                  <div className="flex items-center justify-between gap-3 mb-3">
                                    <span className="text-xs uppercase tracking-wide text-blue-300">
                                      NodeMCU Message
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {formatLogTimestamp(logEntry.timestamp)}
                                    </span>
                                  </div>
                                  <div className="grid gap-3 lg:grid-cols-2">
                                    <div>
                                      <p className="text-xs font-semibold text-gray-400 mb-2">Parsed Data</p>
                                      <pre className="text-xs text-green-300 bg-black/30 rounded-md p-3 overflow-x-auto">
                                        {formatPayload(logEntry.parsedPayload)}
                                      </pre>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-gray-400 mb-2">Raw Message</p>
                                      <pre className="text-xs text-gray-200 bg-black/30 rounded-md p-3 overflow-x-auto">
                                        {formatPayload(logEntry.rawPayload)}
                                      </pre>
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {machines.length === 0 && !loading && (
        <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-gray-400 mb-4">No machines found</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Add Your First Machine
          </button>
        </div>
      )}
    </div>
  );
};
