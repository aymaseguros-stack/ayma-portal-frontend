// Tests del parseo único de fechas de la app.
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
import { fechaCorta, fechaHora, anioDeFecha, aFecha, hoyISO, diaISO } from './fechas';

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

describe('fechaCorta con opciones de formato', () => {
  it('el formato cambia, el día NO', () => {
    // El eje de los gráficos pide día/mes; la agenda pide el día de la
    // semana. Las dos formas tienen que seguir cayendo en el 10, no en el 9.
    expect(fechaCorta('2026-09-10', { day: '2-digit', month: '2-digit' })).toBe('10/9');
    expect(fechaCorta('2026-09-10', { weekday: 'long' })).toBe('jueves');
  });
});

describe('fechaHora', () => {
  it('un timestamp se muestra como instante local', () => {
    // El formato exacto de es-AR (reloj de 12 o de 24 horas, con o sin
    // meridiano) depende del ICU del runtime, así que se afirma lo que este
    // helper garantiza: el día y la hora del instante, sin el corrimiento
    // que sí sufre una fecha pelada.
    const texto = fechaHora('2026-09-10T15:30:00');
    expect(texto).toContain('10/9/2026');
    expect(texto).toContain('3:30');
  });

  it('acepta opciones de formato', () => {
    const texto = fechaHora('2026-09-10T15:30:00', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    expect(texto).toContain('10/9');
    expect(texto).toContain('3:30');
  });

  it('mismo contrato de vacío y crudo que fechaCorta', () => {
    // Las pantallas de Mail hacían `m.fecha ? new Date(...) : '-'` a mano;
    // ahora el guion lo pone la pantalla sobre un null, no sobre un
    // "Invalid Date".
    expect(fechaHora(null)).toBeNull();
    expect(fechaHora('')).toBeNull();
    expect(fechaHora('no es una fecha')).toBe('no es una fecha');
  });
});

describe('hoyISO', () => {
  it('devuelve el día LOCAL, no el de UTC', () => {
    // 21:30 del 10/9 en Argentina ya es 11/9 en UTC. Ese desfasaje marcaba
    // vencida una oportunidad que cerraba hoy, y movía el "Hoy" de la agenda
    // al día siguiente tres horas antes.
    const nocheArgentina = new Date(2026, 8, 10, 21, 30);
    expect(nocheArgentina.toISOString().slice(0, 10)).toBe('2026-09-11');
    expect(hoyISO(nocheArgentina)).toBe('2026-09-10');
  });

  it('rellena mes y día con cero', () => {
    expect(hoyISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('sin argumento es el día de hoy', () => {
    expect(hoyISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('diaISO', () => {
  it('corre días sin salirse del mes ni del año', () => {
    const base = new Date(2026, 8, 10, 21, 30);
    expect(diaISO(1, base)).toBe('2026-09-11');
    expect(diaISO(-10, base)).toBe('2026-08-31');
    expect(diaISO(113, base)).toBe('2027-01-01');
  });

  it('el corrimiento es por componentes, no por milisegundos', () => {
    // El 1/11/2026 Argentina no cambia de hora, pero sí lo hacen otras zonas
    // al oeste: sumar 86400000 ms daba el MISMO día en los días de cambio.
    // Con componentes locales, un día es siempre el día siguiente.
    const base = new Date(2026, 10, 1, 23, 0);
    expect(diaISO(1, base)).toBe('2026-11-02');
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
