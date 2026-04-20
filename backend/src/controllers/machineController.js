import Machine from '../models/Machine.js';

const MAX_MACHINE_IMAGE_BYTES = 100 * 1024;
const MAX_MACHINE_IMAGE_DATA_URL_LENGTH = Math.ceil((MAX_MACHINE_IMAGE_BYTES * 4) / 3) + 256;
const DEFAULT_MACHINE_IDEAL_CYCLE_TIME_SECONDS = 1;
const DEFAULT_MACHINE_MANUAL_DEFECTIVE_PIECES = 0;

const hydrateMachineDefaults = async (machine) => {
  if (!machine) {
    return machine;
  }

  let updated = false;

  if (machine.idealCycleTimeSeconds === undefined || machine.idealCycleTimeSeconds === null) {
    machine.idealCycleTimeSeconds = DEFAULT_MACHINE_IDEAL_CYCLE_TIME_SECONDS;
    updated = true;
  }

  if (machine.manualDefectivePieces === undefined || machine.manualDefectivePieces === null) {
    machine.manualDefectivePieces = DEFAULT_MACHINE_MANUAL_DEFECTIVE_PIECES;
    updated = true;
  }

  if (updated) {
    await machine.save();
  }

  return machine;
};

const backfillMissingMachineFields = async () => {
  await Promise.all([
    Machine.updateMany(
      { idealCycleTimeSeconds: { $exists: false } },
      { $set: { idealCycleTimeSeconds: DEFAULT_MACHINE_IDEAL_CYCLE_TIME_SECONDS } }
    ),
    Machine.updateMany(
      { manualDefectivePieces: { $exists: false } },
      { $set: { manualDefectivePieces: DEFAULT_MACHINE_MANUAL_DEFECTIVE_PIECES } }
    ),
  ]);
};

export const getAllMachines = async (req, res, next) => {
  try {
    await backfillMissingMachineFields();
    const machines = await Machine.find().sort({ createdAt: -1 });
    await Promise.all(machines.map((machine) => hydrateMachineDefaults(machine)));

    res.status(200).json({
      success: true,
      count: machines.length,
      machines,
    });
  } catch (error) {
    next(error);
  }
};

export const getMachineById = async (req, res, next) => {
  try {
    const { machineId } = req.params;
    await backfillMissingMachineFields();

    const machine = await Machine.findOne({ machineId: machineId.toUpperCase() });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found.',
      });
    }

    await hydrateMachineDefaults(machine);

    res.status(200).json({
      success: true,
      machine,
    });
  } catch (error) {
    next(error);
  }
};

const parseManualDefectivePieces = (value) => {
  if (value === undefined) {
    return undefined;
  }

  const parsedValue = Number(value);
  if (Number.isNaN(parsedValue) || parsedValue < 0) {
    throw new Error('manualDefectivePieces must be a non-negative number.');
  }

  return parsedValue;
};

export const createMachine = async (req, res, next) => {
  try {
    const { machineId, location, idealCycleTimeSeconds } = req.body;
    const manualDefectivePieces = parseManualDefectivePieces(req.body.manualDefectivePieces);

    if (!machineId || !location) {
      return res.status(400).json({
        success: false,
        message: 'machineId and location are required.',
      });
    }

    // Check if machine already exists
    const existingMachine = await Machine.findOne({ machineId: machineId.toUpperCase() });

    if (existingMachine) {
      return res.status(409).json({
        success: false,
        message: 'Machine with this ID already exists.',
      });
    }

    const machine = new Machine({
      machineId: machineId.toUpperCase(),
      location,
      idealCycleTimeSeconds:
        typeof idealCycleTimeSeconds === 'number' && idealCycleTimeSeconds > 0
          ? idealCycleTimeSeconds
          : 1,
      manualDefectivePieces: manualDefectivePieces ?? 0,
      status: 'disconnected',
    });

    await machine.save();

    res.status(201).json({
      success: true,
      message: 'Machine created successfully.',
      machine,
    });
  } catch (error) {
    if (error.message === 'manualDefectivePieces must be a non-negative number.') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
};

export const updateMachine = async (req, res, next) => {
  try {
    const { machineId } = req.params;
    await backfillMissingMachineFields();
    const {
      status,
      location,
      isActive,
      machineImage,
      removeImage,
      powerState,
      idealCycleTimeSeconds,
      manualDefectivePieces,
    } = req.body;

    const machine = await Machine.findOne({ machineId: machineId.toUpperCase() });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found.',
      });
    }

    await hydrateMachineDefaults(machine);

    if (status) machine.status = status;
    if (location) machine.location = location;
    if (typeof isActive === 'boolean') machine.isActive = isActive;
    if (typeof idealCycleTimeSeconds === 'number') {
      if (Number.isNaN(idealCycleTimeSeconds) || idealCycleTimeSeconds <= 0) {
        return res.status(400).json({
          success: false,
          message: 'idealCycleTimeSeconds must be a positive number.',
        });
      }

      machine.idealCycleTimeSeconds = idealCycleTimeSeconds;
    }
    if (manualDefectivePieces !== undefined) {
      const parsedManualDefectivePieces = parseManualDefectivePieces(manualDefectivePieces);
      machine.manualDefectivePieces = Math.max(
        0,
        Number(machine.manualDefectivePieces || 0) + parsedManualDefectivePieces
      );
    }
    if (powerState) {
      if (!['on', 'off'].includes(powerState)) {
        return res.status(400).json({
          success: false,
          message: 'powerState must be either "on" or "off".',
        });
      }

      machine.powerState = powerState;
      machine.powerUpdatedAt = new Date();

      if (powerState === 'off') {
        machine.status = 'disconnected';
        machine.isActive = false;
      } else {
        machine.isActive = true;
        if (machine.status === 'disconnected') {
          machine.status = 'idle';
        }
      }
    }
    if (removeImage === true) {
      machine.machineImage = {
        dataUrl: null,
        mimeType: null,
        uploadedAt: null,
      };
    }
    if (machineImage) {
      if (
        typeof machineImage !== 'object' ||
        typeof machineImage.dataUrl !== 'string' ||
        typeof machineImage.mimeType !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          message: 'machineImage must include dataUrl and mimeType.',
        });
      }

      if (machineImage.dataUrl.length > MAX_MACHINE_IMAGE_DATA_URL_LENGTH) {
        return res.status(400).json({
          success: false,
          message: 'Machine image is too large. Please upload an image under 100KB.',
        });
      }

      machine.machineImage = {
        dataUrl: machineImage.dataUrl,
        mimeType: machineImage.mimeType,
        uploadedAt: new Date(),
      };
    }

    await machine.save();

    res.status(200).json({
      success: true,
      message: 'Machine updated successfully.',
      machine,
    });
  } catch (error) {
    if (error.message === 'manualDefectivePieces must be a non-negative number.') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
};

export const deleteMachine = async (req, res, next) => {
  try {
    const { machineId } = req.params;

    const machine = await Machine.findOneAndDelete({ machineId: machineId.toUpperCase() });

    if (!machine) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Machine deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export const recordHeartbeat = async (req, res, next) => {
  try {
    const { machineId } = req.params;
    const { status } = req.body;

    let machine = await Machine.findOne({ machineId: machineId.toUpperCase() });

    if (!machine) {
      // Create machine if it doesn't exist (Raspberry Pi auto-registration)
      machine = new Machine({
        machineId: machineId.toUpperCase(),
        status: status || 'idle',
        powerState: 'on',
        lastHeartbeat: new Date(),
        location: 'Unknown',
        idealCycleTimeSeconds: 1,
        manualDefectivePieces: 0,
      });
    } else {
      machine.lastHeartbeat = new Date();
      if (status) machine.status = status;
    }

    await machine.save();

    res.status(200).json({
      success: true,
      message: 'Heartbeat recorded successfully.',
      machine,
    });
  } catch (error) {
    next(error);
  }
};
