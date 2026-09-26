import React, { useCallback, useState } from 'react';
import { obtenerRelevamientoAccionComercial } from './artCarteraApi';
import { numeroAr } from './artCarteraConstants';
import ChipEstadoArca from './ChipEstadoArca';
import { MOTIVO_RELEVAMIENTO_LABEL } from './estadoArcaConstants';
import { fechaCorta } from '../../utils/fechas';

// La cola de relevamiento (GET /art/accion-comercial/relevamiento) dentro de
// la pantalla de Acción comercial: la navegación está congelada, así que no
// es una ruta propia sino un panel plegable debajo del resumen. Se pide
// recién al abrirlo. Nada se calcula acá: motivo, acción y estado ARCA
// vienen en la fila.
const ArtRelevamientoExcluidas = ({ token, diasVentana }) => {
  const [abierto, setAbierto] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setData(await obtenerRelevamientoAccionComercial(token, { dias_ventana: diasVentana }));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [token, diasVentana]);

  const alternar = () => {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (siguiente && !data && !cargando) cargar();
  };

  const items = data?.items || [];

  return (
    <div className="bg-slate-800/40 rounded-xl border border-slate-700">
      <button
        type="button"
        onClick={alternar}
        className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700/30 rounded-xl"
        aria-expanded={abierto}
      >
        {abierto ? '▾' : '▸'} Fuera de la lista: cola de relevamiento
        {data ? ` (${numeroAr(data.total)})` : ''}
      </button>
      {abierto && (
        <div className="px-4 pb-4">
          {cargando && <p className="text-xs text-slate-500">Cargando…</p>}
          {error && <p className="text-xs text-red-300">{error}</p>}
          {!cargando && !error && data && items.length === 0 && (
            <p className="text-xs text-slate-500">No hay empresas en relevamiento.</p>
          )}
          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500 text-left">
                  <tr>
                    <th className="px-2 py-1.5">Empresa</th>
                    <th className="px-2 py-1.5">Vence</th>
                    <th className="px-2 py-1.5">Motivo</th>
                    <th className="px-2 py-1.5">Acción sugerida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {items.map((fila) => (
                    <tr key={fila.empresa_id} data-testid="fila-relevamiento">
                      <td className="px-2 py-1.5 text-slate-200">
                        {fila.razon_social || fila.cuit}
                        <span className="block text-slate-500 font-mono">{fila.cuit}</span>
                      </td>
                      <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">
                        {fechaCorta(fila.fecha_vencimiento) || '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-slate-300">
                          {MOTIVO_RELEVAMIENTO_LABEL[fila.motivo] || fila.motivo}
                        </span>
                        {fila.motivo === 'ESTADO_ARCA' && (
                          <span className="block mt-1">
                            <ChipEstadoArca
                              estado={fila.estado_arca}
                              fuente={fila.estado_arca_fuente}
                              fecha={fila.estado_arca_fecha}
                              nota={fila.estado_arca_nota}
                              conDetalle
                            />
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-slate-400">{fila.accion_sugerida}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.total > items.length && (
                <p className="text-[11px] text-slate-500 mt-2">
                  Se muestran {numeroAr(items.length)} de {numeroAr(data.total)}.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ArtRelevamientoExcluidas;
