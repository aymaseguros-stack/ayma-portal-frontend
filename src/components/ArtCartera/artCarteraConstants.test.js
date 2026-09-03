// Guarda que ASEGURADORAS_ART siga siendo la fuente de verdad del orden de
// columnas de la matriz (Cartera ART y ficha de empresa): agregar una
// aseguradora nueva (ej. Andina, la 13ª) no debe romper ningún lugar que
// asuma "12" a mano - ver ArtMercadoBoard.jsx y ArtCarteraListado.jsx, que
// ahora derivan el conteo de ASEGURADORAS_ART.length en vez de hardcodearlo.
import { describe, it, expect } from 'vitest';
import { ASEGURADORAS_ART, aseguradoraLabel } from './artCarteraConstants';

describe('ASEGURADORAS_ART', () => {
  it('tiene 13 aseguradoras, incluida Andina, sin ids duplicados', () => {
    expect(ASEGURADORAS_ART).toHaveLength(13);

    const ids = ASEGURADORAS_ART.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(ASEGURADORAS_ART.find((a) => a.id === 'andina')).toEqual({ id: 'andina', label: 'Andina' });
  });

  it('mantiene el mismo formato { id, label } en cada entrada', () => {
    ASEGURADORAS_ART.forEach((a) => {
      expect(typeof a.id).toBe('string');
      expect(typeof a.label).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
      expect(a.label.length).toBeGreaterThan(0);
    });
  });

  it('aseguradoraLabel resuelve Andina igual que cualquier otra aseguradora del listado', () => {
    expect(aseguradoraLabel('andina')).toBe('Andina');
  });
});
