import React, { useEffect, useState } from 'react';
import { machineService, productionService } from '../../services/apiService';
import { formatDate, formatTime } from '../../utils/helpers';

const REPORT_LOOKBACK_HOURS = 24;

const DEFAULT_SUMMARY = {
  totalRuntimeSeconds: 0,
  totalDowntimeSeconds: 0,
  totalPlannedProductionTimeSeconds: 0,
  totalPieces: 0,
  defectivePieces: 0,
  goodPieces: 0,
  oee: 0,
  availability: 0,
  performance: 0,
  quality: 0,
};

export const ReportsPage = () => {
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMachines();
  }, []);

  useEffect(() => {
    if (selectedMachine) {
      fetchReportData();
    }
  }, [selectedMachine]);

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const response = await machineService.getAllMachines();
      const activeMachines = response.data.machines.filter((machine) => machine.isActive);
      setMachines(activeMachines);

      if (activeMachines.length > 0) {
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

  const fetchReportData = async () => {
    if (!selectedMachine) return;

    try {
      setLoading(true);
      const [rowsResponse, metricsResponse] = await Promise.all([
        productionService.getProductionByMachine(selectedMachine.machineId, { limit: 100 }),
        productionService.getOEEMetrics(selectedMachine.machineId, REPORT_LOOKBACK_HOURS),
      ]);

      setReportData(rowsResponse?.data?.data || []);
      setSummary(metricsResponse?.data?.summary || DEFAULT_SUMMARY);
      setError('');
    } catch (err) {
      setError('Failed to fetch report data');
      setReportData([]);
      setSummary(DEFAULT_SUMMARY);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (reportData.length === 0 || !selectedMachine) return;

    const headers = [
      'Timestamp',
      'Total Pieces',
      'Good Pieces',
      'Defective Pieces',
      'Runtime (seconds)',
      'Downtime (seconds)',
      'Planned Time (seconds)',
    ];

    const rows = reportData.map((row) => [
      formatDate(row.timestamp),
      row.totalPieces || 0,
      Math.max(0, (row.totalPieces || 0) - (row.defectivePieces || 0)),
      row.defectivePieces || 0,
      row.runtimeSeconds || 0,
      row.downtimeSeconds || 0,
      row.plannedProductionTimeSeconds || 0,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `report-${selectedMachine.machineId}-${new Date().toISOString().split('T')[0]}.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(error || !selectedMachine) && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
          <p className="font-bold">Warning</p>
          <p>{error || 'No machines available. Please add machines to view reports.'}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-sm text-gray-400">
            {selectedMachine ? `${selectedMachine.machineId} • Last 24 hours` : 'No machine selected'}
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <button
            onClick={handleDownloadCSV}
            disabled={reportData.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 text-white px-4 py-2 rounded-lg"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
          <p className="text-sm text-gray-400">Total Pieces</p>
          <p className="text-3xl font-bold text-white mt-2">{summary.totalPieces || 0}</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
          <p className="text-sm text-gray-400">Good Pieces</p>
          <p className="text-3xl font-bold text-green-400 mt-2">{summary.goodPieces || 0}</p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
          <p className="text-sm text-gray-400">Runtime</p>
          <p className="text-3xl font-bold text-blue-400 mt-2">
            {formatTime(summary.totalRuntimeSeconds || 0)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
          <p className="text-sm text-gray-400">Downtime</p>
          <p className="text-3xl font-bold text-yellow-400 mt-2">
            {formatTime(summary.totalDowntimeSeconds || 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-5 text-white">
          <p className="text-sm opacity-90">OEE</p>
          <p className="text-3xl font-bold mt-2">{Math.round(summary.oee || 0)}%</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-5 text-white">
          <p className="text-sm opacity-90">Availability</p>
          <p className="text-3xl font-bold mt-2">{Math.round(summary.availability || 0)}%</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-5 text-white">
          <p className="text-sm opacity-90">Performance</p>
          <p className="text-3xl font-bold mt-2">{Math.round(summary.performance || 0)}%</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-5 text-white">
          <p className="text-sm opacity-90">Quality</p>
          <p className="text-3xl font-bold mt-2">{Math.round(summary.quality || 0)}%</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full bg-gray-800 overflow-hidden">
          <thead className="bg-gray-900 border-b border-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-sm text-gray-300">Timestamp</th>
              <th className="px-6 py-3 text-left text-sm text-gray-300">Total Pieces</th>
              <th className="px-6 py-3 text-left text-sm text-gray-300">Good Pieces</th>
              <th className="px-6 py-3 text-left text-sm text-gray-300">Defective Pieces</th>
              <th className="px-6 py-3 text-left text-sm text-gray-300">Runtime</th>
              <th className="px-6 py-3 text-left text-sm text-gray-300">Downtime</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row) => (
              <tr key={row._id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="px-6 py-4 text-sm text-gray-200">{formatDate(row.timestamp)}</td>
                <td className="px-6 py-4 text-sm text-white">{row.totalPieces || 0}</td>
                <td className="px-6 py-4 text-sm text-green-400">
                  {Math.max(0, (row.totalPieces || 0) - (row.defectivePieces || 0))}
                </td>
                <td className="px-6 py-4 text-sm text-red-400">{row.defectivePieces || 0}</td>
                <td className="px-6 py-4 text-sm text-blue-300">{formatTime(row.runtimeSeconds || 0)}</td>
                <td className="px-6 py-4 text-sm text-yellow-300">
                  {formatTime(row.downtimeSeconds || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reportData.length === 0 && (
        <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
          <p className="text-gray-400">No production data found for this machine yet.</p>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
