import React, { useState } from 'react';
import { reabrirPropuestaDotacion } from './artCotizacionesApi';
import { motivoReaperturaLabel } from './artCerviConstants';
import { numeroAr } from './artCarteraConstants';
import { fechaCorta, fechaHora } from '../../utils/fechas';

const thClass = 'text-left px-3 py-2 font-medium whitespace-nowrap';
const tdClass = 'px-3 py-2';
const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';
const guion = <span className="text-slate-500">—</span>;

// Solapa "Rechazadas" de la bandeja de @CERVI (ART-95, backend PR #210).
// Un rechazo es una persona diciendo "ese promedio de sector no sirve para
// esta empresa": mientras esté VIGENTE, CERVI no vuelve a proponerla. Si
// dejó de estarlo, el backend dice por qué (`motivo_reapertura`). Acá no se
// deriva nada: vigencia y motivo vienen en la fila.
//
// "Reabrir" (ADMIN) no borra el rechazo: la propuesta sigue RECHAZADA y la
// próxima corrida vuelve a proponer la empresa. Un 409 (no es el último
// rechazo de la empresa, o ya no está RECHAZADA) se muestra con el `detail`
// del backend en la fila, sin esconderlo detrás de un "error". Por eso el
// botón está en todo rechazo que no fue reabierto: quien decide si se puede
// es el backend, no una regla copiada acá.
const ArtDotacionRechazadas = ({ token, filas, loading, esAdmin, onReabierta }) => {
  const [enviando, setEnviando] = useState(null);
  const [resultado, setResultado] = useState({});

  const reabrir = async (p) => {
    setEnviando(p.id);
    try {
      const r = await reabrirPropuestaDotacion(token, p.id);
      setResultado((prev) => ({
        ...prev,
        [p.id]: {
          ok: true,
          texto: r?.cambio === false
            ? 'Ya estaba reabierta: CERVI la vuelve a proponer.'
            : 'Reabierta: la próxima corrida de CERVI vuelve a proponer la empresa.',
        },
      }));
      onReabierta?.();
    } catch (err) {
      setResultado((prev) => ({
        ...prev,
        [p.id]: { ok: false, texto: `${err.status ? `${err.status} · ` : ''}${err.message}` },
      }));
    } finally {
      setEnviando(null);
    }
  };

  const columnas = 7 + (esAdmin ? 1 : 0);

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto">
      <table className="w-full text-sm" aria-label="Rechazadas">
        <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
          <tr>
            <th className={thClass}>Empresa</th>
            <th className={thClass}>CUIT</th>
            <th className={thClass}>Propuesta</th>
            <th className={thClass}>Motivo</th>
            <th className={thClass}>Fecha</th>
            <th className={thClass}>Vigente</th>
            <th className={thClass}>Por qué dejó de estarlo</th>
            {esAdmin && <th className={thClass}>Acción</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/60">
          {loading && (
            <tr><td colSpan={columnas} className="px-3 py-6 text-center text-slate-400">Cargando rechazos…</td></tr>
          )}
          {!loading && filas.length === 0 && (
            <tr><td colSpan={columnas} className="px-3 py-6 text-center text-slate-500">No hay propuestas rechazadas.</td></tr>
          )}
          {!loading && filas.map((p) => {
            const vigente = p.rechazo_vigente === true;
            const res = resultado[p.id];
            return (
              <tr key={p.id} data-testid={`rechazada-${p.id}`} className="hover:bg-slate-700/30">
                <td className={`${tdClass} text-slate-200`}>
                  {p.razon_social || 'Sin razón social'}
                  {res && (
                    <span
                      role={res.ok ? 'status' : 'alert'}
                      className={`block mt-1 text-xs max-w-xs ${res.ok ? 'text-green-300' : 'text-red-300'}`}
                    >
                      {res.texto}
                    </span>
                  )}
                </td>
                <td className={`${tdClass} text-slate-400 whitespace-nowrap`}>{p.cuit || '—'}</td>
                <td className={`${tdClass} text-slate-300 whitespace-nowrap`}>
                  {numeroAr(p.valor_propuesto) ?? guion}
                  {p.dotacion_previa !== null && p.dotacion_previa !== undefined && (
                    <span className="block text-xs text-slate-500">planilla {numeroAr(p.dotacion_previa)}</span>
                  )}
                </td>
                <td className={`${tdClass} text-slate-300 max-w-xs`}>{p.motivo_rechazo || guion}</td>
                <td className={`${tdClass} text-slate-300 whitespace-nowrap`}>
                  {fechaCorta(p.resuelto_en) || guion}
                  {p.resuelto_por && <span className="block text-xs text-slate-500">{p.resuelto_por}</span>}
                </td>
                <td className={tdClass}>
                  {p.rechazo_vigente === null || p.rechazo_vigente === undefined ? guion : (
                    <span
                      className={`${badgeBase} ${vigente ? 'bg-red-500/20 text-red-300' : 'bg-slate-500/30 text-slate-300'}`}
                      title={vigente ? 'CERVI no vuelve a proponer esta empresa.' : 'CERVI puede volver a proponer esta empresa.'}
                      data-testid={`vigente-${p.id}`}
                    >
                      {vigente ? 'Sí' : 'No'}
                    </span>
                  )}
                </td>
                <td className={`${tdClass} text-slate-300`}>
                  {vigente || !p.motivo_reapertura ? guion : (
                    <>
                      {motivoReaperturaLabel(p.motivo_reapertura)}
                      {p.reabierta_en && (
                        <span className="block text-xs text-slate-500">
                          {fechaHora(p.reabierta_en) || fechaCorta(p.reabierta_en)}
                          {p.reabierta_por ? ` · ${p.reabierta_por}` : ''}
                        </span>
                      )}
                    </>
                  )}
                </td>
                {esAdmin && (
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {p.motivo_reapertura !== 'REABIERTA' ? (
                      <button
                        type="button"
                        disabled={enviando !== null}
                        onClick={() => reabrir(p)}
                        className="px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-500 text-xs disabled:opacity-50"
                      >
                        {enviando === p.id ? 'Reabriendo…' : 'Reabrir'}
                      </button>
                    ) : guion}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ArtDotacionRechazadas;
