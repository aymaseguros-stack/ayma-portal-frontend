// @vitest-environment jsdom
//
// Tests de la tabla de leads del panel admin (T19).
//
// EL BUG QUE CIERRAN: dos template literals escritos con `\${` en vez de
// `${`. En JS `\$` es un escape que produce el caracter '$' literal, así
// que la interpolación nunca ocurría y el texto crudo "${ ... }" llegaba
// tal cual al DOM. No rompía el build ni tiraba un error en consola - se
// veía como dos cosas que "no funcionan":
//
//   1. el badge de estado salía SIN color (ninguna clase de Tailwind
//      matcheaba) y los cuatro estados se veían idénticos, justo en la
//      columna que se mira para saber a quién hay que llamar;
//   2. el botón de WhatsApp abría literalmente "https://wa.me/${lead.telefono}"
//      - una pestaña en blanco con un error de wa.me - en vez del chat con
//      el lead, que es la vía principal de contacto de esta pantalla.
//
// Por eso los tests miran la CLASE resuelta y la URL exacta: un assert
// sobre el texto visible pasaba igual con el bug puesto.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import AdminPanel from './AdminDashboard';

// El dashboard ejecutivo es la vista por default y trae sus propios fetches;
// acá se prueba la tabla de leads, no él.
vi.mock('./DashboardEjecutivo', () => ({
  default: () => <div>dashboard ejecutivo</div>,
}));

afterEach(cleanup);

const lead = (extra = {}) => ({
  id: 1,
  nombre: 'Juan Pérez',
  telefono: '5493411234567',
  tipo_seguro: 'automotor',
  estado: 'nuevo',
  created_at: '2026-09-10T12:00:00Z',
  ...extra,
});

// cargarDatos() pega a cuatro endpoints; sólo importa el de leads.
const mockFetchConLeads = (leads) => vi.fn(async (url) => ({
  ok: true,
  status: 200,
  json: async () => (String(url).includes('/leads/') ? leads : []),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.localStorage.setItem('token', 'tok');
});

const abrirLeads = async () => {
  render(<AdminPanel />);
  await waitFor(() => expect(screen.getByText('Leads')).toBeTruthy());
  fireEvent.click(screen.getByText('Leads'));
};

describe('AdminPanel - tabla de leads (T19)', () => {
  it('el badge de estado resuelve su color y no deja el literal `${}`', async () => {
    globalThis.fetch = mockFetchConLeads([
      lead({ id: 1, estado: 'nuevo', nombre: 'Nuevo SA' }),
      lead({ id: 2, estado: 'contactado', nombre: 'Contactado SA' }),
      lead({ id: 3, estado: 'convertido', nombre: 'Convertido SA' }),
      lead({ id: 4, estado: 'perdido', nombre: 'Perdido SA' }),
    ]);
    await abrirLeads();

    await waitFor(() => expect(screen.getByText('nuevo')).toBeTruthy());
    expect(screen.getByText('nuevo').className).toContain('bg-yellow-100');
    expect(screen.getByText('contactado').className).toContain('bg-blue-100');
    expect(screen.getByText('convertido').className).toContain('bg-green-100');
    // Cualquier estado no previsto cae al gris del default.
    expect(screen.getByText('perdido').className).toContain('bg-gray-100');
    // El síntoma directo del escape: el ternario entero como nombre de clase.
    expect(screen.getByText('nuevo').className).not.toContain('${');
  });

  it('WhatsApp abre el chat del lead, no la URL con el placeholder', async () => {
    globalThis.fetch = mockFetchConLeads([lead()]);
    globalThis.open = vi.fn();
    await abrirLeads();

    await waitFor(() => expect(screen.getByTitle('WhatsApp')).toBeTruthy());
    fireEvent.click(screen.getByTitle('WhatsApp'));

    expect(globalThis.open).toHaveBeenCalledWith('https://wa.me/5493411234567', '_blank');
  });

  it('sin leads muestra el vacío en vez de una tabla pelada', async () => {
    globalThis.fetch = mockFetchConLeads([]);
    await abrirLeads();
    await waitFor(() => expect(screen.getByText('No hay leads registrados')).toBeTruthy());
  });
});
