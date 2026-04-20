import express from 'express';
import {
  getAllMachines,
  getMachineById,
  createMachine,
  updateMachine,
  deleteMachine,
  recordHeartbeat,
} from '../controllers/machineController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// All machine routes are protected
router.get('/', authMiddleware, getAllMachines);
router.get('/:machineId', authMiddleware, getMachineById);
router.post('/', authMiddleware, createMachine);
router.put('/:machineId', authMiddleware, updateMachine);
router.delete('/:machineId', authMiddleware, deleteMachine);

// Heartbeat endpoint (public for Raspberry Pi devices)
router.post('/:machineId/heartbeat', recordHeartbeat);

export default router;
