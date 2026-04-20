import Machine from '../models/Machine.js';

export const initializeSocket = (io) => {
  const heartbeatTimeouts = new Map();
  const HEARTBEAT_TIMEOUT = parseInt(process.env.MACHINE_HEARTBEAT_TIMEOUT) || 10000;

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Handle client disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Join machine room for specific machine updates
    socket.on('join-machine', (machineId) => {
      socket.join(`machine:${machineId}`);
      console.log(`Client ${socket.id} joined room: machine:${machineId}`);
    });

    // Leave machine room
    socket.on('leave-machine', (machineId) => {
      socket.leave(`machine:${machineId}`);
      console.log(`Client ${socket.id} left room: machine:${machineId}`);
    });
  });

  // Function to broadcast production data
  const broadcastProductionData = (data, oeeMetrics) => {
    io.to(`machine:${data.machineId}`).emit('production-update', {
      machineId: data.machineId,
      data,
      oeeMetrics,
      timestamp: new Date(),
    });

    // Broadcast to dashboard
    io.emit('all-production-update', {
      machineId: data.machineId,
      data,
      oeeMetrics,
      timestamp: new Date(),
    });
  };

  // Function to broadcast machine status
  const broadcastMachineStatus = (machine) => {
    io.to(`machine:${machine.machineId}`).emit('machine-status', machine);
    io.emit('all-machine-status', machine);
  };

  // Function to broadcast raw MQTT logs
  const broadcastMachineLog = (logEntry) => {
    io.to(`machine:${logEntry.machineId}`).emit('machine-log', logEntry);
    io.emit('all-machine-log', logEntry);
  };

  // Function to set machine heartbeat timeout
  const setMachineHeartbeatTimeout = async (machineId) => {
    // Clear existing timeout
    if (heartbeatTimeouts.has(machineId)) {
      clearTimeout(heartbeatTimeouts.get(machineId));
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      try {
        // Mark machine as disconnected
        const machine = await Machine.findOneAndUpdate(
          { machineId },
          { status: 'disconnected', isActive: false },
          { new: true }
        );

        if (machine) {
          console.log(`Machine ${machineId} marked as disconnected`);
          broadcastMachineStatus(machine);
        }

        heartbeatTimeouts.delete(machineId);
      } catch (error) {
        console.error(`Error marking machine ${machineId} as disconnected:`, error);
      }
    }, HEARTBEAT_TIMEOUT);

    heartbeatTimeouts.set(machineId, timeout);
  };

  // Function to record machine heartbeat
  const recordMachineHeartbeat = async (machineId, status) => {
    try {
      const machine = await Machine.findOneAndUpdate(
        { machineId },
        {
          lastHeartbeat: new Date(),
          status: status || 'idle',
          isActive: true,
        },
        { new: true, upsert: true }
      );

      // Set/reset heartbeat timeout
      setMachineHeartbeatTimeout(machineId);

      return machine;
    } catch (error) {
      console.error(`Error recording heartbeat for ${machineId}:`, error);
      return null;
    }
  };

  return {
    broadcastProductionData,
    broadcastMachineStatus,
    broadcastMachineLog,
    recordMachineHeartbeat,
    setMachineHeartbeatTimeout,
  };
};
