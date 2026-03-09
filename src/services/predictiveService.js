function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export function analyzeAssetReadings(payload) {
  const { readings = [], recentFailures = 0, ageYears = 0 } = payload;

  if (!Array.isArray(readings) || readings.length < 3) {
    return {
      riskLevel: "unknown",
      failureProbability: null,
      anomalyCount: 0,
      recommendation: "Add at least 3 sensor readings to run predictive analysis."
    };
  }

  const avg = mean(readings);
  const sigma = stdDev(readings);
  const anomalyThreshold = avg + 2 * sigma;
  const anomalyCount = readings.filter((value) => value > anomalyThreshold).length;
  const trendSlope = readings[readings.length - 1] - readings[0];

  // Lightweight heuristic score until a trained ML model is connected.
  const rawRiskScore = 0.4 * (anomalyCount / readings.length) +
    0.3 * Math.max(0, trendSlope / (Math.abs(avg) + 1)) +
    0.2 * Math.min(1, recentFailures / 5) +
    0.1 * Math.min(1, ageYears / 15);

  const failureProbability = Math.max(0, Math.min(0.99, rawRiskScore));

  let riskLevel = "low";
  if (failureProbability >= 0.7) riskLevel = "critical";
  else if (failureProbability >= 0.5) riskLevel = "high";
  else if (failureProbability >= 0.3) riskLevel = "medium";

  const recommendation =
    riskLevel === "critical"
      ? "Schedule immediate inspection and preventive replacement planning."
      : riskLevel === "high"
        ? "Prioritize this asset in the next maintenance window."
        : riskLevel === "medium"
          ? "Increase monitoring frequency and verify operating conditions."
          : "Continue routine preventive maintenance schedule.";

  return {
    riskLevel,
    failureProbability,
    anomalyCount,
    trendSlope,
    recommendation
  };
}
