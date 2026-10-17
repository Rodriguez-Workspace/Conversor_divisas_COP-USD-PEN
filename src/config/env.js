/**
 * Application Configuration & Environment Variables
 */
const path = require('path');
require('dotenv').config();

const env = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CACHE_TTL_SECONDS: parseInt(process.env.CACHE_TTL_SECONDS, 10) || 3600, // 1 hora
  
  // APIs oficiales y espejos de alta disponibilidad
  PRIMARY_API_URL: process.env.PRIMARY_API_URL || 'https://open.er-api.com/v6/latest/USD',
  FALLBACK_API_URL: process.env.FALLBACK_API_URL || 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
  
  // Timeout para peticiones upstream en milisegundos
  UPSTREAM_TIMEOUT_MS: parseInt(process.env.UPSTREAM_TIMEOUT_MS, 10) || 5000,

  // Divisas soportadas
  SUPPORTED_CURRENCIES: ['USD', 'COP', 'PEN'],

  // Tasas de respaldo de emergencia (si falla la red en cold-start)
  STATIC_FALLBACK_RATES: {
    USD: 1.0,
    COP: 3182.78,
    PEN: 3.43
  },

  PUBLIC_DIR: path.join(__dirname, '../../public')
};

module.exports = Object.freeze(env);
