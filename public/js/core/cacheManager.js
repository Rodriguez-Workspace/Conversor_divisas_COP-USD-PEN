/**
 * Cache Manager: Manejo robusto de localStorage, detección del origen de los datos
 * y estado de sincronización offline para la PWA.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CacheManager = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY_RATES = 'currency_pwa_rates_v1';
  const STORAGE_KEY_SETTINGS = 'currency_pwa_settings_v1';

  // Tasas de emergencia integradas (si el dispositivo está 100% offline y es primera apertura)
  const HARDCODED_RATES = {
    USD: 1.0,
    COP: 3182.78,
    PEN: 3.43
  };

  /**
   * Guarda las tasas recibidas del servidor en localStorage
   * @param {Object} data - Respuesta del endpoint /api/rates
   */
  function saveRates(data) {
    try {
      const payload = {
        rates: data.rates,
        base: data.base || 'USD',
        serverTimestamp: data.timestamp || Date.now(),
        savedAt: Date.now(),
        serverSource: data.source || 'server',
        ttlSeconds: data.ttlSeconds || 3600
      };
      localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.warn('[CacheManager] Error al guardar en localStorage:', e);
      return false;
    }
  }

  /**
   * Obtiene las tasas desde localStorage si existen
   * @returns {Object|null}
   */
  function getLocalRates() {
    try {
      const item = localStorage.getItem(STORAGE_KEY_RATES);
      if (!item) return null;
      const parsed = JSON.parse(item);
      if (parsed && parsed.rates && parsed.rates.COP && parsed.rates.PEN) {
        return parsed;
      }
    } catch (e) {
      console.warn('[CacheManager] Error al leer localStorage:', e);
    }
    return null;
  }

  /**
   * Determina y clasifica el origen de los datos para la interfaz de usuario
   * @param {string} sourceId - Identificador de origen
   * @returns {Object} { label, badgeClass, description, isFresh }
   */
  function describeSource(sourceId) {
    switch (sourceId) {
      case 'live_api':
      case 'primary_api':
      case 'secondary_api':
        return {
          id: 'live',
          label: 'En vivo (Servidor)',
          badgeClass: 'badge-live',
          description: 'Tasas sincronizadas en tiempo real con el mercado interbancario.',
          isFresh: true
        };
      case 'memory_cache':
      case 'server_cache':
        return {
          id: 'server_cache',
          label: 'Caché de Servidor (RAM)',
          badgeClass: 'badge-server-cache',
          description: 'Servido desde la memoria ultrarrápida del servidor.',
          isFresh: true
        };
      case 'local_storage':
      case 'offline_cache':
        return {
          id: 'offline_cache',
          label: 'Caché Local (Offline)',
          badgeClass: 'badge-local-cache',
          description: 'Sin conexión: usando última cotización guardada en tu dispositivo.',
          isFresh: false
        };
      case 'static_fallback':
      case 'hardcoded_fallback':
      default:
        return {
          id: 'fallback',
          label: 'Referencia de Emergencia',
          badgeClass: 'badge-fallback',
          description: 'Tasas de referencia precargadas.',
          isFresh: false
        };
    }
  }

  /**
   * Calcula el tiempo transcurrido desde la última sincronización en formato legible
   */
  function formatAge(timestamp) {
    if (!timestamp) return 'Desconocido';
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

    if (elapsedSeconds < 60) {
      return `hace ${elapsedSeconds}s`;
    }
    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 60) {
      return `hace ${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `hace ${hours}h`;
    }
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  }

  /**
   * Guarda preferencias de usuario (ej. margen conservador activo, % margen)
   */
  function saveSettings(settings) {
    try {
      const current = getSettings();
      const merged = { ...current, ...settings };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(merged));
      return merged;
    } catch (e) {
      return settings;
    }
  }

  /**
   * Obtiene preferencias guardadas con valores predeterminados
   */
  function getSettings() {
    const defaults = {
      marginActive: false,
      marginPercent: 1.0, // 1% de margen conservador por defecto
      lastActiveCurrency: 'USD',
      theme: 'auto',
      lastAmount: 100
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
    } catch (e) {
      // Ignorar fallos de parseo
    }
    return defaults;
  }

  return {
    HARDCODED_RATES,
    saveRates,
    getLocalRates,
    describeSource,
    formatAge,
    saveSettings,
    getSettings
  };
}));
