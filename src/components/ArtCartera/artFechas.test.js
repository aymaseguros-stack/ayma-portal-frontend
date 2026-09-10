// Tests del parseo único de fechas del módulo ART.
//
// EL BUG QUE FIJAN. 'YYYY-MM-DD' pasado a `new Date()` es medianoche UTC,
// no fecha local: al oeste de Greenwich (Argentina, UTC-3) eso se muestra
// como el DÍA ANTERIOR. En estas pantallas un día menos en "caduca",
// "vence" o "validez" es una empresa que se llama tarde, y una propuesta
// que se contradice con el `dias_restantes` que calculó el servidor.
//
// El test fuerza una zona al oeste (America/Argentina/Buenos_Aires) porque
// en UTC el bug no se ve: correr la suite en un runner en UTC lo dejaba
// pasar.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { fechaCorta, anioDeFecha, aFecha } from './artFechas';

// vi.stubEnv y no `process.env.TZ = ...` a mano: deja la restauración a
// cargo de vitest (los tests de este archivo comparten worker con los
// demás, y una TZ que se filtra rompe cualquier assert de fecha del
// vecino) y no obliga a declarar `process`, que el eslint del repo no
// tiene entre sus globals.
beforeAll(() => { vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires'); });
afterAll(() => { vi.unstubAllEnvs(); });

describe('fechaCorta', () => {
  it('una fecha sin hora se muestra EL MISMO día que mandó el backend', () => {
    // La línea de abajo es el bug que este helper reemplaza: en UTC-3
    // devuelve 9/9/2026. Se afirma para que el test no pueda pasar por
    // estar corriendo en UTC (donde las dos formas coinciden).
    expect(new Date('2026-09-10').toLocaleDateString('es-AR')).toBe('9/9/2026');

    expect(fechaCorta('2026-09-10')).toBe('10/9/2026');
    // El caso que más duele: el primero del mes se iba al mes anterior.
    expect(fechaCorta('2026-01-01')).toBe('1/1/2026');
  });

  it('sin dato devuelve null, no "Invalid Date"', () => {
    expect(fechaCorta(null)).toBeNull();
    expect(fechaCorta(undefined)).toBeNull();
    expect(fechaCorta('')).toBeNull();
  });

  it('un valor impresentable vuelve CRUDO, no como guion', () => {
    // Perder el texto original escondería un problema de datos del backend
    // detrás de un "—".
    expect(fechaCorta('no es una fecha')).toBe('no es una fecha');
  });

  it('un timestamp con hora sigue siendo un instante', () => {
    // Acá sí corresponde convertir a hora local: es un momento, no un día
    // del calendario.
    expect(fechaCorta('2026-09-10T15:30:00')).toBe('10/9/2026');
  });
});

describe('anioDeFecha', () => {
  it('el 1 de enero NO cae en el año anterior', () => {
    expect(anioDeFecha('2020-01-01')).toBe(2020);
    expect(anioDeFecha('2025-12-31')).toBe(2025);
  });

  it('sin dato o ilegible devuelve null', () => {
    expect(anioDeFecha(null)).toBeNull();
    expect(anioDeFecha('cualquier cosa')).toBeNull();
  });
});

describe('aFecha', () => {
  it('devuelve el día correcto en componentes locales', () => {
    const fecha = aFecha('2026-09-10');
    expect(fecha.getFullYear()).toBe(2026);
    expect(fecha.getMonth()).toBe(8);
    expect(fecha.getDate()).toBe(10);
  });

  it('un Date ya armado pasa tal cual', () => {
    const original = new Date(2026, 8, 10);
    expect(aFecha(original)).toBe(original);
  });
});
