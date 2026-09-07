// Guarda que ASEGURADORAS_ART siga siendo la fuente de verdad del orden de
// columnas de la matriz (Cartera ART y ficha de empresa): agregar una
// aseguradora nueva (ej. Reconquista/Paraná ART, sync con backend PR #67)
// no debe romper ningún lugar que asuma un conteo fijo a mano - ver
// ArtMercadoBoard.jsx y ArtCarteraListado.jsx, que ahora derivan el conteo
// de ASEGURADORAS_ART.length en vez de hardcodearlo.
import { describe, it, expect } from 'vitest';
import { ASEGURADORAS_ART, aseguradoraLabel } from './artCarteraConstants';

describe('ASEGURADORAS_ART', () => {
  it('tiene 15 aseguradoras, incluidas Reconquista y Paraná ART, sin ids duplicados', () => {
    expect(ASEGURADORAS_ART).toHaveLength(15);

    const ids = ASEGURADORAS_ART.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(ASEGURADORAS_ART.find((a) => a.id === 'andina')).toEqual({ id: 'andina', label: 'Andina' });
    expect(ASEGURADORAS_ART.find((a) => a.id === 'reconquista')).toEqual({ id: 'reconquista', label: 'Reconquista' });
    expect(ASEGURADORAS_ART.find((a) => a.id === 'parana')).toEqual({ id: 'parana', label: 'Paraná ART' });
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

  it('normaliza Omint con el label "OMINT ART (SERENA)" (Serena es el mismo id, cambio de nombre comercial 2025) y no agrega Serena como aseguradora aparte', () => {
    expect(ASEGURADORAS_ART.find((a) => a.id === 'omint')).toEqual({ id: 'omint', label: 'OMINT ART (SERENA)' });
    expect(ASEGURADORAS_ART.find((a) => a.id === 'serena')).toBeUndefined();
    expect(aseguradoraLabel('omint')).toBe('OMINT ART (SERENA)');
  });
});
