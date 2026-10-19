/**
 * API Service: Cliente HTTP con timeout, reintentos y fallback offline automático
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/cacheManager'));
  } else {
    root.ApiService = factory(root.CacheManager);
  }
}(typeof self !== 'undefined' ? self : this, function (CacheManager) {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 4500;
  const RATES_ENDPOINT = '/api/rates';
  const HEALTH_ENDPOINT = '/api/health';

  /**
   * Obtiene las tasas de cambio desde el servidor con fallback transparente
   * @param {Object} options - { forceRefresh: boolean, timeoutMs: number }
   * @returns {Promise<Object>} Resultado con { rates, source, timestamp, ... }
   */
  async function fetchRates(options = {}) {
    const forceRefresh = !!options.forceRefresh;
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const url = forceRefresh ? `${RATES_ENDPOINT}?refresh=true` : RATES_ENDPOINT;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Respuesta HTTP no exitosa: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.success && data.rates) {
        // Guardar en almacenamiento local para soporte offline futuro
        CacheManager.saveRates(data);

        return {
          rates: data.rates,
          crossRates: data.crossRates,
          base: data.base || 'USD',
          timestamp: data.timestamp || Date.now(),
          source: data.source, // 'primary_api' | 'memory_cache' | etc.
          cached: data.cached,
          remainingTtlSeconds: data.remainingTtlSeconds,
          isOffline: false
        };
      } else {
        throw new Error('Estructura de tasas devuelta por el servidor es inválida');
      }
    } catch (networkError) {
      clearTimeout(timeoutId);
      console.warn(`[ApiService] Petición al servidor fallida (${networkError.message}). Activando fallback...`);

      // 1. Intentar recuperar del caché local del navegador
      const localCached = CacheManager.getLocalRates();
      if (localCached) {
        return {
          rates: localCached.rates,
          crossRates: null,
          base: localCached.base || 'USD',
          timestamp: localCached.serverTimestamp || localCached.savedAt,
          source: 'local_storage',
          cached: true,
          remainingTtlSeconds: 0,
          isOffline: true,
          warning: 'Sin conexión con el servidor. Mostrando última cotización guardada localmente.'
        };
      }

      // 2. Si no hay historial previo en almacenamiento local, reportar error sin inventar tasas
      throw new Error('Sin conexión con el servidor y no hay tasas previas almacenadas en el dispositivo');
    }
  }

  /**
   * Consulta el estado de salud del servidor
   */
  async function checkHealth(timeoutMs = 3000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(HEALTH_ENDPOINT, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (e) {
      clearTimeout(timeoutId);
      return null;
    }
  }

  return {
    fetchRates,
    checkHealth
  };
}));
