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
    state.activeCurrency = saved.lastActiveCurrency || 'USD';
    state.currentAmount = saved.lastAmount || 100;

    const activeInput = document.getElementById(`input-${state.activeCurrency.toLowerCase()}`);
    if (activeInput) {
      activeInput.value = Converter.formatNumber(state.currentAmount);
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

      View.updateRatesDisplay(state.rates);

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

    const computed = Converter.calculateThreeWay(
      sourceCurrency,
      amount,
      state.rates
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

      // 1. KEYDOWN: Bloquea letras, símbolos especiales, comas y puntos decimales duplicados
      input.addEventListener('keydown', (e) => {
        const selStart = input.selectionStart ?? 0;
        const selEnd = input.selectionEnd ?? 0;

        // Comportamiento mejorado para Backspace cuando el cursor está justo tras una coma (ej: 1|,000)
        if (e.key === 'Backspace' && selStart === selEnd && selStart > 1 && input.value[selStart - 1] === ',') {
          e.preventDefault();
          const val = input.value;
          const before = val.slice(0, selStart - 2);
          const after = val.slice(selStart);
          input.value = before + after;
          const nextPos = Math.max(0, selStart - 2);
          input.setSelectionRange(nextPos, nextPos);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }

        // Teclas de control del sistema y navegación permitidas siempre
        const allowedNavKeys = [
          'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
          'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
          'Home', 'End', 'PageUp', 'PageDown'
        ];

        if (allowedNavKeys.includes(e.key)) {
          return;
        }

        // Atajos estándar con Ctrl o Meta (Cmd en Mac): Copiar, Pegar, Cortar, Seleccionar todo, Deshacer
        if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z', 'y'].includes(e.key.toLowerCase())) {
          return;
        }

        // Si se presiona cualquier otra combinación con modificadores, bloquear
        if (e.ctrlKey || e.metaKey || e.altKey) {
          e.preventDefault();
          return;
        }

        // Validar si el carácter tecleado es dígito 0-9 o punto decimal permitido
        const isAllowed = Converter.isValidNumericChar(e.key, input.value, selStart, selEnd);

        if (!isAllowed) {
          e.preventDefault();
        }
      });

      // 2. BEFOREINPUT: Intercepción para teclados móviles / virtuales y texto predictivo
      input.addEventListener('beforeinput', (e) => {
        if (e.inputType === 'insertText' && e.data) {
          const selStart = input.selectionStart ?? 0;
          const selEnd = input.selectionEnd ?? 0;

          for (let i = 0; i < e.data.length; i++) {
            const char = e.data[i];
            if (!Converter.isValidNumericChar(char, input.value, selStart, selEnd)) {
              e.preventDefault();
              return;
            }
          }
        }
      });

      // 3. PASTE: Sanitizar pegado desde portapapeles (solo números y máximo un punto)
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const clipboardText = (e.clipboardData || window.clipboardData)?.getData('text') || '';
        if (!clipboardText) return;

        const cleanedPaste = Converter.cleanNumericString(clipboardText);
        if (!cleanedPaste) return;

        const val = input.value;
        const selStart = input.selectionStart ?? 0;
        const selEnd = input.selectionEnd ?? 0;

        const before = val.slice(0, selStart);
        const after = val.slice(selEnd);
        const combined = before + cleanedPaste + after;
        const finalCleaned = Converter.cleanNumericString(combined);

        input.value = finalCleaned;
        const newCursor = Math.min(selStart + cleanedPaste.length, finalCleaned.length);
        input.setSelectionRange(newCursor, newCursor);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // 4. INPUT: Formatear miles en vivo sin agregar .00 forzado, preservando el cursor
      input.addEventListener('input', (e) => {
        const raw = e.target.value;
        if (!raw) {
          triggerConversion(curr, 0);
          return;
        }

        const cursorPos = e.target.selectionStart;
        let charsBeforeCursor = raw.slice(0, cursorPos).replace(/,/g, '').length;

        // Separar enteros y decimales respetando el punto que el usuario coloque
        const hasDot = raw.includes('.');
        const parts = raw.split('.');
        const integerDigits = parts[0].replace(/[^0-9]/g, '');

        if (!integerDigits && !hasDot) {
          e.target.value = '';
          triggerConversion(curr, 0);
          return;
        }

        // Si el usuario escribe directamente punto (ej: .5), se antepone '0'
        if (!integerDigits && hasDot) {
          charsBeforeCursor++;
        }

        // Formato con comas para miles (1000 -> 1,000)
        const formattedInt = integerDigits ? Number(integerDigits).toLocaleString('en-US') : (hasDot ? '0' : '');

        // Preservar la parte decimal exacta que el usuario coloque (NUNCA agregar .00 automático)
        let formattedValue = formattedInt;
        if (hasDot) {
          const decimalDigits = parts.slice(1).join('').replace(/[^0-9]/g, '').slice(0, 2);
          formattedValue = `${formattedInt}.${decimalDigits}`;
        }

        e.target.value = formattedValue;

        // Reposicionar el cursor exactamente donde estaba el usuario
        let newCursorPos = 0;
        let countedChars = 0;
        for (let i = 0; i < formattedValue.length; i++) {
          if (countedChars === charsBeforeCursor) {
            newCursorPos = i;
            break;
          }
          if (formattedValue[i] !== ',') {
            countedChars++;
          }
          newCursorPos = i + 1;
        }
        e.target.setSelectionRange(newCursorPos, newCursorPos);

        const cleanNumber = formattedValue.replace(/,/g, '');
        const parsed = parseFloat(cleanNumber) || 0;
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
