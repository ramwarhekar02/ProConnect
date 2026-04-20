import React, { useEffect, useState } from 'react';
import { settingsService } from '../../services/apiService';

const DEFAULT_SETTINGS = {
  apiUrl: 'http://localhost:5000/api',
  socketUrl: 'http://localhost:5000',
  refreshInterval: '5000',
  plannedProductionTimeHours: '10',
  comparisonLookbackHours: '1',
  defaultIdealCycleTimeSeconds: '1',
  defaultBadPieces: '0',
  idealMachineId: 'IDEAL_MACHINE',
  idealOee: '100',
  idealAvailability: '100',
  idealPerformance: '100',
  idealQuality: '100',
  idealTotalPieces: '1200',
  idealGoodPieces: '1200',
  idealDefectivePieces: '0',
  idealRuntimeMinutes: '60',
};

export const SettingsPage = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settingsService.getSettings();
        const loaded = response?.data?.settings;

        setSettings({
          apiUrl: loaded?.apiUrl || DEFAULT_SETTINGS.apiUrl,
          socketUrl: loaded?.socketUrl || DEFAULT_SETTINGS.socketUrl,
          refreshInterval: String(loaded?.refreshInterval || DEFAULT_SETTINGS.refreshInterval),
          plannedProductionTimeHours: String(
            loaded?.plannedProductionTimeHours || DEFAULT_SETTINGS.plannedProductionTimeHours
          ),
          comparisonLookbackHours: String(
            loaded?.comparisonLookbackHours || DEFAULT_SETTINGS.comparisonLookbackHours
          ),
          defaultIdealCycleTimeSeconds: String(
            loaded?.defaultIdealCycleTimeSeconds ?? DEFAULT_SETTINGS.defaultIdealCycleTimeSeconds
          ),
          defaultBadPieces: String(
            loaded?.defaultBadPieces ?? DEFAULT_SETTINGS.defaultBadPieces
          ),
          idealMachineId: loaded?.idealMachine?.machineId || DEFAULT_SETTINGS.idealMachineId,
          idealOee: String(loaded?.idealMachine?.oee ?? DEFAULT_SETTINGS.idealOee),
          idealAvailability: String(
            loaded?.idealMachine?.availability ?? DEFAULT_SETTINGS.idealAvailability
          ),
          idealPerformance: String(
            loaded?.idealMachine?.performance ?? DEFAULT_SETTINGS.idealPerformance
          ),
          idealQuality: String(loaded?.idealMachine?.quality ?? DEFAULT_SETTINGS.idealQuality),
          idealTotalPieces: String(
            loaded?.idealMachine?.totalPieces ?? DEFAULT_SETTINGS.idealTotalPieces
          ),
          idealGoodPieces: String(
            loaded?.idealMachine?.goodPieces ?? DEFAULT_SETTINGS.idealGoodPieces
          ),
          idealDefectivePieces: String(
            loaded?.idealMachine?.defectivePieces ?? DEFAULT_SETTINGS.idealDefectivePieces
          ),
          idealRuntimeMinutes: String(
            loaded?.idealMachine?.runtimeMinutes ?? DEFAULT_SETTINGS.idealRuntimeMinutes
          ),
        });
      } catch (loadError) {
        console.error('Failed to load backend settings:', loadError);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      setError('');
      await settingsService.updateSettings({
        apiUrl: settings.apiUrl,
        socketUrl: settings.socketUrl,
        refreshInterval: Number(settings.refreshInterval),
        plannedProductionTimeHours: Number(settings.plannedProductionTimeHours),
        comparisonLookbackHours: Number(settings.comparisonLookbackHours),
        defaultIdealCycleTimeSeconds: Number(settings.defaultIdealCycleTimeSeconds),
        defaultBadPieces: Number(settings.defaultBadPieces),
        idealMachine: {
          machineId: settings.idealMachineId,
          oee: Number(settings.idealOee),
          availability: Number(settings.idealAvailability),
          performance: Number(settings.idealPerformance),
          quality: Number(settings.idealQuality),
          totalPieces: Number(settings.idealTotalPieces),
          goodPieces: Number(settings.idealGoodPieces),
          defectivePieces: Number(settings.idealDefectivePieces),
          runtimeMinutes: Number(settings.idealRuntimeMinutes),
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (saveError) {
      setSaved(false);
      setError('Failed to save settings');
      console.error(saveError);
    }
  };

  const handleResetDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    setSaved(false);
    setError('');
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Configure runtime, comparison, and benchmark values saved in the database.</p>
      </div>

      {saved && (
        <div className="bg-green-900 border border-green-700 text-green-300 px-4 py-3 rounded-lg">
          Settings saved successfully.
        </div>
      )}

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold text-white">Application Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="apiUrl" className="block text-sm font-medium text-gray-300 mb-2">
              API Base URL
            </label>
            <input
              type="text"
              id="apiUrl"
              name="apiUrl"
              value={settings.apiUrl}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label htmlFor="socketUrl" className="block text-sm font-medium text-gray-300 mb-2">
              Socket URL
            </label>
            <input
              type="text"
              id="socketUrl"
              name="socketUrl"
              value={settings.socketUrl}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label htmlFor="refreshInterval" className="block text-sm font-medium text-gray-300 mb-2">
              Refresh Interval (ms)
            </label>
            <input
              type="number"
              id="refreshInterval"
              name="refreshInterval"
              min="1000"
              max="60000"
              value={settings.refreshInterval}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label
              htmlFor="plannedProductionTimeHours"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Planned Production Time (hours)
            </label>
            <input
              type="number"
              id="plannedProductionTimeHours"
              name="plannedProductionTimeHours"
              min="0.1"
              step="0.1"
              value={settings.plannedProductionTimeHours}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label
              htmlFor="comparisonLookbackHours"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Default Comparison Window (hours)
            </label>
            <input
              type="number"
              id="comparisonLookbackHours"
              name="comparisonLookbackHours"
              min="1"
              max="168"
              value={settings.comparisonLookbackHours}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Machines and OEE Analytics use this as the default time window.
            </p>
          </div>

          <div>
            <label htmlFor="defaultIdealCycleTimeSeconds" className="block text-sm font-medium text-gray-300 mb-2">
              Default Ideal Cycle Time (seconds)
            </label>
            <input
              type="number"
              id="defaultIdealCycleTimeSeconds"
              name="defaultIdealCycleTimeSeconds"
              min="0.1"
              step="0.1"
              value={settings.defaultIdealCycleTimeSeconds}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label htmlFor="defaultBadPieces" className="block text-sm font-medium text-gray-300 mb-2">
              Default Bad Pieces
            </label>
            <input
              type="number"
              id="defaultBadPieces"
              name="defaultBadPieces"
              min="0"
              value={settings.defaultBadPieces}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Used in calculations when a machine does not have its own manual bad-piece count.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold text-white">Ideal Machine Benchmark</h2>
        <p className="text-sm text-gray-400">
          These values are stored in the database and used as the comparison reference on analytics pages.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="idealMachineId" className="block text-sm font-medium text-gray-300 mb-2">
              Benchmark Machine ID
            </label>
            <input
              type="text"
              id="idealMachineId"
              name="idealMachineId"
              value={settings.idealMachineId}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label htmlFor="idealRuntimeMinutes" className="block text-sm font-medium text-gray-300 mb-2">
              Runtime (minutes)
            </label>
            <input
              type="number"
              id="idealRuntimeMinutes"
              name="idealRuntimeMinutes"
              min="0"
              value={settings.idealRuntimeMinutes}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label htmlFor="idealOee" className="block text-sm font-medium text-gray-300 mb-2">
              OEE (%)
            </label>
            <input
              type="number"
              id="idealOee"
              name="idealOee"
              min="0"
              max="100"
              value={settings.idealOee}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label htmlFor="idealAvailability" className="block text-sm font-medium text-gray-300 mb-2">
              Availability (%)
            </label>
            <input
              type="number"
              id="idealAvailability"
              name="idealAvailability"
              min="0"
              max="100"
              value={settings.idealAvailability}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label htmlFor="idealPerformance" className="block text-sm font-medium text-gray-300 mb-2">
              Performance (%)
            </label>
            <input
              type="number"
              id="idealPerformance"
              name="idealPerformance"
              min="0"
              max="100"
              value={settings.idealPerformance}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label htmlFor="idealQuality" className="block text-sm font-medium text-gray-300 mb-2">
              Quality (%)
            </label>
            <input
              type="number"
              id="idealQuality"
              name="idealQuality"
              min="0"
              max="100"
              value={settings.idealQuality}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label htmlFor="idealTotalPieces" className="block text-sm font-medium text-gray-300 mb-2">
              Total Pieces
            </label>
            <input
              type="number"
              id="idealTotalPieces"
              name="idealTotalPieces"
              min="0"
              value={settings.idealTotalPieces}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label htmlFor="idealGoodPieces" className="block text-sm font-medium text-gray-300 mb-2">
              Good Pieces
            </label>
            <input
              type="number"
              id="idealGoodPieces"
              name="idealGoodPieces"
              min="0"
              value={settings.idealGoodPieces}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label htmlFor="idealDefectivePieces" className="block text-sm font-medium text-gray-300 mb-2">
              Defective Pieces
            </label>
            <input
              type="number"
              id="idealDefectivePieces"
              name="idealDefectivePieces"
              min="0"
              value={settings.idealDefectivePieces}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
        >
          Save Settings
        </button>
        <button
          onClick={handleResetDefaults}
          className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
