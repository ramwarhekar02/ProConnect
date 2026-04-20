import AppSetting from '../models/AppSetting.js';

class AppSettingsService {
  constructor() {
    this.cache = null;
  }

  getDefaultSettings(defaultPlannedProductionTimeSeconds = 60) {
    return {
      key: 'global',
      plannedProductionTimeSeconds: Math.max(
        1,
        parseInt(defaultPlannedProductionTimeSeconds, 10) || 60
      ),
      apiUrl: process.env.API_BASE_URL || 'http://localhost:5000/api',
      socketUrl: process.env.SOCKET_BASE_URL || 'http://localhost:5000',
      refreshInterval: 5000,
      comparisonLookbackHours: 1,
      defaultIdealCycleTimeSeconds: Number(process.env.OEE_IDEAL_CYCLE_TIME_SECONDS || 1),
      defaultBadPieces: 0,
      idealMachine: {
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
      },
    };
  }

  async initialize(defaultPlannedProductionTimeSeconds = 60) {
    const defaults = this.getDefaultSettings(defaultPlannedProductionTimeSeconds);
    const settings = await AppSetting.findOneAndUpdate(
      { key: 'global' },
      { $setOnInsert: defaults },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    this.cache = settings.toObject();
    return this.cache;
  }

  getSettings(defaultPlannedProductionTimeSeconds = 60) {
    if (!this.cache) {
      this.cache = this.getDefaultSettings(defaultPlannedProductionTimeSeconds);
    }

    return this.cache;
  }

  getPlannedProductionTimeSeconds(defaultPlannedProductionTimeSeconds = 60) {
    return this.getSettings(defaultPlannedProductionTimeSeconds).plannedProductionTimeSeconds;
  }

  getPlannedProductionTimeHours(defaultPlannedProductionTimeSeconds = 60) {
    return this.getPlannedProductionTimeSeconds(defaultPlannedProductionTimeSeconds) / 3600;
  }

  getComparisonLookbackHours(defaultPlannedProductionTimeSeconds = 60) {
    return this.getSettings(defaultPlannedProductionTimeSeconds).comparisonLookbackHours || 1;
  }

  getIdealMachine(defaultPlannedProductionTimeSeconds = 60) {
    return this.getSettings(defaultPlannedProductionTimeSeconds).idealMachine;
  }

  async updateSettings(partialSettings = {}, defaultPlannedProductionTimeSeconds = 60) {
    const current = this.getSettings(defaultPlannedProductionTimeSeconds);
    const nextPlannedProductionTimeSeconds =
      partialSettings.plannedProductionTimeSeconds ?? current.plannedProductionTimeSeconds;
    const nextApiUrl = partialSettings.apiUrl ?? current.apiUrl;
    const nextSocketUrl = partialSettings.socketUrl ?? current.socketUrl;
    const nextRefreshInterval = partialSettings.refreshInterval ?? current.refreshInterval;
    const nextComparisonLookbackHours =
      partialSettings.comparisonLookbackHours ?? current.comparisonLookbackHours ?? 1;
    const nextDefaultIdealCycleTimeSeconds =
      partialSettings.defaultIdealCycleTimeSeconds ?? current.defaultIdealCycleTimeSeconds ?? 1;
    const nextDefaultBadPieces = partialSettings.defaultBadPieces ?? current.defaultBadPieces ?? 0;
    const nextIdealMachine = {
      ...current.idealMachine,
      ...(partialSettings.idealMachine || {}),
    };

    if (
      typeof nextPlannedProductionTimeSeconds !== 'number' ||
      Number.isNaN(nextPlannedProductionTimeSeconds) ||
      nextPlannedProductionTimeSeconds <= 0
    ) {
      throw new Error('plannedProductionTimeSeconds must be a positive number');
    }
    if (typeof nextApiUrl !== 'string' || nextApiUrl.trim().length === 0) {
      throw new Error('apiUrl must be a non-empty string');
    }
    if (typeof nextSocketUrl !== 'string' || nextSocketUrl.trim().length === 0) {
      throw new Error('socketUrl must be a non-empty string');
    }
    if (
      typeof nextRefreshInterval !== 'number' ||
      Number.isNaN(nextRefreshInterval) ||
      nextRefreshInterval < 1000 ||
      nextRefreshInterval > 60000
    ) {
      throw new Error('refreshInterval must be between 1000 and 60000 milliseconds');
    }
    if (
      typeof nextComparisonLookbackHours !== 'number' ||
      Number.isNaN(nextComparisonLookbackHours) ||
      nextComparisonLookbackHours < 1 ||
      nextComparisonLookbackHours > 168
    ) {
      throw new Error('comparisonLookbackHours must be between 1 and 168');
    }
    if (
      typeof nextDefaultIdealCycleTimeSeconds !== 'number' ||
      Number.isNaN(nextDefaultIdealCycleTimeSeconds) ||
      nextDefaultIdealCycleTimeSeconds <= 0
    ) {
      throw new Error('defaultIdealCycleTimeSeconds must be a positive number');
    }
    if (
      typeof nextDefaultBadPieces !== 'number' ||
      Number.isNaN(nextDefaultBadPieces) ||
      nextDefaultBadPieces < 0
    ) {
      throw new Error('defaultBadPieces must be a non-negative number');
    }

    const settings = await AppSetting.findOneAndUpdate(
      { key: 'global' },
      {
        key: 'global',
        plannedProductionTimeSeconds: nextPlannedProductionTimeSeconds,
        apiUrl: nextApiUrl.trim(),
        socketUrl: nextSocketUrl.trim(),
        refreshInterval: nextRefreshInterval,
        comparisonLookbackHours: nextComparisonLookbackHours,
        defaultIdealCycleTimeSeconds: nextDefaultIdealCycleTimeSeconds,
        defaultBadPieces: nextDefaultBadPieces,
        idealMachine: nextIdealMachine,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    this.cache = settings.toObject();
    return this.cache;
  }
}

const appSettingsService = new AppSettingsService();

export default appSettingsService;
