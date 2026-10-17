/**
 * Controller for exchange rates and health checks
 */
const exchangeService = require('../services/exchangeService');

const rateController = {
  /**
   * GET /api/rates
   * Retorna las tasas COP, USD y PEN junto con metadata de origen y TTL
   */
  async getRates(req, res) {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const result = await exchangeService.getRates(forceRefresh);

      // Cabeceras HTTP para control de caché en cliente/proxy
      res.set({
        'Cache-Control': `public, max-age=${Math.min(result.remainingTtlSeconds || 60, 300)}`,
        'X-Data-Source': result.source,
        'X-Cache-Hit': result.cached ? '1' : '0'
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error('[RateController] Error al obtener tasas:', error);
      return res.status(500).json({
        success: false,
        error: 'Error interno al consultar las tasas de cambio',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * GET /api/health
   * Retorna estado de salud del servicio, métricas de memoria y estado del caché RAM
   */
  getHealth(req, res) {
    const memory = process.memoryUsage();
    const cacheStatus = exchangeService.getStatus();

    return res.status(200).json({
      status: 'ok',
      service: 'currency-pwa',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        rssMb: Math.round(memory.rss / (1024 * 1024)),
        heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024))
      },
      cache: cacheStatus
    });
  }
};

module.exports = rateController;
