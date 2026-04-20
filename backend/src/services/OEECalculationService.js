/**
 * OEE Calculation Service
 * OEE = Availability × Performance × Quality
 *
 * Availability = runtime / planned production time
 * Performance = (ideal cycle time × total pieces) / runtime
 * Quality = (total pieces - defective pieces) / total pieces
 */

class OEECalculationService {
  static normalizeNonNegativeNumber(value, fieldName) {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      throw new Error(`${fieldName} must be a non-negative number`);
    }

    return value;
  }

  /**
   * Calculate availability percentage
   * @param {number} runtimeSeconds - Actual runtime in seconds
   * @param {number} plannedProductionTimeSeconds - Planned production time in seconds
   * @returns {number} Availability as percentage (0-100)
   */
  static calculateAvailability(runtimeSeconds, plannedProductionTimeSeconds) {
    if (plannedProductionTimeSeconds <= 0) return 0;
    const availability = (runtimeSeconds / plannedProductionTimeSeconds) * 100;
    return Math.min(100, Math.max(0, availability));
  }

  /**
   * Calculate performance percentage
   * @param {number} totalPieces - Total pieces produced
   * @param {number} runtimeSeconds - Runtime in seconds
   * @param {number} idealCycleTimeSeconds - Ideal cycle time per piece in seconds
   * @param {number | null} observedCycleTimeSeconds - Observed cycle time per piece from live data
   * @returns {number} Performance as percentage (0-100)
   */
  static calculatePerformance(
    totalPieces,
    runtimeSeconds,
    idealCycleTimeSeconds = 1,
    observedCycleTimeSeconds = null
  ) {
    if (runtimeSeconds <= 0 || totalPieces <= 0) return 0;

    const effectiveIdealCycleTime =
      typeof idealCycleTimeSeconds === 'number' && idealCycleTimeSeconds > 0
        ? idealCycleTimeSeconds
        : typeof observedCycleTimeSeconds === 'number' && observedCycleTimeSeconds > 0
          ? observedCycleTimeSeconds
          : runtimeSeconds / totalPieces;

    if (effectiveIdealCycleTime <= 0) return 0;

    const expectedPieces = runtimeSeconds / effectiveIdealCycleTime;
    const performance = (totalPieces / expectedPieces) * 100;
    return Math.min(100, Math.max(0, performance));
  }

  /**
   * Calculate quality percentage
   * @param {number} totalPieces - Total pieces produced
   * @param {number} defectivePieces - Number of defective pieces
   * @returns {number} Quality as percentage (0-100)
   */
  static calculateQuality(totalPieces, defectivePieces) {
    if (totalPieces <= 0) return defectivePieces > 0 ? 0 : 100;
    const quality = ((totalPieces - defectivePieces) / totalPieces) * 100;
    return Math.min(100, Math.max(0, quality));
  }

  /**
   * Calculate overall OEE
   * @param {object} data - Production data object
   * @param {number} data.totalPieces - Total pieces produced
   * @param {number} data.defectivePieces - Number of defective pieces
   * @param {number} data.runtimeSeconds - Runtime in seconds
   * @param {number} data.plannedProductionTimeSeconds - Planned production time in seconds
   * @param {number} data.idealCycleTimeSeconds - Ideal cycle time per piece (optional, default: 1)
   * @param {number} data.observedCycleTimeSeconds - Observed cycle time per piece from live data
   * @returns {object} OEE metrics object
   */
  static calculateOEE(data) {
    const {
      totalPieces,
      defectivePieces,
      runtimeSeconds,
      plannedProductionTimeSeconds,
      idealCycleTimeSeconds = 1,
      observedCycleTimeSeconds = null,
    } = data;

    // Validate input
    this.normalizeNonNegativeNumber(totalPieces, 'totalPieces');
    this.normalizeNonNegativeNumber(defectivePieces, 'defectivePieces');
    this.normalizeNonNegativeNumber(runtimeSeconds, 'runtimeSeconds');
    this.normalizeNonNegativeNumber(
      plannedProductionTimeSeconds,
      'plannedProductionTimeSeconds'
    );

    // Calculate individual metrics
    const availability = this.calculateAvailability(runtimeSeconds, plannedProductionTimeSeconds);
    const performance = this.calculatePerformance(
      totalPieces,
      runtimeSeconds,
      idealCycleTimeSeconds,
      observedCycleTimeSeconds
    );
    const quality = this.calculateQuality(totalPieces, defectivePieces);

    // Calculate overall OEE
    const oeeValue = (availability * performance * quality) / 10000;

    return {
      oee: parseFloat(oeeValue.toFixed(2)),
      availability: parseFloat(availability.toFixed(2)),
      performance: parseFloat(performance.toFixed(2)),
      quality: parseFloat(quality.toFixed(2)),
      timestamp: new Date(),
    };
  }

  /**
   * Get OEE status based on value
   * @param {number} oeeValue - OEE percentage value
   * @returns {string} Status: 'excellent', 'good', 'fair', 'poor'
   */
  static getOEEStatus(oeeValue) {
    if (oeeValue >= 85) return 'excellent';
    if (oeeValue >= 70) return 'good';
    if (oeeValue >= 50) return 'fair';
    return 'poor';
  }
}

export default OEECalculationService;
