import mqtt from 'mqtt';

import Machine from '../models/Machine.js';
import ProductionData from '../models/ProductionData.js';
import appSettingsService from './AppSettingsService.js';
import OEECalculationService from './OEECalculationService.js';
import SensorAggregationService from './SensorAggregationService.js';

class MQTTIngestionService {
  constructor({ socketHandlers }) {
    this.socketHandlers = socketHandlers;
    this.client = null;
    this.topic = process.env.MQTT_TOPIC || 'esp32/sensors';
    this.defaultMachineId = (process.env.MQTT_MACHINE_ID || 'KM-001').toUpperCase();
    this.idealCycleTimeSeconds = Number(process.env.OEE_IDEAL_CYCLE_TIME_SECONDS || 1);
    this.storeIdleWindows = (process.env.MQTT_STORE_IDLE_WINDOWS || 'true') === 'true';
    this.aggregator = new SensorAggregationService({
      windowSeconds: process.env.MQTT_AGGREGATION_WINDOW_SECONDS || 60,
      maxDeltaSeconds: process.env.MQTT_MAX_DELTA_SECONDS || 10,
    });
  }

  async initialize() {
    await this.aggregator.initializeFromPersistence();
  }

  static safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  static resolveMachineStatus(sample) {
    const signals = [sample?.vibration, sample?.hall, sample?.ir].map((value) =>
      SensorAggregationService.normalizeSignal(value)
    );
    return signals.some((value) => value === 1) ? 'running' : 'idle';
  }

  static normalizeRawPayload(rawPayload) {
    if (typeof rawPayload !== 'string') {
      return '';
    }

    const trimmedPayload = rawPayload.trim();
    const firstBraceIndex = trimmedPayload.indexOf('{');
    const lastBraceIndex = trimmedPayload.lastIndexOf('}');

    if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
      return trimmedPayload.slice(firstBraceIndex, lastBraceIndex + 1);
    }

    return trimmedPayload;
  }

  async upsertMachine(machineId, status, timestamp) {
    const machine = await Machine.findOneAndUpdate(
      { machineId },
      {
        machineId,
        status,
        lastHeartbeat: timestamp,
        isActive: true,
        $setOnInsert: { location: 'Auto-registered (MQTT)' },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    if (machine && this.socketHandlers?.broadcastMachineStatus) {
      this.socketHandlers.broadcastMachineStatus(machine);
    }

    return machine;
  }

  resolvePayload(rawPayload) {
    const normalizedPayload = MQTTIngestionService.normalizeRawPayload(rawPayload);
    const payload = MQTTIngestionService.safeJsonParse(normalizedPayload);
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    return {
      machineId: String(payload.machineId || this.defaultMachineId).toUpperCase(),
      timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      sample: {
        ir: payload.IR ?? payload.ir ?? 0,
        vibration: payload.Vibration ?? payload.vibration ?? 0,
        hall: payload.Hall ?? payload.hall ?? 0,
      },
    };
  }

  broadcastRawMessage(machineId, rawPayload, parsedPayload, timestamp) {
    if (!this.socketHandlers?.broadcastMachineLog) {
      return;
    }

    this.socketHandlers.broadcastMachineLog({
      machineId,
      timestamp,
      rawPayload,
      parsedPayload,
    });
  }

  async processMessage(rawPayload) {
    const parsed = this.resolvePayload(rawPayload);
    if (!parsed) {
      console.warn('[MQTT] Ignoring invalid JSON payload');
      return;
    }

    const existingMachine = await Machine.findOne({ machineId: parsed.machineId }).lean();
    if (existingMachine?.powerState === 'off') {
      return;
    }

    this.broadcastRawMessage(
      parsed.machineId,
      rawPayload,
      {
        machineId: parsed.machineId,
        timestamp: parsed.timestamp,
        ...parsed.sample,
      },
      parsed.timestamp
    );

    const machineStatus = MQTTIngestionService.resolveMachineStatus(parsed.sample);
    const machine = await this.upsertMachine(parsed.machineId, machineStatus, parsed.timestamp);
    const effectiveIdealCycleTimeSeconds =
      appSettingsService.getSettings(this.aggregator.windowSeconds).defaultIdealCycleTimeSeconds ||
      this.idealCycleTimeSeconds;

    const aggregated = await this.aggregator.ingest(parsed.machineId, parsed.sample, parsed.timestamp, {
      plannedProductionTimeSeconds: appSettingsService.getPlannedProductionTimeSeconds(
        this.aggregator.windowSeconds
      ),
    });
    if (!aggregated) {
      return;
    }

    const oeeMetrics = OEECalculationService.calculateOEE({
      totalPieces: aggregated.totalPieces,
      defectivePieces: aggregated.defectivePieces,
      runtimeSeconds: aggregated.runtimeSeconds,
      plannedProductionTimeSeconds: aggregated.plannedProductionTimeSeconds,
      idealCycleTimeSeconds: effectiveIdealCycleTimeSeconds,
      observedCycleTimeSeconds: aggregated.observedCycleTimeSeconds,
    });

    const productionData = await ProductionData.create({
      machineId: aggregated.machineId,
      totalPieces: aggregated.totalPieces,
      defectivePieces: aggregated.defectivePieces,
      runtimeSeconds: aggregated.runtimeSeconds,
      downtimeSeconds: aggregated.downtimeSeconds,
      plannedProductionTimeSeconds: aggregated.plannedProductionTimeSeconds,
      idealCycleTimeSeconds: effectiveIdealCycleTimeSeconds,
      timestamp: aggregated.timestamp,
    });

    if (this.socketHandlers?.broadcastProductionData) {
      this.socketHandlers.broadcastProductionData(productionData, oeeMetrics);
    }
  }

  start() {
    const enabled = (process.env.MQTT_ENABLED || 'false') === 'true';
    if (!enabled) {
      console.log('[MQTT] Ingestion disabled (MQTT_ENABLED=false)');
      return;
    }

    const host = process.env.MQTT_HOST;
    const port = parseInt(process.env.MQTT_PORT || '8883', 10);
    const username = process.env.MQTT_USERNAME;
    const password = process.env.MQTT_PASSWORD;

    if (!host || !username || !password) {
      console.warn('[MQTT] Missing MQTT_HOST/MQTT_USERNAME/MQTT_PASSWORD. Ingestion not started.');
      return;
    }

    const rejectUnauthorized = (process.env.MQTT_TLS_REJECT_UNAUTHORIZED || 'true') !== 'false';
    const clientId = process.env.MQTT_CLIENT_ID || `oee-backend-${Math.random().toString(16).slice(2)}`;

    this.client = mqtt.connect({
      protocol: 'mqtts',
      host,
      port,
      username,
      password,
      clientId,
      reconnectPeriod: 5000,
      clean: true,
      rejectUnauthorized,
    });

    this.client.on('connect', () => {
      console.log(`[MQTT] Connected to ${host}:${port}`);
      this.client.subscribe(this.topic, { qos: 1 }, (error) => {
        if (error) {
          console.error(`[MQTT] Subscribe failed for topic "${this.topic}":`, error.message);
          return;
        }
        console.log(`[MQTT] Subscribed to topic "${this.topic}"`);
      });
    });

    this.client.on('message', async (_topic, messageBuffer) => {
      try {
        await this.processMessage(messageBuffer.toString('utf8'));
      } catch (error) {
        console.error('[MQTT] Failed to process message:', error);
      }
    });

    this.client.on('reconnect', () => {
      console.log('[MQTT] Reconnecting...');
    });

    this.client.on('offline', () => {
      console.warn('[MQTT] Client went offline');
    });

    this.client.on('close', () => {
      console.warn('[MQTT] Connection closed');
    });

    this.client.on('end', () => {
      console.log('[MQTT] Client session ended');
    });

    this.client.on('error', (error) => {
      console.error('[MQTT] Client error:', error.message);
    });
  }

  stop() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
      console.log('[MQTT] Client disconnected');
    }

    return this.aggregator.persistAllStates();
  }
}

export default MQTTIngestionService;
