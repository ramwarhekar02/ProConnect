import { useEffect, useState } from 'react';

import { machineService } from '../services/apiService';
import socketService from '../services/socketService';
import { isMachineOnlineStatus } from '../utils/helpers';

export const useMachineConnectionStatus = () => {
  const [machines, setMachines] = useState([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let isMounted = true;

    const updateFromMachines = (nextMachines) => {
      if (!isMounted) {
        return;
      }

      setMachines(nextMachines);
    };

    const fetchMachines = async () => {
      try {
        const response = await machineService.getAllMachines();
        updateFromMachines(response?.data?.machines || []);
      } catch (error) {
        console.error('Failed to fetch machine connection status:', error);
        if (isMounted) {
          setMachines([]);
        }
      }
    };

    const handleMachineStatus = (machine) => {
      if (!isMounted) {
        return;
      }

      setMachines((prevMachines) => {
        const index = prevMachines.findIndex((item) => item.machineId === machine.machineId);

        if (index === -1) {
          return [...prevMachines, machine];
        }

        const nextMachines = [...prevMachines];
        nextMachines[index] = { ...nextMachines[index], ...machine };
        return nextMachines;
      });
      setNow(Date.now());
    };

    fetchMachines();
    socketService.connect();
    socketService.onAllMachineStatus(handleMachineStatus);

    const intervalId = window.setInterval(() => {
      if (isMounted) {
        setNow(Date.now());
      }
    }, 1000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      socketService.offAllMachineStatus(handleMachineStatus);
    };
  }, []);

  const hasOnlineMachine = machines.some((machine) => isMachineOnlineStatus(machine, now));

  return { hasOnlineMachine };
};
