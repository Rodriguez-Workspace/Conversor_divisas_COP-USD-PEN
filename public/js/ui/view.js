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

    // Elementos de la barra informativa en una sola línea
    refRatesBar: document.getElementById('reference-rates-bar'),
    rateBase: document.getElementById('rate-base'),
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

    const format = (val) => {
      if (val === null || val === undefined || isNaN(val) || val === 0) return '';
      return window.Converter ? window.Converter.formatNumber(val) : String(val);
    };

    if (activeCurrency !== 'USD' && elements.inputUSD) {
      elements.inputUSD.value = format(amounts.USD);
    }
    if (activeCurrency !== 'COP' && elements.inputCOP) {
      elements.inputCOP.value = format(amounts.COP);
    }
    if (activeCurrency !== 'PEN' && elements.inputPEN) {
      elements.inputPEN.value = format(amounts.PEN);
    }
  }

  /**
   * Actualiza la barra informativa en una sola línea limpia:
   * 1 USD • 3.434 PEN • 926,76 COP
   */
  function updateRatesDisplay(rates) {
    if (!rates || !rates.COP || !rates.PEN) return;

    const usdPen = Number(rates.PEN).toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const penCop = Number(rates.COP / rates.PEN).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const usdCop = Number(rates.COP).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (elements.rateBase) elements.rateBase.textContent = '1 USD';
    if (elements.rateUsdPen) elements.rateUsdPen.textContent = `${usdPen} PEN`;
    if (elements.ratePenCop) elements.ratePenCop.textContent = `${penCop} COP`;

    if (elements.refRatesBar) {
      elements.refRatesBar.title = `1 USD = ${usdPen} PEN | 1 PEN = ${penCop} COP | 1 USD = $${usdCop} COP`;
    }
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
