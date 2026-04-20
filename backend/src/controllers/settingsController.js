import appSettingsService from '../services/AppSettingsService.js';

export const getSettings = async (req, res, next) => {
  try {
    const settings = appSettingsService.getSettings(
      process.env.MQTT_AGGREGATION_WINDOW_SECONDS || 60
    );

    res.status(200).json({
      success: true,
      settings: {
        ...settings,
        plannedProductionTimeHours: settings.plannedProductionTimeSeconds / 3600,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const {
      plannedProductionTimeSeconds,
      plannedProductionTimeHours,
      apiUrl,
      socketUrl,
      refreshInterval,
      comparisonLookbackHours,
      defaultIdealCycleTimeSeconds,
      defaultBadPieces,
      idealMachine,
    } = req.body;
    const resolvedPlannedProductionTimeSeconds =
      typeof plannedProductionTimeHours === 'number'
        ? plannedProductionTimeHours * 3600
        : plannedProductionTimeSeconds;

    if (
      typeof resolvedPlannedProductionTimeSeconds !== 'number' ||
      typeof apiUrl !== 'string' ||
      typeof socketUrl !== 'string' ||
      typeof refreshInterval !== 'number' ||
      typeof comparisonLookbackHours !== 'number' ||
      typeof defaultIdealCycleTimeSeconds !== 'number' ||
      typeof defaultBadPieces !== 'number'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'plannedProductionTimeHours/apiUrl/socketUrl/refreshInterval/comparisonLookbackHours/defaultIdealCycleTimeSeconds/defaultBadPieces are required and must be valid.',
      });
    }

    const settings = await appSettingsService.updateSettings(
      {
        plannedProductionTimeSeconds: resolvedPlannedProductionTimeSeconds,
        apiUrl,
        socketUrl,
        refreshInterval,
        comparisonLookbackHours,
        defaultIdealCycleTimeSeconds,
        defaultBadPieces,
        idealMachine,
      },
      process.env.MQTT_AGGREGATION_WINDOW_SECONDS || 60
    );

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully.',
      settings: {
        ...settings,
        plannedProductionTimeHours: settings.plannedProductionTimeSeconds / 3600,
      },
    });
  } catch (error) {
    next(error);
  }
};
