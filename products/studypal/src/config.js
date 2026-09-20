const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error("Missing required environment variable: " + name);
  return value;
};

function getConfig() {
  return {
    env: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 3000),
    databaseUrl: process.env.STUDYPAL_DATABASE_URL || null,
    authIssuer: process.env.STUDYPAL_AUTH_ISSUER || null,
    authAudience: process.env.STUDYPAL_AUTH_AUDIENCE || null,
    storageEndpoint: process.env.STUDYPAL_STORAGE_ENDPOINT || null,
    paymentProvider: process.env.STUDYPAL_PAYMENT_PROVIDER || "izakhono-pay",
    aiProvider: process.env.STUDYPAL_AI_PROVIDER || null,
    ownerBootstrapToken: process.env.STUDYPAL_OWNER_BOOTSTRAP_TOKEN || null
  };
}

module.exports = { getConfig, required };
