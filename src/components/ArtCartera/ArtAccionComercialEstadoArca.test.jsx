// @vitest-environment jsdom
//
// OPERACIONES-0011 · ART-111 B3 en Acción comercial: el chip ámbar de
// `alerta_arca` (INCUMPLIMIENTOS sigue en la lista), `descartadas_estado_arca`
// junto a las otras descartadas del resumen, y la cola de relevamiento con
// el chip del estado excluyente (rojo) en las filas ESTADO_ARCA.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ArtAccionComercialBoard from './ArtAccionComercialBoard';

afterEach(cleanup);
beforeEach(() => { vi.restoreAllMocks(); });

const filaLista = (over = {}) => ({
  empresa_id: 'e1', cuit: '30-71000001-7', razon_social: 'ACME SA',
  fecha_vencimiento: '2026-10-15', dias_a_vencimiento: 31, dias_a_ventana: -59,
  dotacion: 40, dotacion_fuente: 'SRT', alicuota_actual: 8.5,
  alicuota_actual_fuente: 'SRT_VENTANILLA', alicuota_actual_verificada: true,
  elegible_traspaso: true, via_colocacion: 'PROPIO', companias_descartadas_no_colocables: [],
  ...over,
});

const RELEVAMIENTO = {
  total: 2,
  items: [
    {
      empresa_id: 'r1', cuit: '30-70000001-1', razon_social: 'FISCAL SA',
      fecha_vencimiento: '2026-11-01', motivo: 'ESTADO_ARCA', accion_sugerida: 'Revisar',
      estado_arca: 'BAJA_OFICIO', estado_arca_fuente: 'PADRON_A5',
      estado_arca_fecha: '2026-09-20', estado_arca_nota: 'b) CLAVE SE ENCUENTRA PASIVA',
    },
    {
      empresa_id: 'r2', cuit: '30-70000002-2', razon_social: 'SINCIIU SA',
      fecha_vencimiento: '2026-11-02', motivo: 'SIN_CIIU', accion_sugerida: 'Cargar CIIU',
    },
  ],
  resumen: { por_motivo: { ESTADO_ARCA: 1, SIN_CIIU: 1, NO_COTIZAR: 0 } },
};

const mock = (items, resumen = {}) => {
  globalThis.fetch = vi.fn(async (url) => {
    if (String(url).includes('/relevamiento')) return { ok: true, status: 200, json: async () => RELEVAMIENTO };
    return {
      ok: true, status: 200,
      json: async () => ({ total: items.length, items, resumen: { cobertura_verificacion: 10, ...resumen } }),
    };
  });
};

describe('Acción comercial · estado ARCA', () => {
  it('alerta_arca: chip ámbar "Incumplimientos ARCA" con fuente, fecha y nota en el tooltip', async () => {
    mock([filaLista({
      alerta_arca: { estado: 'INCUMPLIMIENTOS', fuente: 'PADRON_A5', fecha: '2026-09-21', nota: 'e) REQUERIMIENTOS' },
    })]);
    render(<ArtAccionComercialBoard token="t" />);
    await screen.findByText('ACME SA');
    const chip = screen.getByTestId('chip-estado-arca');
    expect(chip.textContent).toBe('Incumplimientos ARCA');
    expect(chip.className).toContain('amber');
    expect(chip.getAttribute('title')).toContain('Padrón A5');
    expect(chip.getAttribute('title')).toContain('21/9/2026');
    expect(chip.getAttribute('title')).toContain('e) REQUERIMIENTOS');
  });

  it('sin alerta_arca no hay chip', async () => {
    mock([filaLista({ alerta_arca: null })]);
    render(<ArtAccionComercialBoard token="t" />);
    await screen.findByText('ACME SA');
    expect(screen.queryByTestId('chip-estado-arca')).toBeNull();
  });

  it('el resumen muestra descartadas_estado_arca junto a las otras descartadas', async () => {
    mock([filaLista()], { descartadas_estado_arca: 4, descartadas_sin_ciiu: 7, descartadas_no_cotizar: 0 });
    render(<ArtAccionComercialBoard token="t" />);
    const linea = await screen.findByTestId('resumen-descartadas');
    expect(linea.textContent).toContain('4 situación fiscal ARCA');
    expect(linea.textContent).toContain('7 sin CIIU');
    expect(linea.textContent).not.toContain('no cotizar');
  });

  it('relevamiento: se pide al abrir; ESTADO_ARCA con texto en español y chip rojo', async () => {
    mock([filaLista()]);
    render(<ArtAccionComercialBoard token="t" />);
    await screen.findByText('ACME SA');
    expect(globalThis.fetch.mock.calls.some(([u]) => String(u).includes('/relevamiento'))).toBe(false);

    fireEvent.click(screen.getByText(/Fuera de la lista: cola de relevamiento/));
    await screen.findByText('FISCAL SA');
    expect(screen.getByText('Excluida: situación fiscal en ARCA')).toBeTruthy();
    const chips = screen.getAllByTestId('chip-estado-arca');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toContain('Baja de oficio');
    expect(chips[0].textContent).toContain('Padrón A5');
    expect(chips[0].className).toContain('red');
    expect(chips[0].getAttribute('title')).toContain('CLAVE SE ENCUENTRA PASIVA');
    expect(screen.getByText('Sin CIIU')).toBeTruthy();
  });
});
