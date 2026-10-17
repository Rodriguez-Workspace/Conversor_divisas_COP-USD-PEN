# Conversor de Divisas PWA (COP ⇄ USD ⇄ PEN)

Progressive Web App (PWA) de alta velocidad para conversión simultánea de divisas entre **Peso Colombiano (COP)**, **Dólar Estadounidense (USD)** y **Sol Peruano (PEN)** con arquitectura de **Monolito Modular**, soporte 100% offline y caché en memoria RAM.

![Licencia](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![PWA](https://img.shields.io/badge/PWA-Offline%20First-orange.svg)

---

## 🚀 Características Principales

- **3-Way Data Binding Instantáneo:** Al modificar cualquier divisa (USD, COP o PEN), las otras dos se calculan y actualizan automáticamente en tiempo real.
- **Sin Restricciones de CORS (Monolito Modular):** El servidor Express sirve tanto la API (`/api/rates`) como el frontend (`public/`), garantizando peticiones de mismo origen (*Same-Origin*). El servidor actúa como proxy seguro hacia las APIs del mercado interbancario.
- **Caché en Memoria RAM del Servidor:** Almacena en memoria las tasas de cambio con TTL de 1 hora (3600 segundos) para respuestas en menos de 5 ms y evitar saturación de cuotas.
- **Soporte Offline PWA:** Mediante Service Worker (`sw.js`) y `localStorage`, la app permite realizar conversiones aún cuando el dispositivo pierda completamente la conexión a Internet.
- **Diseño Sobrio y Minimalista:** Interfaz limpia, optimizada para dispositivos móviles y de escritorio, sin elementos estridentes ni dependencias pesadas de UI.

---

## 📁 Estructura del Proyecto

```text
Conversor_divisas_COP-USD-PEN/
├── src/
│   ├── config/env.js              # Variables de entorno y tasas de fallback
│   ├── controllers/rateController.js # Manejadores de rutas REST
│   ├── routes/apiRoutes.js        # Rutas /api/rates y /api/health
│   ├── services/exchangeService.js # Fetch con reintentos y caché en memoria RAM
│   └── server.js                  # Servidor Express y middleware estático
├── public/
│   ├── css/styles.css             # Estilos de diseño sobrio
│   ├── icons/icon.svg             # Icono oficial vectorial
│   ├── js/
│   │   ├── core/converter.js      # Matemática 3-way y parseo numérico
│   │   ├── core/cacheManager.js   # Gestión de almacenamiento local y origen
│   │   ├── services/api.js        # Cliente fetch con timeout y fallback
│   │   ├── ui/view.js             # Manipulación reactiva del DOM
│   │   └── app.js                 # Inicializador y registro de Service Worker
│   ├── index.html                 # UI semántica y accesible
│   ├── manifest.json              # Configuración PWA instalable
│   └── sw.js                      # Service Worker (Stale-While-Revalidate + Network-First)
├── test/
│   ├── converter.test.js          # Pruebas unitarias de cálculo
│   └── server.test.js             # Pruebas de integración HTTP
├── vercel.json                    # Despliegue serverless sin suspensión
├── package.json
└── README.md
```

---

## 🛠️ Instalación y Uso Local

### Prerrequisitos
- Node.js >= 18.0.0
- npm >= 9.0.0

### Pasos
1. Clonar el repositorio:
   ```bash
   git clone https://github.com/Rodriguez-Workspace/Conversor_divisas_COP-USD-PEN.git
   cd Conversor_divisas_COP-USD-PEN
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Iniciar el servidor:
   ```bash
   npm start
   ```
   Abrir en el navegador: [http://localhost:3000](http://localhost:3000)

4. Ejecutar pruebas automatizadas:
   ```bash
   npm test
   ```

---

## 📡 Endpoints de la API

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/rates` | Retorna tasas COP, USD, PEN, tasas cruzadas, origen y TTL de caché |
| `GET` | `/api/health` | Estado del servicio, tiempo de actividad (*uptime*) y métricas de RAM |

### Ejemplo de respuesta `/api/rates`:
```json
{
  "success": true,
  "base": "USD",
  "rates": {
    "USD": 1,
    "COP": 3182.78,
    "PEN": 3.43
  },
  "crossRates": {
    "USD_COP": 3182.78,
    "USD_PEN": 3.43,
    "COP_USD": 0.000314,
    "COP_PEN": 0.001079,
    "PEN_USD": 0.291179,
    "PEN_COP": 926.76
  },
  "cached": true,
  "source": "memory_cache",
  "ttlSeconds": 3600
}
```

---

## ☁️ Despliegue en Producción (Sin Suspensión / 24/7)

### Despliegue en Vercel (Recomendado)
El proyecto incluye [`vercel.json`](./vercel.json) configurado para despliegue serverless global con cero costo y sin tiempos de suspensión:
```bash
npx vercel
```

### Despliegue en VPS (Ubuntu/Debian) con PM2
```bash
git clone https://github.com/Rodriguez-Workspace/Conversor_divisas_COP-USD-PEN.git
cd Conversor_divisas_COP-USD-PEN
npm install
pm2 start src/server.js --name "conversor-pwa"
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.