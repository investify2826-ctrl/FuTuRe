export function createConfigFromEnv() {
  return {
    port: process.env.PORT || 3001,
    stellarNetwork: process.env.STELLAR_NETWORK || 'testnet',
    security: {
      jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      corsOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:5173'],
    },
  };
}

let config = null;

export function getConfig() {
  if (!config) {
    config = createConfigFromEnv();
  }
  return config;
}

export function resetConfig() {
  config = null;
}
