/**
 * Exchange Service: Recupera, valida y almacena en caché en memoria RAM
 * las tasas oficiales de cambio para COP, USD y PEN.
 */
const env = require('../config/env');

class ExchangeService {
  constructor() {
    this.cache = null; // { rates, base, timestamp, expiresAt, source }
    this.inFlightPromise = null; // Evita llamadas simultáneas concurrentes (cache stampede)
  }

  /**
   * Obtiene las tasas de cambio activas (desde RAM o consultando upstream)
   * @param {boolean} forceRefresh - Forzar actualización ignorando TTL
   * @returns {Promise<Object>}
   */
  async getRates(forceRefresh = false) {
    const now = Date.now();

    // 1. Servir desde caché RAM si aún es válido
    if (!forceRefresh && this.cache && now < this.cache.expiresAt) {
      const remainingTtl = Math.max(0, Math.round((this.cache.expiresAt - now) / 1000));
      return {
        success: true,
        base: 'USD',
        rates: this.cache.rates,
        crossRates: this.computeCrossRates(this.cache.rates),
        timestamp: this.cache.timestamp,
        cached: true,
        source: 'memory_cache',
        ttlSeconds: env.CACHE_TTL_SECONDS,
        remainingTtlSeconds: remainingTtl,
        serverTime: new Date(now).toISOString()
      };
    }

    // 2. Si ya hay una petición en vuelo, esperar a que termine
    if (this.inFlightPromise) {
      return this.inFlightPromise;
    }

    // 3. Ejecutar consulta de red y actualizar caché RAM
    this.inFlightPromise = this.fetchAndStoreRates(now)
      .finally(() => {
        this.inFlightPromise = null;
      });

    return this.inFlightPromise;
  }

  /**
   * Intenta consultar API primaria y secundaria con timeout
   */
  async fetchAndStoreRates(requestTime) {
    let fetchedRates = null;
    let providerSource = null;

    // Intento 1: API Primaria
    try {
      fetchedRates = await this.fetchWithTimeout(env.PRIMARY_API_URL, env.UPSTREAM_TIMEOUT_MS, (data) => {
        if (data && data.rates && data.rates.COP && data.rates.PEN) {
          return {
            USD: 1.0,
            COP: parseFloat(data.rates.COP),
            PEN: parseFloat(data.rates.PEN)
          };
        }
        return null;
      });
      providerSource = 'primary_api';
    } catch (err) {
      console.warn(`[ExchangeService] Falló API primaria (${err.message}). Intentando API secundaria...`);
    }

    // Intento 2: API Secundaria de respaldo
    if (!fetchedRates) {
      try {
        fetchedRates = await this.fetchWithTimeout(env.FALLBACK_API_URL, env.UPSTREAM_TIMEOUT_MS, (data) => {
          if (data && data.usd && data.usd.cop && data.usd.pen) {
            return {
              USD: 1.0,
              COP: parseFloat(data.usd.cop),
              PEN: parseFloat(data.usd.pen)
            };
          }
          return null;
        });
        providerSource = 'secondary_api';
      } catch (err) {
        console.warn(`[ExchangeService] Falló API secundaria (${err.message}).`);
      }
    }

    // Intento 3: Si ambas fallaron, usar caché anterior (incluso si está expirada)
    if (!fetchedRates && this.cache) {
      console.warn('[ExchangeService] Usando caché previa en RAM debido a fallo de red.');
      return {
        success: true,
        base: 'USD',
        rates: this.cache.rates,
        crossRates: this.computeCrossRates(this.cache.rates),
        timestamp: this.cache.timestamp,
        cached: true,
        source: 'stale_cache',
        ttlSeconds: env.CACHE_TTL_SECONDS,
        remainingTtlSeconds: 0,
        warning: 'Tasas servidas desde caché degradada por indisponibilidad de proveedor',
        serverTime: new Date(requestTime).toISOString()
      };
    }

    // Intento 4: Si es cold-start sin red, usar respaldo estático
    if (!fetchedRates) {
      console.error('[ExchangeService] Advertencia crítica: Usando tasas estáticas de emergencia.');
      fetchedRates = { ...env.STATIC_FALLBACK_RATES };
      providerSource = 'static_fallback';
    }

    // Guardar en memoria RAM con su tiempo de expiración
    const expiresAt = requestTime + env.CACHE_TTL_SECONDS * 1000;
    this.cache = {
      rates: fetchedRates,
      timestamp: requestTime,
      expiresAt: expiresAt,
      source: providerSource
    };

    return {
      success: true,
      base: 'USD',
      rates: fetchedRates,
      crossRates: this.computeCrossRates(fetchedRates),
      timestamp: requestTime,
      cached: false,
      source: providerSource,
      ttlSeconds: env.CACHE_TTL_SECONDS,
      remainingTtlSeconds: env.CACHE_TTL_SECONDS,
      serverTime: new Date(requestTime).toISOString()
    };
  }

  /**
   * Helper para peticiones HTTP con control de aborto por timeout
   */
  async fetchWithTimeout(url, timeoutMs, parserFn) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CurrencyPWA-ExchangeService/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      const parsed = parserFn(json);
      if (!parsed) {
        throw new Error('Estructura de respuesta inválida');
      }
      return parsed;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Pre-calcula matriz de conversión directa para todas las combinaciones
   */
  computeCrossRates(rates) {
    const usd = rates.USD || 1.0;
    const cop = rates.COP;
    const pen = rates.PEN;

    return {
      'USD_COP': cop,
      'USD_PEN': pen,
      'COP_USD': 1 / cop,
      'COP_PEN': pen / cop,
      'PEN_USD': 1 / pen,
      'PEN_COP': cop / pen
    };
  }

  /**
   * Retorna información de diagnóstico de la caché RAM
   */
  getStatus() {
    const now = Date.now();
    return {
      hasCache: !!this.cache,
      source: this.cache ? this.cache.source : 'none',
      cachedAt: this.cache ? new Date(this.cache.timestamp).toISOString() : null,
      expiresAt: this.cache ? new Date(this.cache.expiresAt).toISOString() : null,
      isExpired: this.cache ? now >= this.cache.expiresAt : true,
      remainingTtlSeconds: this.cache ? Math.max(0, Math.round((this.cache.expiresAt - now) / 1000)) : 0
    };
  }
}

module.exports = new ExchangeService();
