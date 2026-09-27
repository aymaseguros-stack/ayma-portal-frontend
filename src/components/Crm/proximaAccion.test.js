// C-9d - la lógica pura de la próxima acción: sin defaults, las reglas del
// backend (`validar_proxima_accion`) y el cuerpo que viaja.
import { describe, it, expect } from 'vitest';
import {
  FORM_PROXIMA_ACCION_VACIO, validarProximaAccion, payloadProximaAccion,
  toqueExigeProximaAccion, hoyAr, sumarDias, TIPO_LOOP,
} from './proximaAccion';

const HOY = '2026-09-27';
const ctx = (extra = {}) => ({ plazoAccion: 90, plazoRecontacto: 365, hoy: HOY, ...extra });
const accion = (extra = {}) => ({ ...FORM_PROXIMA_ACCION_VACIO, tipo: 'WHATSAPP', fecha: sumarDias(HOY, 3), ...extra });
const loop = (extra = {}) => ({
  ...FORM_PROXIMA_ACCION_VACIO, tipo: TIPO_LOOP, loop_motivo: 'PRECIO',
  fecha_recontacto: sumarDias(HOY, 30), resultado_loop: 'SIN_EFECTO', ...extra,
});

describe('formulario vacío', () => {
  it('no trae ninguna decisión tomada: ni tipo, ni fecha, ni resultado_loop', () => {
    expect(FORM_PROXIMA_ACCION_VACIO.tipo).toBe('');
    expect(FORM_PROXIMA_ACCION_VACIO.fecha).toBe('');
    expect(FORM_PROXIMA_ACCION_VACIO.fecha_recontacto).toBe('');
    expect(FORM_PROXIMA_ACCION_VACIO.resultado_loop).toBe('');
    expect(FORM_PROXIMA_ACCION_VACIO.hora).toBe('10:00');
    expect(validarProximaAccion(FORM_PROXIMA_ACCION_VACIO, ctx())).toMatch(/Elegí la próxima acción/);
  });
});

describe('fechas en hora argentina', () => {
  it('hoyAr usa -3 aunque el instante UTC ya sea el día siguiente', () => {
    expect(hoyAr(new Date('2026-09-28T02:30:00Z'))).toBe('2026-09-27');
    expect(hoyAr(new Date('2026-09-28T03:30:00Z'))).toBe('2026-09-28');
  });
  it('sumarDias cruza meses sin correr el día', () => {
    expect(sumarDias('2026-09-27', 5)).toBe('2026-10-02');
  });
});

describe('validarProximaAccion · acción con fecha', () => {
  it('exige fecha futura y dentro de 90 días', () => {
    expect(validarProximaAccion(accion({ fecha: '' }), ctx())).toMatch(/cuándo/);
    expect(validarProximaAccion(accion({ fecha: HOY }), ctx())).toMatch(/futura/);
    expect(validarProximaAccion(accion({ fecha: sumarDias(HOY, 91) }), ctx())).toMatch(/90 días/);
    expect(validarProximaAccion(accion({ fecha: sumarDias(HOY, 90) }), ctx())).toBeNull();
  });
  it('la nota tiene tope de 500', () => {
    expect(validarProximaAccion(accion({ nota: 'x'.repeat(501) }), ctx())).toMatch(/500/);
  });
});

describe('validarProximaAccion · LOOP', () => {
  it('motivo obligatorio y OTRO exige detalle', () => {
    expect(validarProximaAccion(loop({ loop_motivo: '' }), ctx())).toMatch(/motivo/);
    expect(validarProximaAccion(loop({ loop_motivo: 'OTRO' }), ctx())).toMatch(/detalle/);
    expect(validarProximaAccion(loop({ loop_motivo: 'OTRO', loop_motivo_detalle: 'se muda' }), ctx())).toBeNull();
  });
  it('recontacto futuro y hasta 365 días', () => {
    expect(validarProximaAccion(loop({ fecha_recontacto: HOY }), ctx())).toMatch(/futura/);
    expect(validarProximaAccion(loop({ fecha_recontacto: sumarDias(HOY, 366) }), ctx())).toMatch(/365/);
  });
  it('resultado_loop no tiene default', () => {
    expect(validarProximaAccion(loop({ resultado_loop: '' }), ctx())).toMatch(/obligatorio/);
  });
  it('CON_EFECTO fuera de ART se rechaza (no hay alícuotas que declarar)', () => {
    expect(validarProximaAccion(loop({ resultado_loop: 'CON_EFECTO' }), ctx({ track: 'AUTO' })))
      .toMatch(/sólo existen en ART/);
    expect(validarProximaAccion(loop(), ctx({ track: 'AUTO' }))).toBeNull();
  });
  it('si no se pudo leer el track, SIN_EFECTO pasa y CON_EFECTO pide reintentar', () => {
    expect(validarProximaAccion(loop(), ctx({ trackEstado: 'error' }))).toBeNull();
    expect(validarProximaAccion(loop({ resultado_loop: 'CON_EFECTO' }), ctx({ trackEstado: 'error' })))
      .toMatch(/Reintentá/);
  });
  it('CON_EFECTO en ART aplica las reglas de D-B8 (validarLoop)', () => {
    const base = loop({ resultado_loop: 'CON_EFECTO' });
    expect(validarProximaAccion(base, ctx({ track: 'ART' }))).toMatch(/dos alícuotas/);
    expect(validarProximaAccion({
      ...base, alicuota_previa: '3', alicuota_posterior: '2.5', alicuota_posterior_fuente: 'F931',
    }, ctx({ track: 'ART' }))).toBeNull();
  });
});

describe('payloadProximaAccion', () => {
  it('una acción viaja con fecha SIN zona (hora argentina) y sin campos de LOOP', () => {
    expect(payloadProximaAccion(accion({ fecha: '2026-10-02', nota: '  ' }))).toEqual({
      tipo: 'WHATSAPP', fecha: '2026-10-02T10:00:00', nota: null,
    });
  });
  it('LOOP fuera de ART lleva sólo resultado_loop; en ART, los campos de D-B8', () => {
    expect(payloadProximaAccion(loop(), { track: 'AUTO' })).toEqual({
      tipo: TIPO_LOOP, fecha_recontacto: sumarDias(HOY, 30), loop_motivo: 'PRECIO',
      loop_motivo_detalle: null, resultado_loop: 'SIN_EFECTO',
    });
    const art = payloadProximaAccion(loop({
      resultado_loop: 'CON_EFECTO', alicuota_previa: '3', alicuota_posterior: '2', alicuota_posterior_fuente: 'F931',
    }), { track: 'ART' });
    expect(art).toMatchObject({ alicuota_previa: 3, alicuota_posterior: 2, alicuota_posterior_fuente: 'F931' });
    expect(art).not.toHaveProperty('fecha');
    expect(art).not.toHaveProperty('nota');
  });
});

describe('toqueExigeProximaAccion', () => {
  it.each([
    [null, 1, false], [null, 3, false],
    [true, 1, true], [true, 3, true],
    [false, 1, false], [false, 2, false], [false, 3, true],
  ])('hubo=%s toque %i -> %s', (hubo, toque, esperado) => {
    expect(toqueExigeProximaAccion(hubo, toque, 3)).toBe(esperado);
  });
});
