import { describe, it, expect } from 'vitest';
import {
  PROFUNDIDAD_MAXIMA, puedeAnidar, normalizarPayload, buscarDuplicados, etiquetaEntidad,
} from './altaEncadenada';

describe('profundidad de la pila', () => {
  it('permite anidar en los dos primeros niveles y no en el tercero', () => {
    expect(PROFUNDIDAD_MAXIMA).toBe(3);
    expect(puedeAnidar(0)).toBe(true);
    expect(puedeAnidar(1)).toBe(true);
    expect(puedeAnidar(2)).toBe(false);
  });
});

describe('normalizarPayload', () => {
  it("manda null en lugar de '' y aplica transformaciones", () => {
    const payload = normalizarPayload(
      { razon_social: 'ACME', cuit: '30111111118', notas: '' },
      { cuit: (v) => `formateado:${v}` },
    );
    expect(payload).toEqual({ razon_social: 'ACME', cuit: 'formateado:30111111118', notas: null });
  });
});

describe('buscarDuplicados', () => {
  const buscarQueDevuelve = (data) => async () => data;

  it('detecta una empresa con el mismo CUIT aunque venga con guiones', async () => {
    const dup = await buscarDuplicados({
      tipo: 'empresa',
      form: { cuit: '30-71234567-8', razon_social: 'ACME SRL' },
      buscar: buscarQueDevuelve({ empresas: [{ id: 'e1', razon_social: 'Acme S.R.L.', cuit: '30712345678' }] }),
    });
    expect(dup).toHaveLength(1);
    expect(dup[0].entidad.id).toBe('e1');
    expect(dup[0].motivo).toBe('CUIT');
  });

  it('no avisa cuando el CUIT es otro', async () => {
    const dup = await buscarDuplicados({
      tipo: 'empresa',
      form: { cuit: '30-71234567-8' },
      buscar: buscarQueDevuelve({ empresas: [{ id: 'e9', razon_social: 'Otra', cuit: '30999999995' }] }),
    });
    expect(dup).toEqual([]);
  });

  it('detecta una persona por documento, mail o teléfono y no la repite', async () => {
    const persona = { id: 'p1', nombre: 'Ana', apellido: 'Díaz', numero_documento: '20123456', email: 'ANA@x.com', celular: '3411234567' };
    const dup = await buscarDuplicados({
      tipo: 'persona',
      form: { numero_documento: '20.123.456', email: 'ana@x.com', celular: '341-123-4567', telefono: '' },
      buscar: buscarQueDevuelve({ personas: [persona] }),
    });
    expect(dup).toHaveLength(1);
    expect(dup[0].entidad.id).toBe('p1');
  });

  it('un error de red no bloquea el alta', async () => {
    const dup = await buscarDuplicados({
      tipo: 'persona',
      form: { numero_documento: '20123456' },
      buscar: async () => { throw new Error('offline'); },
    });
    expect(dup).toEqual([]);
  });

  it('no consulta nada si no hay claves cargadas', async () => {
    let llamadas = 0;
    const dup = await buscarDuplicados({
      tipo: 'persona',
      form: { nombre: 'Ana' },
      buscar: async () => { llamadas += 1; return { personas: [] }; },
    });
    expect(llamadas).toBe(0);
    expect(dup).toEqual([]);
  });
});

describe('etiquetaEntidad', () => {
  it('usa razón social para empresa y nombre + apellido para persona', () => {
    expect(etiquetaEntidad('empresa', { razon_social: 'ACME' })).toBe('ACME');
    expect(etiquetaEntidad('persona', { nombre: 'Ana', apellido: 'Díaz' })).toBe('Ana Díaz');
  });
});
