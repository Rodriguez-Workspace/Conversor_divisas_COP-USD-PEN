/**
 * Main Application Orchestrator: Eventos, 3-Way Data Binding,
 * Estado Reactivo y Registro del Service Worker PWA.
 */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Dependencias globales
  const Converter = window.Converter;
  const CacheManager = window.CacheManager;
  const ApiService = window.ApiService;
  const View = window.View;

  // Estado reactivo central de la aplicación
  const state = {
    rates: CacheManager.HARDCODED_RATES,
    activeCurrency: 'USD',
    currentAmount: 100,
    marginActive: false,
    marginPercent: 1.0,
    dataSource: 'initializing',
    timestamp: null,
    deferredInstallPrompt: null
  };

  /**
   * Inicialización general
   */
  async function init() {
    loadSavedPreferences();
    setupEventListeners();
    setupNetworkListeners();
    registerServiceWorker();
    startAgeTicker();

    // Cargar datos iniciales
    await syncRates(false);

    // Ejecutar primera conversión con valor predeterminado
    triggerConversion(state.activeCurrency, state.currentAmount);
  }

  /**
   * Carga preferencias previas del usuario desde localStorage
   */
  function loadSavedPreferences() {
    const saved = CacheManager.getSettings();
    state.marginActive = saved.marginActive || false;
    state.marginPercent = saved.marginPercent || 1.0;
    state.activeCurrency = saved.lastActiveCurrency || 'USD';
    state.currentAmount = saved.lastAmount || 100;

    // Sincronizar UI con preferencias
    if (View.elements.marginToggle) {
      View.elements.marginToggle.checked = state.marginActive;
    }
    if (View.elements.marginSlider) {
      View.elements.marginSlider.value = state.marginPercent;
    }
    if (View.elements.marginValueDisplay) {
      View.elements.marginValueDisplay.textContent = `${state.marginPercent.toFixed(1)}%`;
    }
    if (View.elements.marginInfoBox) {
      View.elements.marginInfoBox.style.display = state.marginActive ? 'block' : 'none';
    }

    const activeInput = document.getElementById(`input-${state.activeCurrency.toLowerCase()}`);
    if (activeInput) {
      activeInput.value = state.currentAmount;
    }
  }

  /**
   * Sincroniza las tasas de cambio llamando a la API con fallback
   */
  async function syncRates(forceRefresh = false) {
    View.setRefreshLoading(true);

    try {
      const result = await ApiService.fetchRates({ forceRefresh });
      state.rates = result.rates;
      state.dataSource = result.source;
      state.timestamp = result.timestamp;

      // Actualizar metadata en UI
      const sourceDesc = CacheManager.describeSource(result.source);
      View.updateStatusPanel({
        label: sourceDesc.label,
        badgeClass: sourceDesc.badgeClass,
        description: sourceDesc.description,
        formattedAge: CacheManager.formatAge(state.timestamp)
      });

      View.updateRatesDisplay(state.rates, state.marginPercent, state.marginActive);

      // Re-calcular divisas con las tasas actualizadas
      triggerConversion(state.activeCurrency, state.currentAmount);

      if (forceRefresh) {
        View.showToast(result.isOffline ? 'Modo sin conexión: cotización local cargada' : 'Tasas de cambio actualizadas con éxito', 'success');
      }
    } catch (err) {
      console.error('[App] Error al sincronizar:', err);
      View.showToast('No fue posible sincronizar tasas en este momento', 'error');
    } finally {
      View.setRefreshLoading(false);
    }
  }

  /**
   * Ejecuta el 3-way binding cuando el usuario edita cualquier divisa
   */
  function triggerConversion(sourceCurrency, amount) {
    state.activeCurrency = sourceCurrency;
    state.currentAmount = amount;

    const marginMode = state.marginActive ? 'conservative_spread' : 'none';
    const computed = Converter.calculateThreeWay(
      sourceCurrency,
      amount,
      state.rates,
      state.marginPercent,
      marginMode
    );

    // Actualizar los otros dos inputs
    View.updateCurrencyInputs(computed, sourceCurrency);

    // Persistir preferencia del último valor
    CacheManager.saveSettings({
      lastActiveCurrency: sourceCurrency,
      lastAmount: amount
    });
  }

  /**
   * Configuración de eventos de UI
   */
  function setupEventListeners() {
    const currencies = ['USD', 'COP', 'PEN'];

    currencies.forEach(curr => {
      const input = document.getElementById(`input-${curr.toLowerCase()}`);
      if (!input) return;

      // Escuchar entrada de datos en tiempo real
      input.addEventListener('input', (e) => {
        const parsed = Converter.parseInputNumber(e.target.value);
        triggerConversion(curr, parsed);
      });

      // Selección de texto al enfocar para facilidad en móvil
      input.addEventListener('focus', (e) => {
        state.activeCurrency = curr;
        setTimeout(() => e.target.select(), 50);
      });
    });

    // Botón de actualización manual
    if (View.elements.btnRefresh) {
      View.elements.btnRefresh.addEventListener('click', () => {
        syncRates(true);
      });
    }

    // Toggle de margen conservador
    if (View.elements.marginToggle) {
      View.elements.marginToggle.addEventListener('change', (e) => {
        state.marginActive = e.target.checked;
        if (View.elements.marginInfoBox) {
          View.elements.marginInfoBox.style.display = state.marginActive ? 'block' : 'none';
        }
        CacheManager.saveSettings({ marginActive: state.marginActive });
        View.updateRatesDisplay(state.rates, state.marginPercent, state.marginActive);
        triggerConversion(state.activeCurrency, state.currentAmount);

        View.showToast(state.marginActive ? `Margen conservador del ${state.marginPercent}% activado` : 'Margen desactivado (tasa interbancaria)', 'info');
      });
    }

    // Slider de porcentaje del margen conservador
    if (View.elements.marginSlider) {
      View.elements.marginSlider.addEventListener('input', (e) => {
        state.marginPercent = parseFloat(e.target.value) || 1.0;
        if (View.elements.marginValueDisplay) {
          View.elements.marginValueDisplay.textContent = `${state.marginPercent.toFixed(1)}%`;
        }
        CacheManager.saveSettings({ marginPercent: state.marginPercent });
        View.updateRatesDisplay(state.rates, state.marginPercent, state.marginActive);
        if (state.marginActive) {
          triggerConversion(state.activeCurrency, state.currentAmount);
        }
      });
    }

    // Chips de valores rápidos (Preset Buttons)
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const amount = parseFloat(btn.dataset.amount);
        const curr = btn.dataset.currency || state.activeCurrency;
        const targetInput = document.getElementById(`input-${curr.toLowerCase()}`);
        if (targetInput) {
          targetInput.value = amount;
          triggerConversion(curr, amount);
          targetInput.focus();
        }
      });
    });

    // Botón de limpiar todo
    const btnClear = document.getElementById('btn-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        ['usd', 'cop', 'pen'].forEach(c => {
          const el = document.getElementById(`input-${c}`);
          if (el) el.value = '';
        });
        triggerConversion(state.activeCurrency, 0);
      });
    }

    // Eventos de instalación PWA
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      View.toggleInstallBanner(true);
    });

    if (View.elements.btnInstall) {
      View.elements.btnInstall.addEventListener('click', async () => {
        if (!state.deferredInstallPrompt) return;
        state.deferredInstallPrompt.prompt();
        const choice = await state.deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          View.showToast('¡PWA instalada con éxito!', 'success');
        }
        state.deferredInstallPrompt = null;
        View.toggleInstallBanner(false);
      });
    }

    if (View.elements.btnCloseInstall) {
      View.elements.btnCloseInstall.addEventListener('click', () => {
        View.toggleInstallBanner(false);
      });
    }
  }

  /**
   * Monitoreo de conectividad (Online / Offline)
   */
  function setupNetworkListeners() {
    View.updateNetworkStatus(navigator.onLine);

    window.addEventListener('online', () => {
      View.updateNetworkStatus(true);
      View.showToast('Conexión reestablecida. Sincronizando...', 'success');
      syncRates(false);
    });

    window.addEventListener('offline', () => {
      View.updateNetworkStatus(false);
      View.showToast('Trabajando en modo sin conexión', 'warning');
      const sourceDesc = CacheManager.describeSource('local_storage');
      View.updateStatusPanel({
        label: sourceDesc.label,
        badgeClass: sourceDesc.badgeClass,
        description: sourceDesc.description,
        formattedAge: CacheManager.formatAge(state.timestamp)
      });
    });
  }

  /**
   * Registro del Service Worker para capacidades PWA Offline
   */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((reg) => {
            console.log('[ServiceWorker] Registrado con éxito. Ámbito:', reg.scope);

            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  View.showToast('Nueva versión disponible. Actualiza para ver cambios.', 'info');
                }
              });
            });
          })
          .catch((err) => {
            console.warn('[ServiceWorker] Falló el registro:', err);
          });
      });
    }
  }

  /**
   * Actualizador periódico del tiempo transcurrido de la caché
   */
  function startAgeTicker() {
    setInterval(() => {
      if (state.timestamp) {
        const formattedAge = CacheManager.formatAge(state.timestamp);
        if (View.elements.syncTime) {
          View.elements.syncTime.textContent = formattedAge;
        }
      }
    }, 15000); // Cada 15 segundos
  }

  // Arrancar la app
  init();
});
