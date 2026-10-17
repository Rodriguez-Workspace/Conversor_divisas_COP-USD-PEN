# Multi-stage / Production-ready lightweight Dockerfile
FROM node:20-alpine AS runner

# Crear directorio de trabajo
WORKDIR /app

# Definir variables de entorno de producción
ENV NODE_ENV=production
ENV PORT=3000

# Instalar dependencias necesarias para healthcheck
RUN apk add --no-cache curl

# Copiar manifiesto de dependencias para aprovechar la caché de Docker
COPY package*.json ./

# Instalar solo dependencias de producción limpias
RUN npm ci --only=production && npm cache clean --force

# Copiar el código fuente y activos estáticos
COPY . .

# Usar usuario no privilegiado 'node' por seguridad
USER node

# Exponer el puerto del servicio
EXPOSE 3000

# Healthcheck interno del contenedor
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Comando de arranque
CMD ["npm", "start"]
