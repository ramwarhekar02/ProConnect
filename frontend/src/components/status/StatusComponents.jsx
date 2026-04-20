import React from 'react';
import {
  getLiveMachineStatus,
  getMachineStatusColor,
  normalizeDisplayedStatus,
} from '../../utils/helpers';

export const MachineStatusBadge = ({ status, machine, now }) => {
  const resolvedStatus = machine
    ? getLiveMachineStatus(machine, now)
    : normalizeDisplayedStatus(status);
  const { bg, text } = getMachineStatusColor(resolvedStatus);

  return (
    <span className={`${bg} ${text} px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-2`}>
      <span className="w-2 h-2 rounded-full bg-current"></span>
      {resolvedStatus.charAt(0).toUpperCase() + resolvedStatus.slice(1)}
    </span>
  );
};

export const ConnectionStatus = ({ isConnected, compact = false }) => {
  return (
    <div className={`flex items-center gap-2 ${compact ? 'justify-center' : ''}`}>
      <div
        className={`w-3 h-3 rounded-full ${
          isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`}
      ></div>
      {!compact && (
        <span
          className={`text-sm font-medium ${
            isConnected ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {isConnected ? 'Connected' : 'Offline'}
        </span>
      )}
    </div>
  );
};

export const DeviceNotConnected = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg border border-gray-700">
      <div className="text-red-500 text-4xl mb-4">🔴</div>
      <h3 className="text-lg font-semibold text-gray-100 mb-2">Device Not Connected</h3>
      <p className="text-gray-400 text-center">
        No data received from this machine in the last 10 seconds.
      </p>
    </div>
  );
};
