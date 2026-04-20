import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export const socketService = {
  connect: () => {
    if (!socket) {
      socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      socket.on('connect', () => {
        console.log('WebSocket connected');
      });

      socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
      });
    }
    return socket;
  },

  disconnect: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  joinMachine: (machineId) => {
    if (socket) {
      socket.emit('join-machine', machineId);
    }
  },

  leaveMachine: (machineId) => {
    if (socket) {
      socket.emit('leave-machine', machineId);
    }
  },

  onProductionUpdate: (callback) => {
    if (socket) {
      socket.on('production-update', callback);
    }
  },

  onAllProductionUpdate: (callback) => {
    if (socket) {
      socket.on('all-production-update', callback);
    }
  },

  onMachineStatus: (callback) => {
    if (socket) {
      socket.on('machine-status', callback);
    }
  },

  onAllMachineStatus: (callback) => {
    if (socket) {
      socket.on('all-machine-status', callback);
    }
  },

  onMachineLog: (callback) => {
    if (socket) {
      socket.on('machine-log', callback);
    }
  },

  onAllMachineLog: (callback) => {
    if (socket) {
      socket.on('all-machine-log', callback);
    }
  },

  offProductionUpdate: (callback) => {
    if (socket) {
      socket.off('production-update', callback);
    }
  },

  offAllProductionUpdate: (callback) => {
    if (socket) {
      socket.off('all-production-update', callback);
    }
  },

  offMachineStatus: (callback) => {
    if (socket) {
      socket.off('machine-status', callback);
    }
  },

  offAllMachineStatus: (callback) => {
    if (socket) {
      socket.off('all-machine-status', callback);
    }
  },

  offMachineLog: (callback) => {
    if (socket) {
      socket.off('machine-log', callback);
    }
  },

  offAllMachineLog: (callback) => {
    if (socket) {
      socket.off('all-machine-log', callback);
    }
  },

  getSocket: () => socket,
};

export default socketService;
