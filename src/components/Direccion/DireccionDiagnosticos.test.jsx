// @vitest-environment jsdom
//
// Diagnósticos del sistema. Lo que este test blinda:
//
// 1. El botón llama al endpoint REAL (/api/v1/admin/drive/estado) con la
//    sesión activa en el header, no con un script de consola.
// 2. La respuesta se muestra COMPLETA y copiable, no resumida.
// 3. Con escritura_ok=false, el error de Google sale TAL CUAL. Maquillarlo
//    es exactamente lo que obligó a leer los logs de Render dos veces.
// 4. El bloque crudo nunca imprime un secreto, aunque el endpoint lo mande.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import DireccionDiagnosticos from './DireccionDiagnosticos';
import { sanear, OCULTO } from './diagnosticosCatalogo';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
});

const OK = {
  credencial_ok: true,
  escritura_ok: true,
  client_id: '1234567890',
  service_account_email: 'ayma-drive@ayma.iam.gserviceaccount.com',
  usuario_impersonado: 'aymaseguros@gmail.com',
  actuando_como: 'aymaseguros@gmail.com',
  scopes_solicitados: ['https://www.googleapis.com/auth/drive.file'],
  error: null,
};

const FALLA = {
  ...OK,
  credencial_ok: false,
  escritura_ok: false,
  error: "RefreshError: ('unauthorized_client: Client is unauthorized to retrieve access tokens using this method.')",
  reason: 'unauthorized_client',
};

const montarYProbar = async (cuerpo) => {
  globalThis.fetch = vi.fn(() => Promise.resolve(respuesta(cuerpo)));
  render(<DireccionDiagnosticos token="tok-123" />);
  fireEvent.click(screen.getByRole('button', { name: 'Probar Google Drive' }));
  await waitFor(() => expect(screen.getByTestId('respuesta-cruda')).toBeTruthy());
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('diagnóstico de Google Drive', () => {
  it('no corre solo: hasta que no se aprieta el botón no consulta nada', () => {
    globalThis.fetch = vi.fn();
    render(<DireccionDiagnosticos token="tok-123" />);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    // Desde el FE de C-15/C-16/D-B8 la pantalla lista también las tres
    // migraciones de datos, que arrancan con el mismo cartel: se verifica
    // que NINGUNA corrió sola, no que haya una sola tarjeta.
    expect(screen.getAllByText(/Todavía no se corrió/).length).toBeGreaterThan(0);
  });

  it('llama al endpoint de admin con el token de la sesión', async () => {
    await montarYProbar(OK);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(String(url)).toContain('/api/v1/admin/drive/estado');
    expect(String(url)).toContain('probar_subida=true');
    expect(init.headers.Authorization).toBe('Bearer tok-123');
  });

  it('muestra los destacados y la respuesta completa', async () => {
    await montarYProbar(OK);
    ['escritura_ok', 'client_id', 'service_account_email', 'usuario_impersonado', 'scopes_solicitados']
      .forEach((c) => expect(screen.getAllByText(c).length).toBeGreaterThan(0));
    const crudo = JSON.parse(screen.getByTestId('respuesta-cruda').textContent);
    expect(crudo).toEqual(OK);
  });

  it('con escritura_ok=false muestra el error de Google sin retocar', async () => {
    await montarYProbar(FALLA);
    expect(screen.getByText(/NO pudo escribir en Drive/)).toBeTruthy();
    expect(screen.getByText(FALLA.error)).toBeTruthy();
    expect(screen.getAllByText(/unauthorized_client/).length).toBeGreaterThan(0);
  });

  it('un 403 del pedido se muestra como fallo del diagnóstico, no como "Drive anda mal"', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(respuesta({ detail: 'No autorizado' }, 403)));
    render(<DireccionDiagnosticos token="tok-123" />);
    fireEvent.click(screen.getByRole('button', { name: 'Probar Google Drive' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Error 403');
    expect(screen.queryByTestId('respuesta-cruda')).toBeNull();
  });
});

describe('el bloque crudo nunca imprime un secreto', () => {
  it('recorta las claves sensibles y deja los identificadores públicos', () => {
    const saneado = sanear({
      client_id: '123', service_account_email: 'x@y.z',
      private_key: 'ROBABLE', refresh_token: 'ROBABLE', api_key: 'ROBABLE',
      anidado: { password: 'ROBABLE', scopes_solicitados: ['drive.file'] },
    });
    expect(saneado.client_id).toBe('123');
    expect(saneado.service_account_email).toBe('x@y.z');
    expect(saneado.anidado.scopes_solicitados).toEqual(['drive.file']);
    ['private_key', 'refresh_token', 'api_key'].forEach((k) => expect(saneado[k]).toBe(OCULTO));
    expect(saneado.anidado.password).toBe(OCULTO);
  });

  it('un secreto que devolviera el endpoint no llega a la pantalla', async () => {
    await montarYProbar({ ...OK, access_token: 'ya-fuiste' });
    expect(screen.getByTestId('respuesta-cruda').textContent).not.toContain('ya-fuiste');
  });
});
