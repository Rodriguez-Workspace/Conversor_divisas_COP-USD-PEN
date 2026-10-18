const test = require('node:test');
const assert = require('node:assert/strict');
const Converter = require('../public/js/core/converter');

test('Converter - getExchangeRate', (t) => {
  const rates = { USD: 1.0, COP: 4000, PEN: 4.0 };

  // USD to COP
  const usdToCop = Converter.getExchangeRate('USD', 'COP', rates);
  assert.equal(usdToCop, 4000);

  // COP to USD
  const copToUsd = Converter.getExchangeRate('COP', 'USD', rates);
  assert.equal(copToUsd, 0.00025);

  // COP to PEN
  const copToPen = Converter.getExchangeRate('COP', 'PEN', rates);
  assert.equal(copToPen, 4.0 / 4000); // 0.001

  // PEN to COP
  const penToCop = Converter.getExchangeRate('PEN', 'COP', rates);
  assert.equal(penToCop, 1000);

  // Margen conservador de 1%
  const rateWithMargin = Converter.getExchangeRate('USD', 'COP', rates, 1.0, 'conservative_spread');
  assert.equal(rateWithMargin, 4000 * 0.99); // 3960
});

test('Converter - calculateThreeWay binding from USD', () => {
  const rates = { USD: 1.0, COP: 4000, PEN: 4.0 };
  const res = Converter.calculateThreeWay('USD', 100, rates);

  assert.equal(res.USD, 100);
  assert.equal(res.COP, 400000);
  assert.equal(res.PEN, 400);
});

test('Converter - calculateThreeWay binding from COP', () => {
  const rates = { USD: 1.0, COP: 4000, PEN: 4.0 };
  const res = Converter.calculateThreeWay('COP', 400000, rates);

  assert.equal(res.COP, 400000);
  assert.equal(res.USD, 100);
  assert.equal(res.PEN, 400);
});

test('Converter - calculateThreeWay binding from PEN', () => {
  const rates = { USD: 1.0, COP: 4000, PEN: 4.0 };
  const res = Converter.calculateThreeWay('PEN', 400, rates);

  assert.equal(res.PEN, 400);
  assert.equal(res.USD, 100);
  assert.equal(res.COP, 400000);
});

test('Converter - parseInputNumber', () => {
  assert.equal(Converter.parseInputNumber('1,234.56'), 1234.56);
  assert.equal(Converter.parseInputNumber('1.234,56'), 1234.56);
  assert.equal(Converter.parseInputNumber('$ 50.000'), 50000);
  assert.equal(Converter.parseInputNumber('S/ 100.50'), 100.50);
  assert.equal(Converter.parseInputNumber(''), 0);
  assert.equal(Converter.parseInputNumber(null), 0);
});

test('Converter - formatNumber without forced .00', () => {
  assert.equal(Converter.formatNumber(1000), '1,000');
  assert.equal(Converter.formatNumber(100), '100');
  assert.equal(Converter.formatNumber(400000), '400,000');
  assert.equal(Converter.formatNumber(1000.5), '1,000.5');
  assert.equal(Converter.formatNumber(1000.75), '1,000.75');
  assert.equal(Converter.formatNumber(0), '0');
  assert.equal(Converter.formatNumber(null), '');
});

test('Converter - cleanNumericString removes letters, symbols and enforces max 1 dot', () => {
  assert.equal(Converter.cleanNumericString('1000'), '1000');
  assert.equal(Converter.cleanNumericString('1,000'), '1000');
  assert.equal(Converter.cleanNumericString('abc1000def'), '1000');
  assert.equal(Converter.cleanNumericString('$1,234.56'), '1234.56');
  assert.equal(Converter.cleanNumericString('100.50.75'), '100.5075');
  assert.equal(Converter.cleanNumericString('abc'), '');
  assert.equal(Converter.cleanNumericString(''), '');
  assert.equal(Converter.cleanNumericString(null), '');
});

test('Converter - isValidNumericChar blocks letters, symbols, commas and duplicate dots', () => {
  // Dígitos válidos
  assert.equal(Converter.isValidNumericChar('0'), true);
  assert.equal(Converter.isValidNumericChar('5'), true);
  assert.equal(Converter.isValidNumericChar('9'), true);

  // Letras bloqueadas
  assert.equal(Converter.isValidNumericChar('a'), false);
  assert.equal(Converter.isValidNumericChar('Z'), false);
  assert.equal(Converter.isValidNumericChar('e'), false); // 'e' matemático bloqueado

  // Comas bloqueadas (se formatean solas automáticamente)
  assert.equal(Converter.isValidNumericChar(','), false);

  // Símbolos bloqueados
  assert.equal(Converter.isValidNumericChar('+'), false);
  assert.equal(Converter.isValidNumericChar('-'), false);
  assert.equal(Converter.isValidNumericChar('$'), false);
  assert.equal(Converter.isValidNumericChar('@'), false);
  assert.equal(Converter.isValidNumericChar(' '), false);

  // Punto decimal
  assert.equal(Converter.isValidNumericChar('.', '1000', 4, 4), true); // Sin punto previo
  assert.equal(Converter.isValidNumericChar('.', '1,000.5', 7, 7), false); // Ya tiene punto
  assert.equal(Converter.isValidNumericChar('.', '1,000.5', 5, 6), true); // Punto existente seleccionado para reemplazo
  assert.equal(Converter.isValidNumericChar('.', '1,000.5', 0, 7), true); // Selección completa
});

