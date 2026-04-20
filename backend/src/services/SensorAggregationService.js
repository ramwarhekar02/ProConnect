import AggregationState from '../models/AggregationState.js';

class SensorAggregationService {
  constructor(options = {}) {
    this.windowSeconds = Math.max(1, parseInt(options.windowSeconds, 10) || 60);
    this.maxDeltaSeconds = Math.max(1, parseInt(options.maxDeltaSeconds, 10) || 10);
    this.minPulseIntervalSeconds = Math.max(
      1,
      parseFloat(options.minPulseIntervalSeconds || options.sustainedHighPieceIntervalSeconds) || 1
    );
    this.machineStates = new Map();
  }

  static normalizeSignal(value) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value > 0 ? 1 : 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'high', 'on'].includes(normalized)) return 1;
    }
    return 0;
  }

  getMachineState(machineId, timestampMs) {
    if (!this.machineStates.has(machineId)) {
      this.machineStates.set(machineId, {
        windowStartMs: timestampMs,
        lastTimestampMs: timestampMs,
        lastHall: 0,
        lastIr: 0,
        lastVibration: 0,
        lastPieceCountedAtMs: null,
        lastDefectCountedAtMs: null,
        totalPieces: 0,
        // Defective pieces are now provided manually per machine from the edit form.
        defectivePieces: 0,
        runtimeSeconds: 0,
      });
    }

    return this.machineStates.get(machineId);
  }

  static createSerializableState(machineId, state) {
    return {
      machineId,
      windowStartMs: state.windowStartMs,
      lastTimestampMs: state.lastTimestampMs,
      lastHall: state.lastHall,
      lastIr: state.lastIr,
      lastVibration: state.lastVibration,
      lastPieceCountedAtMs: state.lastPieceCountedAtMs,
      lastDefectCountedAtMs: state.lastDefectCountedAtMs,
      totalPieces: state.totalPieces,
      defectivePieces: state.defectivePieces,
      runtimeSeconds: state.runtimeSeconds,
    };
  }

  async initializeFromPersistence() {
    const persistedStates = await AggregationState.find({}).lean();

    persistedStates.forEach((state) => {
      this.machineStates.set(state.machineId, {
        windowStartMs: state.windowStartMs,
        lastTimestampMs: state.lastTimestampMs,
        lastHall: state.lastHall,
        lastIr: state.lastIr,
        lastVibration: state.lastVibration,
        lastPieceCountedAtMs: state.lastPieceCountedAtMs,
        lastDefectCountedAtMs: state.lastDefectCountedAtMs,
        totalPieces: state.totalPieces,
        defectivePieces: 0,
        runtimeSeconds: state.runtimeSeconds,
      });
    });
  }

  async persistMachineState(machineId) {
    const state = this.machineStates.get(machineId);
    if (!state) {
      await AggregationState.deleteOne({ machineId });
      return;
    }

    await AggregationState.findOneAndUpdate(
      { machineId },
      SensorAggregationService.createSerializableState(machineId, state),
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  }

  async persistAllStates() {
    const machineIds = [...this.machineStates.keys()];
    await Promise.all(machineIds.map((machineId) => this.persistMachineState(machineId)));
  }

  shouldCountPulse(lastSignal, currentSignal, lastCountedAtMs, timestampMs) {
    if (currentSignal !== 1 || lastSignal === 1) {
      return false;
    }

    if (lastCountedAtMs === null) {
      return true;
    }

    return timestampMs - lastCountedAtMs >= this.minPulseIntervalSeconds * 1000;
  }

  async ingest(machineId, sample, timestamp = new Date(), options = {}) {
    const timestampMs = new Date(timestamp).getTime();
    const state = this.getMachineState(machineId, timestampMs);

    const hall = SensorAggregationService.normalizeSignal(sample.hall);
    const ir = SensorAggregationService.normalizeSignal(sample.ir);
    const vibration = SensorAggregationService.normalizeSignal(sample.vibration);

    const rawDeltaSeconds = Math.max(0, (timestampMs - state.lastTimestampMs) / 1000);
    const deltaSeconds = Math.min(rawDeltaSeconds, this.maxDeltaSeconds);

    // Count runtime only from vibration activity.
    if (state.lastVibration === 1) {
      state.runtimeSeconds += deltaSeconds;
    }

    if (
      this.shouldCountPulse(
        state.lastIr,
        ir,
        state.lastPieceCountedAtMs,
        timestampMs
      )
    ) {
      state.totalPieces += 1;
      state.lastPieceCountedAtMs = timestampMs;
    }

    state.lastHall = hall;
    state.lastIr = ir;
    state.lastVibration = vibration;
    state.lastTimestampMs = timestampMs;

    const elapsedSeconds = (timestampMs - state.windowStartMs) / 1000;
    if (elapsedSeconds < this.windowSeconds) {
      await this.persistMachineState(machineId);
      return null;
    }

    const plannedProductionTimeSeconds = Math.max(
      1,
      parseInt(options.plannedProductionTimeSeconds, 10) || this.windowSeconds
    );
    const runtimeSeconds = Math.min(plannedProductionTimeSeconds, Math.max(0, state.runtimeSeconds));
    const downtimeSeconds = Math.max(0, plannedProductionTimeSeconds - runtimeSeconds);
    const totalPieces = Math.max(0, state.totalPieces);
    const defectivePieces = 0;
    const observedCycleTimeSeconds =
      totalPieces > 0 && runtimeSeconds > 0 ? runtimeSeconds / totalPieces : null;

    const snapshot = {
      machineId,
      timestamp: new Date(timestampMs),
      totalPieces,
      defectivePieces,
      runtimeSeconds: Number(runtimeSeconds.toFixed(2)),
      downtimeSeconds: Number(downtimeSeconds.toFixed(2)),
      plannedProductionTimeSeconds,
      observedCycleTimeSeconds:
        observedCycleTimeSeconds === null ? null : Number(observedCycleTimeSeconds.toFixed(2)),
      vibration,
    };

    this.machineStates.set(machineId, {
      windowStartMs: timestampMs,
      lastTimestampMs: timestampMs,
      lastHall: hall,
      lastIr: ir,
      lastVibration: vibration,
      lastPieceCountedAtMs: ir === 1 ? timestampMs : null,
      lastDefectCountedAtMs: null,
      totalPieces: 0,
      defectivePieces: 0,
      runtimeSeconds: 0,
    });

    await this.persistMachineState(machineId);

    return snapshot;
  }
}

export default SensorAggregationService;
