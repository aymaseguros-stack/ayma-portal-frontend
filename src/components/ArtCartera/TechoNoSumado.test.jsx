// @vitest-environment jsdom
//
// Renglón "Techo no sumado (masa BAJA)" - tramo `sin_comision` (backend #220).
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TechoNoSumado from './TechoNoSumado';

afterEach(cleanup);

const base = { cantidad: 44, suma_comision_actual: '1981800000', suma_comision_oferta: null };

describe('TechoNoSumado - sin_comision', () => {
  it('con sin_comision > 0 agrega el tramo "N sin dato"', () => {
    render(<TechoNoSumado techo={{ ...base, sin_comision: 68 }} />);
    const renglon = screen.getByTestId('techo-no-sumado');
    expect(renglon.textContent).toContain('44 empresas');
    expect(renglon.textContent).toMatch(/ · 68 sin dato \(falta alícuota o masa\)$/);
  });

  it('con sin_comision 0 o ausente no agrega el tramo', () => {
    render(<TechoNoSumado techo={{ ...base, sin_comision: 0 }} />);
    expect(screen.getByTestId('techo-no-sumado').textContent).not.toContain('sin dato');
    cleanup();
    render(<TechoNoSumado techo={base} />);
    expect(screen.getByTestId('techo-no-sumado').textContent).not.toContain('sin dato');
  });
});
