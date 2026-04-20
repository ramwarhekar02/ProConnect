import ProductionData from '../models/ProductionData.js';
import Machine from '../models/Machine.js';
import OEECalculationService from '../services/OEECalculationService.js';
import appSettingsService from '../services/AppSettingsService.js';

const resolveTimeRange = (query = {}, defaultHoursBack = 24) => {
  const { hoursBack = defaultHoursBack, dateFrom, dateTo } = query;
  const now = new Date();

  if (dateFrom || dateTo) {
    const startTime = dateFrom ? new Date(dateFrom) : new Date(0);
    const endTime = dateTo ? new Date(dateTo) : now;

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new Error('dateFrom/dateTo must be valid dates');
    }

    if (startTime > endTime) {
      throw new Error('dateFrom must be before dateTo');
    }

    const computedHoursBack = Math.max(
      1,
      Math.ceil((endTime.getTime() - startTime.getTime()) / (60 * 60 * 1000))
    );

    return {
      startTime,
      endTime,
      hoursBack: computedHoursBack,
      isCustomRange: true,
    };
  }

  const numericHoursBack = Math.max(1, Number(hoursBack) || defaultHoursBack);
  return {
    startTime: new Date(now.getTime() - numericHoursBack * 60 * 60 * 1000),
    endTime: now,
    hoursBack: numericHoursBack,
    isCustomRange: false,
  };
};

const normalizeDefectivePieces = (totalPieces, defectivePieces) =>
  Math.min(Math.max(0, Number(totalPieces) || 0), Math.max(0, Number(defectivePieces) || 0));

const resolveManualDefectivePieces = (machineManualDefectivePieces, fallbackDefaultBadPieces = 0) => {
  const machineValue = Number(machineManualDefectivePieces);
  if (machineManualDefectivePieces !== undefined && machineManualDefectivePieces !== null && Number.isFinite(machineValue) && machineValue >= 0) {
    return machineValue;
  }

  const fallbackValue = Number(fallbackDefaultBadPieces);
  return Number.isFinite(fallbackValue) && fallbackValue >= 0 ? fallbackValue : 0;
};

const calculateEffectiveIdealCycleTimeSeconds = (records = [], fallbackIdealCycleTimeSeconds = 1) => {
  const explicitIdealCycleTimeSeconds = Number(fallbackIdealCycleTimeSeconds);
  if (Number.isFinite(explicitIdealCycleTimeSeconds) && explicitIdealCycleTimeSeconds > 0) {
    return explicitIdealCycleTimeSeconds;
  }

  const weightedTotals = records.reduce(
    (accumulator, record) => {
      const recordPieces = Math.max(0, Number(record.totalPieces) || 0);
      const recordIdealCycleTimeSeconds = Math.max(
        0,
        Number(record.idealCycleTimeSeconds || fallbackIdealCycleTimeSeconds) || 0
      );

      if (recordPieces > 0 && recordIdealCycleTimeSeconds > 0) {
        accumulator.weightedIdealSeconds += recordIdealCycleTimeSeconds * recordPieces;
        accumulator.totalPieces += recordPieces;
      }

      return accumulator;
    },
    { weightedIdealSeconds: 0, totalPieces: 0 }
  );

  if (weightedTotals.totalPieces > 0) {
    return weightedTotals.weightedIdealSeconds / weightedTotals.totalPieces;
  }

  return Math.max(0.1, Number(fallbackIdealCycleTimeSeconds) || 1);
};

const applyManualDefectiveAdjustments = ({
  payload,
  manualDefectivePieces = 0,
  idealCycleTimeSeconds,
  configuredPlannedProductionTimeSeconds,
  records = [],
}) => {
  if (!payload?.summary) {
    return payload;
  }

  const totalPieces = Math.max(0, Number(payload.summary.totalPieces) || 0);
  const effectiveDefectivePieces = normalizeDefectivePieces(totalPieces, manualDefectivePieces);
  const effectiveIdealCycleTimeSeconds = calculateEffectiveIdealCycleTimeSeconds(
    records,
    idealCycleTimeSeconds
  );

  const recalculatedOee = OEECalculationService.calculateOEE({
    totalPieces,
    defectivePieces: effectiveDefectivePieces,
    runtimeSeconds: Math.max(0, Number(payload.summary.totalRuntimeSeconds) || 0),
    plannedProductionTimeSeconds:
      Math.max(1, Number(configuredPlannedProductionTimeSeconds) || 0) ||
      Math.max(1, Number(payload.summary.totalPlannedProductionTimeSeconds) || 0),
    idealCycleTimeSeconds: effectiveIdealCycleTimeSeconds,
  });

  return {
    ...payload,
    summary: {
      ...payload.summary,
      defectivePieces: effectiveDefectivePieces,
      goodPieces: Math.max(0, totalPieces - effectiveDefectivePieces),
      oee: recalculatedOee.oee,
      availability: recalculatedOee.availability,
      performance: recalculatedOee.performance,
      quality: recalculatedOee.quality,
    },
  };
};

const buildMetricsPayload = ({
  data = [],
  configuredPlannedProductionTimeSeconds,
  hoursBack,
  machineIds = [],
  machineLabel,
}) => {
  if (data.length === 0) {
    return {
      success: true,
      message: 'No production data for the specified time range.',
      machineId: machineLabel,
      machineIds,
      timeRange: {
        start: new Date(Date.now() - hoursBack * 60 * 60 * 1000),
        end: new Date(),
        hoursBack,
      },
      dataPoints: 0,
      summary: {
        totalRuntimeSeconds: 0,
        totalDowntimeSeconds: 0,
        totalPlannedProductionTimeSeconds: configuredPlannedProductionTimeSeconds,
        plannedProductionTimeHours: configuredPlannedProductionTimeSeconds / 3600,
        totalPieces: 0,
        defectivePieces: 0,
        goodPieces: 0,
        oee: 0,
        availability: 0,
        performance: 0,
        quality: 0,
      },
      averages: {
        oee: 0,
        availability: 0,
        performance: 0,
        quality: 0,
      },
      metrics: [],
    };
  }

  const metrics = data.map((record) =>
    OEECalculationService.calculateOEE({
      totalPieces: record.totalPieces,
      defectivePieces: record.defectivePieces,
      runtimeSeconds: record.runtimeSeconds,
      plannedProductionTimeSeconds: record.plannedProductionTimeSeconds,
      idealCycleTimeSeconds: record.idealCycleTimeSeconds,
    })
  );

  const totals = data.reduce(
    (summary, record) => ({
      totalRuntimeSeconds: summary.totalRuntimeSeconds + (record.runtimeSeconds || 0),
      totalDowntimeSeconds: summary.totalDowntimeSeconds + (record.downtimeSeconds || 0),
      totalPieces: summary.totalPieces + (record.totalPieces || 0),
      defectivePieces: summary.defectivePieces + (record.defectivePieces || 0),
    }),
    {
      totalRuntimeSeconds: 0,
      totalDowntimeSeconds: 0,
      totalPieces: 0,
      defectivePieces: 0,
    }
  );

  const aggregatedOEE = OEECalculationService.calculateOEE({
    totalPieces: totals.totalPieces,
    defectivePieces: totals.defectivePieces,
    runtimeSeconds: totals.totalRuntimeSeconds,
    plannedProductionTimeSeconds: configuredPlannedProductionTimeSeconds,
    idealCycleTimeSeconds: data[0]?.idealCycleTimeSeconds || 1,
  });

  const avgOEE = metrics.reduce((sum, metric) => sum + metric.oee, 0) / metrics.length;
  const avgAvailability = metrics.reduce((sum, metric) => sum + metric.availability, 0) / metrics.length;
  const avgPerformance = metrics.reduce((sum, metric) => sum + metric.performance, 0) / metrics.length;
  const avgQuality = metrics.reduce((sum, metric) => sum + metric.quality, 0) / metrics.length;

  return {
    success: true,
    machineId: machineLabel,
    machineIds,
    dataPoints: metrics.length,
    summary: {
      ...totals,
      totalPlannedProductionTimeSeconds: configuredPlannedProductionTimeSeconds,
      plannedProductionTimeHours: configuredPlannedProductionTimeSeconds / 3600,
      totalDowntimeSeconds: Math.max(0, configuredPlannedProductionTimeSeconds - totals.totalRuntimeSeconds),
      goodPieces: Math.max(0, totals.totalPieces - totals.defectivePieces),
      oee: aggregatedOEE.oee,
      availability: aggregatedOEE.availability,
      performance: aggregatedOEE.performance,
      quality: aggregatedOEE.quality,
    },
    averages: {
      oee: parseFloat(avgOEE.toFixed(2)),
      availability: parseFloat(avgAvailability.toFixed(2)),
      performance: parseFloat(avgPerformance.toFixed(2)),
      quality: parseFloat(avgQuality.toFixed(2)),
    },
    metrics,
  };
};

export const getProductionData = async (req, res, next) => {
  try {
    const { machineId, limit = 100, skip = 0 } = req.query;
    const { startTime, endTime } = resolveTimeRange(req.query, 24);

    let query = {};
    if (machineId) {
      query.machineId = machineId.toUpperCase();
    }
    if (req.query.dateFrom || req.query.dateTo) {
      query.timestamp = { $gte: startTime, $lte: endTime };
    }

    const data = await ProductionData.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await ProductionData.countDocuments(query);

    res.status(200).json({
      success: true,
      total,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getProductionDataByMachine = async (req, res, next) => {
  try {
    const { machineId } = req.params;
    const { limit = 100, skip = 0 } = req.query;
    const { startTime, endTime } = resolveTimeRange(req.query, 24);

    const query = { machineId: machineId.toUpperCase() };
    if (req.query.dateFrom || req.query.dateTo) {
      query.timestamp = { $gte: startTime, $lte: endTime };
    }

    const data = await ProductionData.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await ProductionData.countDocuments(query);

    res.status(200).json({
      success: true,
      machineId: machineId.toUpperCase(),
      total,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const recordProductionData = async (req, res, next) => {
  try {
    const { machineId } = req.params;
    const {
      totalPieces,
      defectivePieces,
      runtimeSeconds,
      downtimeSeconds,
      plannedProductionTimeSeconds,
      idealCycleTimeSeconds,
      timestamp,
    } = req.body;

    // Validate required fields
    if (
      typeof totalPieces !== 'number' ||
      typeof defectivePieces !== 'number' ||
      typeof runtimeSeconds !== 'number' ||
      typeof downtimeSeconds !== 'number' ||
      typeof plannedProductionTimeSeconds !== 'number'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid required fields.',
      });
    }

    // Calculate OEE
    const oeeMetrics = OEECalculationService.calculateOEE({
      totalPieces,
      defectivePieces,
      runtimeSeconds,
      plannedProductionTimeSeconds,
      idealCycleTimeSeconds: idealCycleTimeSeconds || 1,
    });

    const productionData = new ProductionData({
      machineId: machineId.toUpperCase(),
      totalPieces,
      defectivePieces,
      runtimeSeconds,
      downtimeSeconds,
      plannedProductionTimeSeconds,
      idealCycleTimeSeconds: idealCycleTimeSeconds || 1,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    await productionData.save();

    // Include OEE metrics in response
    res.status(201).json({
      success: true,
      message: 'Production data recorded successfully.',
      data: productionData,
      oeeMetrics,
    });
  } catch (error) {
    next(error);
  }
};

export const getLatestProductionData = async (req, res, next) => {
  try {
    const { machineId } = req.params;
    const normalizedMachineId = machineId.toUpperCase();
    const settings = appSettingsService.getSettings(
      process.env.MQTT_AGGREGATION_WINDOW_SECONDS || 60
    );
    const configuredPlannedProductionTimeSeconds = appSettingsService.getPlannedProductionTimeSeconds(
      process.env.MQTT_AGGREGATION_WINDOW_SECONDS || 60
    );

    const machine = await Machine.findOne({ machineId: normalizedMachineId })
      .select('manualDefectivePieces')
      .lean();

    const data =
      (await ProductionData.findOne({
        machineId: normalizedMachineId,
        $or: [{ totalPieces: { $gt: 0 } }, { defectivePieces: { $gt: 0 } }],
      }).sort({
        timestamp: -1,
      })) ||
      (await ProductionData.findOne({ machineId: normalizedMachineId }).sort({
        timestamp: -1,
      }));

    if (!data) {
      return res.status(200).json({
        success: true,
        machineId: normalizedMachineId,
        data: null,
        oeeMetrics: null,
        message: 'No production data found for this machine yet.',
      });
    }

    const effectiveDefectivePieces = normalizeDefectivePieces(
      data.totalPieces,
      resolveManualDefectivePieces(machine?.manualDefectivePieces, settings.defaultBadPieces)
    );

    // Calculate OEE for latest data
    const oeeMetrics = OEECalculationService.calculateOEE({
      totalPieces: data.totalPieces,
      defectivePieces: effectiveDefectivePieces,
      runtimeSeconds: data.runtimeSeconds,
      plannedProductionTimeSeconds: configuredPlannedProductionTimeSeconds,
      idealCycleTimeSeconds: settings.defaultIdealCycleTimeSeconds || data.idealCycleTimeSeconds || 1,
    });

    res.status(200).json({
      success: true,
      machineId: normalizedMachineId,
      data: {
        ...data.toObject(),
        defectivePieces: effectiveDefectivePieces,
        goodPieces: Math.max(0, data.totalPieces - effectiveDefectivePieces),
      },
      oeeMetrics,
    });
  } catch (error) {
    next(error);
  }
};

export const getOEEMetrics = async (req, res, next) => {
  try {
    const { machineId } = req.params;
    const normalizedMachineId = machineId.toUpperCase();
    const settings = appSettingsService.getSettings(
      process.env.MQTT_AGGREGATION_WINDOW_SECONDS || 60
    );
    const configuredPlannedProductionTimeSeconds = appSettingsService.getPlannedProductionTimeSeconds(
      process.env.MQTT_AGGREGATION_WINDOW_SECONDS || 60
    );
    const { startTime, endTime, hoursBack, isCustomRange } = resolveTimeRange(req.query, 24);
    const machine = await Machine.findOne({ machineId: normalizedMachineId })
      .select('manualDefectivePieces')
      .lean();

    const data = await ProductionData.find({
      machineId: normalizedMachineId,
      timestamp: { $gte: startTime, $lte: endTime },
    }).sort({ timestamp: 1 });
    const payload = applyManualDefectiveAdjustments({
      payload: buildMetricsPayload({
        data,
        configuredPlannedProductionTimeSeconds,
        hoursBack: Number(hoursBack),
        machineIds: [normalizedMachineId],
        machineLabel: normalizedMachineId,
      }),
      manualDefectivePieces: resolveManualDefectivePieces(
        machine?.manualDefectivePieces,
        settings.defaultBadPieces
      ),
      idealCycleTimeSeconds: settings.defaultIdealCycleTimeSeconds || 1,
      configuredPlannedProductionTimeSeconds,
      records: data,
    });

    res.status(200).json({
      ...payload,
      timeRange: { start: startTime, end: endTime, hoursBack, isCustomRange },
    });
  } catch (error) {
    next(error);
  }
};

export const getOverallOEEMetrics = async (req, res, next) => {
  try {
    const settings = appSettingsService.getSettings(
      process.env.MQTT_AGGREGATION_WINDOW_SECONDS || 60
    );
    const configuredPlannedProductionTimeSeconds = appSettingsService.getPlannedProductionTimeSeconds(
      process.env.MQTT_AGGREGATION_WINDOW_SECONDS || 60
    );
    const { startTime, endTime, hoursBack, isCustomRange } = resolveTimeRange(req.query, 24);

    const activeMachines = await Machine.find({ isActive: true, powerState: { $ne: 'off' } })
      .select('machineId status location lastHeartbeat manualDefectivePieces')
      .lean();

    const machineIds = activeMachines.map((machine) => machine.machineId);
    const data = machineIds.length
      ? await ProductionData.find({
          machineId: { $in: machineIds },
          timestamp: { $gte: startTime, $lte: endTime },
        }).sort({ timestamp: 1 })
      : [];

    const perMachine = activeMachines.map((machine) => {
      const machineRows = data.filter((record) => record.machineId === machine.machineId);
      const machinePayload = applyManualDefectiveAdjustments({
        payload: buildMetricsPayload({
          data: machineRows,
          configuredPlannedProductionTimeSeconds,
          hoursBack: Number(hoursBack),
          machineIds: [machine.machineId],
          machineLabel: machine.machineId,
        }),
        manualDefectivePieces: resolveManualDefectivePieces(
          machine.manualDefectivePieces,
          settings.defaultBadPieces
        ),
        idealCycleTimeSeconds: settings.defaultIdealCycleTimeSeconds || 1,
        configuredPlannedProductionTimeSeconds,
        records: machineRows,
      });

      return {
        machineId: machine.machineId,
        status: machine.status,
        location: machine.location,
        lastHeartbeat: machine.lastHeartbeat,
        manualDefectivePieces: machine.manualDefectivePieces || 0,
        summary: machinePayload.summary,
      };
    });

    const overallTotalPieces = perMachine.reduce(
      (sum, machine) => sum + (machine.summary?.totalPieces || 0),
      0
    );
    const overallDefectivePieces = perMachine.reduce(
      (sum, machine) => sum + (machine.summary?.defectivePieces || 0),
      0
    );
    const effectiveOverallIdealCycleTimeSeconds = settings.defaultIdealCycleTimeSeconds || 1;
    const overallPayload = applyManualDefectiveAdjustments({
      payload: buildMetricsPayload({
        data,
        configuredPlannedProductionTimeSeconds:
          configuredPlannedProductionTimeSeconds * Math.max(machineIds.length, 1),
        hoursBack: Number(hoursBack),
        machineIds,
        machineLabel: 'ALL_MACHINES',
      }),
      manualDefectivePieces: normalizeDefectivePieces(overallTotalPieces, overallDefectivePieces),
      idealCycleTimeSeconds: effectiveOverallIdealCycleTimeSeconds,
      configuredPlannedProductionTimeSeconds:
        configuredPlannedProductionTimeSeconds * Math.max(machineIds.length, 1),
      records: data,
    });

    res.status(200).json({
      ...overallPayload,
      timeRange: { start: startTime, end: endTime, hoursBack, isCustomRange },
      machines: perMachine,
    });
  } catch (error) {
    next(error);
  }
};
