// @vitest-environment jsdom
// El catálogo de categorías de adjuntos y su desplegable agrupado.
//
// Lo que se prueba acá es lo que el usuario ve al elegir: que estén las 7
// categorías del ciclo de emisión de automotor (antes caían todas en OTRO),
// que NO se haya ido ninguna de las 8 viejas -hay adjuntos cargados con cada
// una- y que el desplegable salga agrupado en vez de como una lista plana de
// 15, que es justo lo que empuja a elegir OTRO.
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GRUPOS_CATEGORIAS, CATEGORIAS_ADJUNTO, tituloCategoria } from './adjuntosApi';
import { OpcionesCategorias } from './categoriasAdjunto';

// Escritas a mano y NO derivadas del módulo: un test que importa la misma
// lista que prueba no prueba nada.
const NUEVAS = [
  'ORDEN_EMISION', 'CERTIFICADO_PROVISORIO', 'CERTIFICADO_COBERTURA',
  'TARJETA_AZUL', 'CEDULA_VERDE', 'FOTO_INSPECCION', 'COMPROBANTE_PAGO',
];
const ORIGINALES = [
  'F931', 'POLIZA', 'COTIZACION', 'PROPUESTA',
  'DNI_CEDULA', 'CONSTANCIA', 'CHAT', 'OTRO',
];

describe('catálogo de categorías', () => {
  it('tiene las 7 del ciclo de emisión', () => {
    for (const c of NUEVAS) expect(CATEGORIAS_ADJUNTO).toContain(c);
  });

  it('no perdió ninguna de las 8 originales', () => {
    for (const c of ORIGINALES) expect(CATEGORIAS_ADJUNTO).toContain(c);
  });

  it('son 15 y no hay repetidas', () => {
    expect(CATEGORIAS_ADJUNTO).toHaveLength(15);
    expect(new Set(CATEGORIAS_ADJUNTO).size).toBe(15);
  });

  it('los grupos cubren el catálogo exactamente y todos tienen título', () => {
    const deLosGrupos = GRUPOS_CATEGORIAS.flatMap(({ categorias }) => categorias.map(([v]) => v));
    expect([...deLosGrupos].sort()).toEqual([...CATEGORIAS_ADJUNTO].sort());
    for (const { categorias } of GRUPOS_CATEGORIAS) {
      for (const [, titulo] of categorias) expect(titulo.trim()).not.toBe('');
    }
  });

  it('los 7 grupos están en el orden del ciclo de vida, no alfabético', () => {
    expect(GRUPOS_CATEGORIAS.map(({ grupo }) => grupo)).toEqual([
      'Comercial', 'Emisión', 'Riesgo', 'Identidad', 'Cobro', 'ART', 'Otros',
    ]);
  });

  it('una categoría vieja que el catálogo ya no ofrezca se muestra igual', () => {
    expect(tituloCategoria('FOTO_INSPECCION')).toBe('Foto de inspección');
    expect(tituloCategoria('CATEGORIA_QUE_NO_EXISTE')).toBe('CATEGORIA_QUE_NO_EXISTE');
    expect(tituloCategoria(undefined)).toBe('');
  });
});

describe('el desplegable', () => {
  const desplegable = () => render(
    <select aria-label="Categoría" defaultValue="OTRO" onChange={() => {}}>
      <OpcionesCategorias />
    </select>,
  );

  it('agrupa las opciones con optgroup en vez de listar 15 sueltas', () => {
    const { container } = desplegable();
    const grupos = [...container.querySelectorAll('optgroup')].map((g) => g.label);
    expect(grupos).toEqual(GRUPOS_CATEGORIAS.map(({ grupo }) => grupo));
    expect(container.querySelectorAll('select > option')).toHaveLength(0);
  });

  it('ofrece las 15 con su título legible y su valor de API', () => {
    const { container } = desplegable();
    const opciones = [...container.querySelectorAll('option')];
    expect(opciones).toHaveLength(15);
    const certificado = opciones.find((o) => o.value === 'CERTIFICADO_PROVISORIO');
    expect(certificado.textContent).toBe('Certificado provisorio');
    expect(certificado.closest('optgroup').label).toBe('Emisión');
  });

  it('las fotos de inspección ya no son OTRO', () => {
    desplegable();
    expect(screen.getByRole('option', { name: 'Foto de inspección' })).toBeTruthy();
  });
});
