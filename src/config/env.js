/**
 * Application Configuration & Environment Variables
 */
const path = require('path');
require('dotenv').config();

const env = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CACHE_TTL_SECONDS: parseInt(process.env.CACHE_TTL_SECONDS, 10) || 3600, // 1 hora
  
  // APIs oficiales y espejos de alta disponibilidad en tiempo real
  PRIMARY_API_URL: process.env.PRIMARY_API_URL || 'https://open.er-api.com/v6/latest/USD',
  FALLBACK_API_URL: process.env.FALLBACK_API_URL || 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
  TERTIARY_API_URL: process.env.TERTIARY_API_URL || 'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
  
  // Timeout para peticiones upstream en milisegundos
  UPSTREAM_TIMEOUT_MS: parseInt(process.env.UPSTREAM_TIMEOUT_MS, 10) || 5000,

  // Divisas soportadas
  SUPPORTED_CURRENCIES: ['USD', 'COP', 'PEN'],

  PUBLIC_DIR: (() => {
    const fs = require('fs');
    const candidates = [
      path.join(__dirname, '../../public'),
      path.join(__dirname, '../public'),
      path.join(process.cwd(), 'public')
    ];
    for (const dir of candidates) {
      if (fs.existsSync(dir)) {
        return dir;
      }
    }
    return path.join(process.cwd(), 'public');
  })()
};

module.exports = Object.freeze(env);
