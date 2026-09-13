// Guarda que ASEGURADORAS_ART siga siendo la fuente de verdad del orden de
// columnas de la matriz (Cartera ART y ficha de empresa): agregar una
// aseguradora nueva (ej. Reconquista/Paraná ART, sync con backend PR #67; o
// Victoria/Latitud Sur/IAPSER/Horizonte, sync con backend setiembre 2026)
// no debe romper ningún lugar que asuma un conteo fijo a mano - ver
// ArtMercadoBoard.jsx y ArtCarteraListado.jsx, que ahora derivan el conteo
// de ASEGURADORAS_ART.length en vez de hardcodearlo.
import { describe, it, expect } from 'vitest';
import {
  ASEGURADORAS_ART,
  aseguradoraLabel,
  TRAMOS_NOMINA_SRT,
  TRAMO_NOMINA_SIN_DATO,
  esTramoNominaValido,
  ordenTramoNomina,
  ordenarTramosNomina,
  sanearTramoNomina,
} from './artCarteraConstants';

describe('ASEGURADORAS_ART', () => {
  it('tiene 19 aseguradoras, incluidas Reconquista, Paraná ART, Victoria, Latitud Sur, IAPSER y Horizonte, sin ids duplicados', () => {
    expect(ASEGURADORAS_ART).toHaveLength(19);

    const ids = ASEGURADORAS_ART.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(ASEGURADORAS_ART.find((a) => a.id === 'andina')).toEqual({ id: 'andina', label: 'Andina' });
    expect(ASEGURADORAS_ART.find((a) => a.id === 'reconquista')).toEqual({ id: 'reconquista', label: 'Reconquista' });
    expect(ASEGURADORAS_ART.find((a) => a.id === 'parana')).toEqual({ id: 'parana', label: 'Paraná ART' });
    expect(ASEGURADORAS_ART.find((a) => a.id === 'victoria')).toEqual({ id: 'victoria', label: 'Victoria' });
    expect(ASEGURADORAS_ART.find((a) => a.id === 'latitud_sur')).toEqual({ id: 'latitud_sur', label: 'Latitud Sur' });
    expect(ASEGURADORAS_ART.find((a) => a.id === 'iapser')).toEqual({ id: 'iapser', label: 'IAPSER (Entre Ríos)' });
    expect(ASEGURADORAS_ART.find((a) => a.id === 'horizonte')).toEqual({ id: 'horizonte', label: 'Horizonte' });

    // Orden fijo: coincide con ASEGURADORAS_VALIDAS en
    // app/models/crm/empresa_art_estado.py del backend (las 4 nuevas van al
    // final, en el mismo orden que el backend - NO alfabético).
    expect(ids.slice(-4)).toEqual(['victoria', 'latitud_sur', 'iapser', 'horizonte']);
  });

  it('mantiene el mismo formato { id, label } en cada entrada', () => {
    ASEGURADORAS_ART.forEach((a) => {
      expect(typeof a.id).toBe('string');
      expect(typeof a.label).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
      expect(a.label.length).toBeGreaterThan(0);
    });
  });

  it('aseguradoraLabel resuelve Reconquista y Paraná ART igual que cualquier otra aseguradora del listado', () => {
    expect(aseguradoraLabel('andina')).toBe('Andina');
    expect(aseguradoraLabel('reconquista')).toBe('Reconquista');
    expect(aseguradoraLabel('parana')).toBe('Paraná ART');
  });

  it('aseguradoraLabel resuelve Victoria, Latitud Sur, IAPSER y Horizonte igual que cualquier otra aseguradora del listado', () => {
    expect(aseguradoraLabel('victoria')).toBe('Victoria');
    expect(aseguradoraLabel('latitud_sur')).toBe('Latitud Sur');
    expect(aseguradoraLabel('iapser')).toBe('IAPSER (Entre Ríos)');
    expect(aseguradoraLabel('horizonte')).toBe('Horizonte');
  });

  it('normaliza Omint con el label "OMINT ART (SERENA)" (Serena es el mismo id, cambio de nombre comercial 2025) y no agrega Serena como aseguradora aparte', () => {
    expect(ASEGURADORAS_ART.find((a) => a.id === 'omint')).toEqual({ id: 'omint', label: 'OMINT ART (SERENA)' });
    expect(ASEGURADORAS_ART.find((a) => a.id === 'serena')).toBeUndefined();
    expect(aseguradoraLabel('omint')).toBe('OMINT ART (SERENA)');
  });
});

// ---------------------------------------------------------------------------
// Tramos de nómina SRT (D-B4, backend PR #119). El backend valida el
// parámetro `?tramo=` contra esta misma lista: cualquier divergencia acá es
// un 422 en producción, así que los valores se comparan literales.
// ---------------------------------------------------------------------------
describe('artCarteraConstants - tramos de nómina SRT', () => {
  it('son los diez tramos de la SRT más SIN_DATO, con las etiquetas exactas del backend', () => {
    expect(TRAMOS_NOMINA_SRT).toEqual([
      '1',
      '2',
      '3 a 5',
      '6 a 10',
      '11 a 25',
      '26 a 40',
      '41 a 50',
      '51 a 100',
      '101 a 500',
      '501 y más',
      'SIN_DATO',
    ]);
    expect(TRAMO_NOMINA_SIN_DATO).toBe('SIN_DATO');
  });

  it('ningún tramo viejo (pre D-B4) sobrevive en la lista', () => {
    ['1-5', '6-25', '26-100', '101-500', '501-1500', '1501+'].forEach((viejo) => {
      expect(TRAMOS_NOMINA_SRT).not.toContain(viejo);
      expect(esTramoNominaValido(viejo)).toBe(false);
    });
  });

  it('el orden es por dotación creciente, NO alfabético: "11 a 25" va antes de "101 a 500"', () => {
    expect(ordenTramoNomina('11 a 25')).toBeLessThan(ordenTramoNomina('101 a 500'));
    expect(ordenTramoNomina('6 a 10')).toBeLessThan(ordenTramoNomina('11 a 25'));
    expect(ordenTramoNomina('41 a 50')).toBeLessThan(ordenTramoNomina('51 a 100'));
    // Y el orden de la lista NO coincide con el que daría un sort() de strings.
    expect(TRAMOS_NOMINA_SRT).not.toEqual([...TRAMOS_NOMINA_SRT].sort());
  });

  it('SIN_DATO va último: es la ausencia del dato, no el tramo más chico', () => {
    expect(TRAMOS_NOMINA_SRT[TRAMOS_NOMINA_SRT.length - 1]).toBe(TRAMO_NOMINA_SIN_DATO);
    TRAMOS_NOMINA_SRT.slice(0, -1).forEach((t) => {
      expect(ordenTramoNomina(t)).toBeLessThan(ordenTramoNomina(TRAMO_NOMINA_SIN_DATO));
    });
  });

  it('ordenarTramosNomina reordena claves sueltas (p. ej. las de por_tramo) por dotación', () => {
    expect(ordenarTramosNomina(['101 a 500', 'SIN_DATO', '11 a 25', '1', '501 y más']))
      .toEqual(['1', '11 a 25', '101 a 500', '501 y más', 'SIN_DATO']);
    // Un tramo desconocido va al final, nunca al principio.
    expect(ordenarTramosNomina(['99 a 999', '1'])).toEqual(['1', '99 a 999']);
  });

  it('sanearTramoNomina descarta un tramo viejo y vuelve al default ("todos") en vez de mandar un 422', () => {
    expect(sanearTramoNomina('26-100')).toBe('');
    expect(sanearTramoNomina('1501+')).toBe('');
    expect(sanearTramoNomina(undefined)).toBe('');
    expect(sanearTramoNomina(null)).toBe('');
    expect(sanearTramoNomina('')).toBe('');
    // Los válidos pasan intactos.
    expect(sanearTramoNomina('26 a 40')).toBe('26 a 40');
    expect(sanearTramoNomina('SIN_DATO')).toBe('SIN_DATO');
  });
});
