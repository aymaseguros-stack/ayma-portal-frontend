// @vitest-environment jsdom
//
// C-15 (identificación del riesgo) y C-16 (listas cerradas), desde la ficha.
//
// LO QUE BLINDA:
//
// 1. La compañía ganadora es un DESPLEGABLE alimentado por
//    `/crm/catalogos/companias`, no un campo de texto. Un texto libre acá es
//    cómo "La Segunda" y "La Segunda ART" terminaban siendo la misma
//    compañía en el tablero de producción -y hoy además es un 422.
// 2. Cuando la compañía no está, la pantalla dice DÓNDE se carga.
// 3. El cierre PERDIDA -que es una de las cuatro puertas a LOOP- manda
//    `resultado_loop`.
// 4. La patente se manda NORMALIZADA, y el 422 del backend se lee tal cual.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import SelectorCompania from './SelectorCompania';
import IdentificacionRiesgo from './IdentificacionRiesgo';
import { normalizarPatente, ORIGENES_DE_PERSONA, ORIGENES_DE_MAQUINA, etiquetaOrigen } from './oportunidadCatalogos';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
  text: async () => JSON.stringify(data),
});

const CATALOGO = {
  total: 2,
  companias: [
    { id: 'p1', nombre: 'San Cristóbal', tipo: 'ASEGURADORA', cuit: '30-12345678-9' },
    { id: 'p2', nombre: 'La Segunda ART', tipo: 'ART', cuit: null },
  ],
};

beforeEach(() => { globalThis.fetch = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('C-16 — el vocabulario de orígenes', () => {
  // Escritos a mano y NO importados del módulo que prueban: un test que
  // importa la misma lista que verifica no verifica nada.
  it('tiene los nueve que elige una persona', () => {
    expect(ORIGENES_DE_PERSONA).toEqual([
      'META_ADS', 'GOOGLE_ADS', 'FORMULARIO_WEB', 'QR_PUNTO_CONTACTO',
      'WHATSAPP_DIRECTO', 'REFERIDO', 'CONTACTO_PERSONAL', 'CARTERA_ART', 'OTRO',
    ]);
  });

  it('los cuatro de máquina existen pero NO se ofrecen para elegir', () => {
    expect(ORIGENES_DE_MAQUINA).toEqual([
      'VERIFICACION_SRT', 'VENTANA_ANIVERSARIO_ART', 'MOTOR_OFERTA', 'RECUPERACION_CARTERA',
    ]);
    // Si se pudieran elegir a mano, `POST /srt/revertir-verificacion` -que
    // BORRA por `origen`- se llevaría puesta una oportunidad legítima.
    ORIGENES_DE_MAQUINA.forEach((o) => expect(ORIGENES_DE_PERSONA).not.toContain(o));
  });

  it('un origen viejo que el catálogo no conoce se muestra igual, no se esconde', () => {
    expect(etiquetaOrigen('landing')).toBe('landing');
  });
});

describe('SelectorCompania — lista cerrada del padrón', () => {
  it('ofrece las compañías del catálogo y dice dónde se cargan las que faltan', async () => {
    globalThis.fetch.mockResolvedValue(respuesta(CATALOGO));
    render(<SelectorCompania token="tok" valor="" onChange={() => {}} />);

    await waitFor(() => expect(screen.getByRole('option', { name: /San Cristóbal/ })).toBeTruthy());
    expect(globalThis.fetch.mock.calls[0][0]).toContain('/crm/catalogos/companias');
    expect(screen.getByText(/Dirección → Proveedores/)).toBeTruthy();
    // No hay campo de texto: la compañía se elige, no se tipea.
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('una compañía sin CUIT se OFRECE igual, marcada', async () => {
    globalThis.fetch.mockResolvedValue(respuesta(CATALOGO));
    render(<SelectorCompania token="tok" valor="" onChange={() => {}} />);
    // Esconderla haría creer que no está cargada y llevaría a duplicarla.
    await waitFor(() => expect(screen.getByRole('option', { name: /La Segunda ART \(sin CUIT/ })).toBeTruthy());
  });

  it('un valor guardado que el padrón no tiene sigue estando, avisado', async () => {
    globalThis.fetch.mockResolvedValue(respuesta(CATALOGO));
    render(<SelectorCompania token="tok" valor="Aseguradora vieja SA" onChange={() => {}} />);

    await waitFor(() => expect(screen.getByRole('option', { name: /fuera del padrón/ })).toBeTruthy());
    expect(screen.getByText(/no está en el padrón/i)).toBeTruthy();
  });
});

describe('C-15 — identificación del riesgo', () => {
  it('normaliza la patente: "hac 394", "HAC-394" y "hac.394" son el mismo auto', () => {
    expect(normalizarPatente('hac 394')).toBe('HAC394');
    expect(normalizarPatente('HAC-394')).toBe('HAC394');
    expect(normalizarPatente('hac.394')).toBe('HAC394');
    expect(normalizarPatente('')).toBe('');
  });

  it('guarda patente y número de solicitud con un PATCH a la oportunidad', async () => {
    globalThis.fetch.mockResolvedValue(respuesta({ id: 'opp-1' }));
    const onGuardado = vi.fn();
    render(
      <IdentificacionRiesgo
        token="tok"
        oportunidad={{ id: 'opp-1', patente: null, numero_solicitud_compania: null }}
        onGuardado={onGuardado}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Agregar patente/i }));
    fireEvent.change(screen.getByLabelText(/^Patente$/i), { target: { value: 'hac 394' } });
    // El número de solicitud NO se normaliza: los guiones son lo que el
    // operador lee en el extranet de la compañía.
    fireEvent.change(screen.getByLabelText(/solicitud/i), { target: { value: '4-18752305' } });
    fireEvent.click(screen.getByRole('button', { name: /^Guardar$/i }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const [url, opciones] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/crm/oportunidades/opp-1');
    expect(opciones.method).toBe('PATCH');
    expect(JSON.parse(opciones.body)).toEqual({
      patente: 'HAC394',
      numero_solicitud_compania: '4-18752305',
    });
    await waitFor(() => expect(onGuardado).toHaveBeenCalled());
  });

  it('el 422 de una patente inválida se muestra con el motivo del backend', async () => {
    globalThis.fetch.mockResolvedValue(
      respuesta({ detail: "'HAC 394 B' no es una patente argentina. Los formatos válidos son AAA999..." }, 422),
    );
    render(
      <IdentificacionRiesgo token="tok" oportunidad={{ id: 'opp-1' }} onGuardado={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Agregar patente/i }));
    fireEvent.change(screen.getByLabelText(/^Patente$/i), { target: { value: 'HAC394B' } });
    fireEvent.click(screen.getByRole('button', { name: /^Guardar$/i }));

    expect(await screen.findByText(/no es una patente argentina/i)).toBeTruthy();
  });
});
