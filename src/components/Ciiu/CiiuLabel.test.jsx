// @vitest-environment jsdom
//
// Tests de <CiiuLabel/> (bloque D3): el único lugar donde se arma el texto
// "código — descripción" que sale en la ficha, el listado, la grilla, el
// drill-down de performance y la cola de alícuotas.
//
// Lo que cubren: con descripción (texto completo en el title, recorte a 60
// caracteres en pantalla), sin descripción (el cartel de catálogo, en gris),
// y que NO se pida nada al backend - la descripción viaja en la misma
// respuesta que el código, una llamada por fila serían 100 por página.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CiiuLabel, { MAX_DESCRIPCION, TEXTO_SIN_CATALOGO } from './CiiuLabel';

afterEach(cleanup);

describe('CiiuLabel', () => {
  it('con descripción: muestra "código — descripción" y no llama al backend', () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    render(<CiiuLabel codigo="251200" descripcion="Fabricación de tanques" />);
    expect(screen.getByText(/251200 — Fabricación de tanques/)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('descripción larga: recorta en pantalla pero deja el texto completo en el title', () => {
    const larga = 'Fabricación de tanques, depósitos y recipientes de metal, excepto los destinados a gas comprimido';
    const { container } = render(<CiiuLabel codigo="251200" descripcion={larga} />);
    const span = container.querySelector('span');
    expect(span.title).toBe(`251200 — ${larga}`);
    expect(span.textContent.length).toBeLessThan(`251200 — ${larga}`.length);
    expect(span.textContent).toContain('…');
    expect(span.textContent.startsWith(`251200 — ${larga.slice(0, 20)}`)).toBe(true);
  });

  it('descripción corta: no recorta ni agrega puntos suspensivos', () => {
    const corta = 'Cultivo de arroz';
    expect(corta.length).toBeLessThan(MAX_DESCRIPCION);
    const { container } = render(<CiiuLabel codigo="011200" descripcion={corta} />);
    expect(container.querySelector('span').textContent).toBe('011200 — Cultivo de arroz');
  });

  it('sin descripción (null): lo dice explícito y en gris, no muestra el código pelado', () => {
    const { container } = render(<CiiuLabel codigo="999999" descripcion={null} />);
    const span = container.querySelector('span');
    expect(span.textContent).toBe(`999999 — ${TEXTO_SIN_CATALOGO}`);
    expect(span.className).toContain('text-slate-500');
  });

  it('descripción vacía o de espacios: se trata igual que null', () => {
    const { container } = render(<CiiuLabel codigo="999999" descripcion="   " />);
    expect(container.querySelector('span').textContent).toBe(`999999 — ${TEXTO_SIN_CATALOGO}`);
  });

  it('sin código: guion, nunca un "— no está en el catálogo" sin código adelante', () => {
    const { container } = render(<CiiuLabel codigo={null} descripcion="Cultivo de arroz" />);
    expect(container.querySelector('span').textContent).toBe('—');
  });
});
