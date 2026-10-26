export interface MetricoolAdapterConfig {
  brandId: number;
  timezone: string;
}

export interface DistributionIntent {
  campaignId: string;
  channels: string[];
  scheduled: boolean;
}

/**
 * External distribution boundary. Credentials and publishing remain outside
 * the campaign engine so Metricool can be replaced without changing the
 * IZAKHONO marketing data model.
 */
export function createMetricoolDistributionIntent(
  config: MetricoolAdapterConfig,
  campaignId: string,
  channels: string[],
): DistributionIntent {
  if (!Number.isInteger(config.brandId) || config.brandId <= 0) {
    throw new Error("Invalid Metricool brand id");
  }
  if (!config.timezone) throw new Error("Metricool timezone is required");
  return { campaignId, channels: [...new Set(channels)], scheduled: false };
}
