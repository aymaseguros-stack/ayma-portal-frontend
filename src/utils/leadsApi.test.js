import { describe, it, expect, vi, afterEach } from 'vitest';
import { anularLead } from './leadsApi';

afterEach(() => vi.restoreAllMocks());

const okResponse = (data) => ({ ok: true, status: 200, json: async () => data });

describe('anularLead', () => {
  it('PATCHea con el motivo como query param y el token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ mensaje: 'Lead anulado' }));
    vi.stubGlobal('fetch', fetchMock);

    await anularLead('tok', 'lead-1', 'Anulado desde el CRM');

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/leads/lead-1/anular');
    expect(url).toContain('motivo=Anulado+desde+el+CRM');
    expect(opts.method).toBe('PATCH');
    expect(opts.headers.Authorization).toBe('Bearer tok');
  });

  it('propaga el error del backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Lead no encontrado' }),
      text: async () => '{"detail":"Lead no encontrado"}',
    }));
    await expect(anularLead('tok', 'nope', 'x')).rejects.toThrow(/Lead no encontrado/);
  });
});
