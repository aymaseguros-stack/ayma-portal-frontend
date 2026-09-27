// @vitest-environment jsdom
//
// OPERACIONES-0013 FE-3: con el tilde "Incluir no colocables" el buscador
// manda incluir_no_colocables=true junto con q; sin el tilde no lo manda.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import BuscadorOportunidades from './BuscadorOportunidades';

let urls;
beforeEach(() => {
  urls = [];
  globalThis.fetch = vi.fn(async (url) => {
    urls.push(new URL(String(url)));
    return { ok: true, status: 200, json: async () => ({ items: [] }) };
  });
});
afterEach(cleanup);

const buscar = async (props) => {
  render(<BuscadorOportunidades token="t" onAbrir={() => {}} {...props} />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'CAÑADA' } });
  await waitFor(() => expect(urls).toHaveLength(1));
  return urls[0].searchParams;
};

describe('BuscadorOportunidades · no colocables', () => {
  it('con el tilde envía incluir_no_colocables=true junto con q', async () => {
    const p = await buscar({ incluirNoColocables: true });
    expect(p.get('q')).toBe('CAÑADA');
    expect(p.get('incluir_no_colocables')).toBe('true');
  });

  it('sin el tilde no lo envía', async () => {
    const p = await buscar({});
    expect(p.get('q')).toBe('CAÑADA');
    expect(p.has('incluir_no_colocables')).toBe(false);
  });
});
