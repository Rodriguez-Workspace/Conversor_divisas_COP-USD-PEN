/**
 * Modular Monolith Server: Express + API + Static PWA Serving
 */
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const env = require('./config/env');
const apiRoutes = require('./routes/apiRoutes');
const exchangeService = require('./services/exchangeService');

const app = express();

// Middlewares base
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cabeceras de seguridad y políticas PWA
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // El Service Worker e index.html no deben ser guardados agresivamente en caché
  if (req.path === '/sw.js' || req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  if (req.path === '/sw.js') {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Service-Worker-Allowed', '/');
  }

  next();
});

// Rutas de API REST
app.use('/api', apiRoutes);

// Servir archivos estáticos del Frontend PWA
app.use(express.static(env.PUBLIC_DIR, {
  maxAge: '0', // Revalidar siempre para reflejar deploys inmediatamente
  setHeaders: (res, filePath) => {
    // Configuración específica para PWA
    if (filePath.endsWith('manifest.json')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
    if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Fallback PWA: cualquier ruta que no sea /api sirve index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(env.PUBLIC_DIR, 'index.html'));
});

// Iniciar servidor y precalentar caché si se ejecuta directamente
let server = null;
if (require.main === module) {
  server = app.listen(env.PORT, '0.0.0.0', async () => {
    console.log(`===============================================`);
    console.log(`🚀 Servidor Currency PWA iniciado exitosamente`);
    console.log(`📡 Puerto: ${env.PORT} (${env.NODE_ENV})`);
    console.log(`🌐 Acceso local: http://localhost:${env.PORT}`);
    console.log(`===============================================`);

    // Precalentar la caché en segundo plano
    try {
      const initialRates = await exchangeService.getRates();
      console.log(`[Cache Warm-Up] Tasas iniciales listas: COP=${initialRates.rates.COP}, PEN=${initialRates.rates.PEN} (${initialRates.source})`);
    } catch (err) {
      console.warn(`[Cache Warm-Up] Error al precargar tasas iniciales: ${err.message}`);
    }
  });

  // Cierre ordenado (Graceful Shutdown)
  function handleShutdown(signal) {
    console.log(`\n[Shutdown] Recibida señal ${signal}. Cerrando servidor HTTP ordenadamente...`);
    if (server) {
      server.close(() => {
        console.log('[Shutdown] Servidor HTTP cerrado. Proceso finalizado con éxito.');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('[Shutdown] Cierre forzado tras tiempo de espera agotado.');
        process.exit(1);
      }, 5000);
    } else {
      process.exit(0);
    }
  }

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

module.exports = app;

