/**
 * UI View Module: Manipulación reactiva del DOM, formato de inputs
 * y panel de estado de sincronización / caché.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.View = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Referencias cacheadas del DOM
  const elements = {
    // Inputs por divisa
    inputUSD: document.getElementById('input-usd'),
    inputCOP: document.getElementById('input-cop'),
    inputPEN: document.getElementById('input-pen'),

    // Etiquetas y badges de ayuda
    rateUsdCop: document.getElementById('rate-usd-cop'),
    rateUsdPen: document.getElementById('rate-usd-pen'),
    ratePenCop: document.getElementById('rate-pen-cop'),

    // Panel de estado de datos
    sourceBadge: document.getElementById('source-badge'),
    syncTime: document.getElementById('sync-time'),
    networkStatus: document.getElementById('network-status'),
    networkDot: document.getElementById('network-dot'),
    btnRefresh: document.getElementById('btn-refresh'),
    refreshIcon: document.getElementById('refresh-icon'),

    // Banner de instalación PWA
    installBanner: document.getElementById('install-banner'),
    btnInstall: document.getElementById('btn-install'),
    btnCloseInstall: document.getElementById('btn-close-install'),

    // Toast de notificaciones
    toast: document.getElementById('toast')
  };

  /**
   * Actualiza los valores de las divisas en pantalla evitando sobreescribir
   * el input que el usuario tiene enfocado actualmente.
   */
  function updateCurrencyInputs(amounts, activeCurrency) {
    if (!amounts) return;

    if (activeCurrency !== 'USD' && elements.inputUSD) {
      elements.inputUSD.value = amounts.USD ? amounts.USD.toFixed(2) : '';
    }
    if (activeCurrency !== 'COP' && elements.inputCOP) {
      // Para COP en edición mostramos entero o 2 decimales según convenga
      elements.inputCOP.value = amounts.COP ? (amounts.COP % 1 === 0 ? amounts.COP.toFixed(0) : amounts.COP.toFixed(2)) : '';
    }
    if (activeCurrency !== 'PEN' && elements.inputPEN) {
      elements.inputPEN.value = amounts.PEN ? amounts.PEN.toFixed(2) : '';
    }
  }

  /**
   * Actualiza las tarjetas informativas de tasas cruzadas en la interfaz
   */
  function updateRatesDisplay(rates) {
    if (!rates || !rates.COP || !rates.PEN) return;

    const usdCop = rates.COP.toLocaleString('es-CO', { maximumFractionDigits: 2 });
    const usdPen = rates.PEN.toLocaleString('es-PE', { maximumFractionDigits: 3 });
    const penCop = (rates.COP / rates.PEN).toLocaleString('es-CO', { maximumFractionDigits: 1 });

    if (elements.rateUsdCop) elements.rateUsdCop.textContent = `1 USD = $${usdCop} COP`;
    if (elements.rateUsdPen) elements.rateUsdPen.textContent = `1 USD = S/ ${usdPen} PEN`;
    if (elements.ratePenCop) elements.ratePenCop.textContent = `1 PEN = $${penCop} COP`;
  }

  /**
   * Actualiza el panel de estado de caché y origen del dato
   */
  function updateStatusPanel(meta) {
    if (!meta) return;

    // Actualizar badge de origen
    if (elements.sourceBadge) {
      elements.sourceBadge.textContent = meta.label || 'Sincronizado';
      elements.sourceBadge.className = `status-badge ${meta.badgeClass || ''}`;
      elements.sourceBadge.title = meta.description || '';
    }

    // Actualizar timestamp
    if (elements.syncTime && meta.formattedAge) {
      elements.syncTime.textContent = meta.formattedAge;
    }
  }

  /**
   * Actualiza el indicador de conexión a Internet (Online / Offline)
   */
  function updateNetworkStatus(isOnline) {
    if (elements.networkStatus) {
      elements.networkStatus.textContent = isOnline ? 'En línea' : 'Sin conexión';
    }
    if (elements.networkDot) {
      if (isOnline) {
        elements.networkDot.classList.add('online');
        elements.networkDot.classList.remove('offline');
      } else {
        elements.networkDot.classList.add('offline');
        elements.networkDot.classList.remove('online');
      }
    }
  }

  /**
   * Configura la animación de carga del botón de sincronización
   */
  function setRefreshLoading(isLoading) {
    if (!elements.btnRefresh || !elements.refreshIcon) return;
    if (isLoading) {
      elements.btnRefresh.disabled = true;
      elements.refreshIcon.classList.add('spin-animation');
    } else {
      elements.btnRefresh.disabled = false;
      elements.refreshIcon.classList.remove('spin-animation');
    }
  }

  /**
   * Muestra un mensaje flotante temporal (Toast)
   */
  let toastTimer = null;
  function showToast(message, type = 'info') {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.className = `toast toast-${type} toast-visible`;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      elements.toast.className = 'toast';
    }, 3200);
  }

  /**
   * Muestra u oculta el banner de instalación PWA
   */
  function toggleInstallBanner(visible) {
    if (elements.installBanner) {
      elements.installBanner.style.display = visible ? 'flex' : 'none';
    }
  }

  return {
    elements,
    updateCurrencyInputs,
    updateRatesDisplay,
    updateStatusPanel,
    updateNetworkStatus,
    setRefreshLoading,
    showToast,
    toggleInstallBanner
  };
}));
