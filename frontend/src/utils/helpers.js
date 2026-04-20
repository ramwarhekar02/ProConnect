export const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (seconds) => {
  if (!seconds) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
};

export const getOEEStatus = (oeeValue) => {
  if (oeeValue >= 85) return { status: 'Excellent', color: 'text-green-500', bg: 'bg-green-900' };
  if (oeeValue >= 70) return { status: 'Good', color: 'text-blue-500', bg: 'bg-blue-900' };
  if (oeeValue >= 50) return { status: 'Fair', color: 'text-yellow-500', bg: 'bg-yellow-900' };
  return { status: 'Poor', color: 'text-red-500', bg: 'bg-red-900' };
};

export const getMachineStatusColor = (status) => {
  switch (status) {
    case 'running':
      return { bg: 'bg-green-600', text: 'text-green-100' };
    case 'stopped':
      return { bg: 'bg-red-600', text: 'text-red-100' };
    case 'idle':
      return { bg: 'bg-blue-600', text: 'text-blue-100' };
    case 'down':
      return { bg: 'bg-red-600', text: 'text-red-100' };
    case 'disconnected':
      return { bg: 'bg-gray-600', text: 'text-gray-100' };
    default:
      return { bg: 'bg-gray-600', text: 'text-gray-100' };
  }
};

export const roundToTwo = (num) => {
  return Math.round(num * 100) / 100;
};

export const MACHINE_HEARTBEAT_TIMEOUT_MS = 7000;

export const isTimeoutDetected = (lastHeartbeat, timeoutMs = MACHINE_HEARTBEAT_TIMEOUT_MS, now = Date.now()) => {
  if (!lastHeartbeat) return true;
  const timeDiff = now - new Date(lastHeartbeat).getTime();
  return timeDiff > timeoutMs;
};

export const isMachineOnlineStatus = (machine, now = Date.now()) => {
  if (!machine) return false;

  return (
    machine.isActive !== false &&
    machine.powerState !== 'off' &&
    machine.status !== 'disconnected' &&
    !isTimeoutDetected(machine.lastHeartbeat, MACHINE_HEARTBEAT_TIMEOUT_MS, now)
  );
};

export const getLiveMachineStatus = (machine, now = Date.now()) => {
  if (!machine) return 'stopped';

  return isMachineOnlineStatus(machine, now) ? 'running' : 'stopped';
};

export const normalizeDisplayedStatus = (status) => {
  return status === 'running' ? 'running' : 'stopped';
};
