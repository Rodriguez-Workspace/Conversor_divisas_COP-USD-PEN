/**
 * Core Converter: Matemática pura para conversiones 3-Way (COP ⇄ USD ⇄ PEN)
 * y cálculo de márgenes conservadores de protección cambiaria.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Converter = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUPPORTED_CURRENCIES = ['USD', 'COP', 'PEN'];

  /**
   * Obtiene la tasa de conversión directa entre dos divisas
   * @param {string} from - Divisa origen ('USD', 'COP', 'PEN')
   * @param {string} to - Divisa destino ('USD', 'COP', 'PEN')
   * @param {Object} rates - Objeto con tasas relativas a USD { USD: 1, COP: number, PEN: number }
   * @param {number} marginPercent - Porcentaje de margen conservador (ej: 1 para 1%)
   * @param {string} marginMode - 'none' | 'conservative_spread' (aplica descuento de seguridad)
   * @returns {number}
   */
  function getExchangeRate(from, to, rates, marginPercent = 0, marginMode = 'none') {
    if (!rates || !rates[from] || !rates[to]) {
      throw new Error(`Tasas inválidas o incompletas para ${from} -> ${to}`);
    }

    if (from === to) return 1.0;

    // Todas las tasas están normalizadas con base USD (USD = 1.0)
    // from -> USD -> to
    // 1 unit of from = (1 / rates[from]) USD = (rates[to] / rates[from]) units of to
    const baseRate = rates[to] / rates[from];

    if (!marginPercent || marginPercent <= 0 || marginMode === 'none') {
      return baseRate;
    }

    // Margen conservador: deduce una fracción de seguridad (spread de protección)
    // Ejemplo: Si 1 USD = 3180 COP, con 1% de margen conservador en venta/presupuesto = 3180 * 0.99 = 3148.2 COP
    const marginFactor = 1 - (marginPercent / 100);
    return baseRate * marginFactor;
  }

  /**
   * Convierte un monto de una divisa origen a una divisa destino
   * @param {number} amount - Monto a convertir
   * @param {string} from - Divisa origen
   * @param {string} to - Divisa destino
   * @param {Object} rates - Tasas relativas a USD
   * @param {number} marginPercent - Porcentaje de margen
   * @param {string} marginMode - Modo de margen
   * @returns {number}
   */
  function convert(amount, from, to, rates, marginPercent = 0, marginMode = 'none') {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 0;
    }
    const num = Number(amount);
    if (num <= 0) return 0;

    const rate = getExchangeRate(from, to, rates, marginPercent, marginMode);
    return num * rate;
  }

  /**
   * Realiza el cálculo 3-Way Binding:
   * A partir de la divisa modificada por el usuario, calcula los valores resultantes
   * para las otras 2 divisas simultáneamente.
   * 
   * @param {string} sourceCurrency - Divisa modificada ('USD' | 'COP' | 'PEN')
   * @param {number} amount - Valor ingresado
   * @param {Object} rates - Tasas { USD, COP, PEN }
   * @param {number} marginPercent - Margen conservador
   * @param {string} marginMode - 'none' | 'conservative_spread'
   * @returns {Object} { USD: number, COP: number, PEN: number }
   */
  function calculateThreeWay(sourceCurrency, amount, rates, marginPercent = 0, marginMode = 'none') {
    const validAmount = (amount === '' || isNaN(amount) || Number(amount) < 0) ? 0 : Number(amount);

    const result = {
      USD: 0,
      COP: 0,
      PEN: 0
    };

    if (validAmount === 0) {
      return result;
    }

    SUPPORTED_CURRENCIES.forEach(target => {
      if (target === sourceCurrency) {
        result[target] = validAmount;
      } else {
        result[target] = convert(validAmount, sourceCurrency, target, rates, marginPercent, marginMode);
      }
    });

    return result;
  }

  /**
   * Formatea un número según las reglas estándar de cada divisa
   * - COP: típicamente sin decimales o máx 2, separador de miles '.' y decimal ','
   * - USD: 2 decimales fijos, separador de miles ',' y decimal '.'
   * - PEN: 2 decimales fijos, separador de miles ',' y decimal '.'
   */
  function formatCurrency(amount, currency, options = {}) {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '0.00';
    }

    const value = Number(amount);
    const decimals = currency === 'COP'
      ? (options.showCopDecimals ? 2 : 0)
      : 2;

    const locales = currency === 'COP' ? 'es-CO' : (currency === 'PEN' ? 'es-PE' : 'en-US');

    return new Intl.NumberFormat(locales, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  }

  /**
   * Limpia y parsea un string ingresado por el usuario a un flotante válido
   */
  function parseInputNumber(rawString) {
    if (rawString === null || rawString === undefined) return 0;
    if (typeof rawString === 'number') return isNaN(rawString) ? 0 : rawString;

    // Remueve espacios, símbolos de moneda
    let cleaned = rawString.toString().trim().replace(/[^0-9.,]/g, '');
    if (!cleaned) return 0;

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      if (lastComma > lastDot) {
        // Formato: 1.234,56 -> 1234.56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato: 1,234.56 -> 1234.56
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (hasDot) {
      const dotCount = (cleaned.match(/\./g) || []).length;
      if (dotCount > 1) {
        // Múltiples puntos: 1.000.000 -> 1000000
        cleaned = cleaned.replace(/\./g, '');
      } else {
        const parts = cleaned.split('.');
        // Si tiene exactamente 3 dígitos al final (ej: 50.000 o 1.000), es separador de miles
        if (parts[1] && parts[1].length === 3 && parts[0].length >= 1) {
          cleaned = cleaned.replace(/\./g, '');
        }
      }
    } else if (hasComma) {
      const commaCount = (cleaned.match(/,/g) || []).length;
      if (commaCount > 1) {
        cleaned = cleaned.replace(/,/g, '');
      } else {
        const parts = cleaned.split(',');
        if (parts[1] && parts[1].length === 3 && parts[0].length >= 1) {
          cleaned = cleaned.replace(/,/g, '');
        } else {
          cleaned = cleaned.replace(',', '.');
        }
      }
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  return {
    SUPPORTED_CURRENCIES,
    getExchangeRate,
    convert,
    calculateThreeWay,
    formatCurrency,
    parseInputNumber
  };
}));
