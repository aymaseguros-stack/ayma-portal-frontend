import React, { useEffect, useState } from 'react';
import { listarTandas, obtenerTanda } from './artCotizacionesApi';
import { ESTADO_PAR, TIPO_RESPUESTA, canalLabel } from './artCotizacionesConstants';
import { aseguradoraLabel, decimalAr } from './artCarteraConstants';
import { fechaCorta } from '../../utils/fechas';

const thClass = 'text-left px-3 py-2 font-medium whitespace-nowrap';
const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';

export const BadgeEstadoPar = ({ estado }) => {
  const e = ESTADO_PAR[estado];
  return <span className={`${badgeBase} ${e?.clase || 'bg-slate-600/40 text-slate-300'}`}>{e?.label || estado || '—'}</span>;
};

export const TextoRespuesta = ({ respuesta }) => {
  if (!respuesta) return <span className="text-slate-500">—</span>;
  const t = TIPO_RESPUESTA[respuesta.tipo];
  const partes = [t?.label || respuesta.tipo];
  if (respuesta.alicuota !== null && respuesta.alicuota !== undefined) partes.push(`${decimalAr(respuesta.alicuota)}%`);
  if (respuesta.motivo) partes.push(respuesta.motivo);
  if (respuesta.productor_bloqueante) partes.push(respuesta.productor_bloqueante);
  if (respuesta.abierta) partes.push('en revisión');
  return <span className="text-slate-300">{partes.join(' · ')}</span>;
};

// Detalle de una tanda: por empresa y por par, con el estado DERIVADO por
// el backend. No se edita nada acá: es "qué se mandó y a dónde".
const DetalleTanda = ({ token, tandaId, onVolver }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    obtenerTanda(token, tandaId)
      .then((r) => { if (!cancelado) setData(r); })
      .catch((err) => { if (!cancelado) setError(err.message); });
    return () => { cancelado = true; };
  }, [token, tandaId]);

  return (
    <div className="space-y-4">
      <button type="button" onClick={onVolver} className="text-sm text-blue-400 hover:text-blue-300">← Volver a las tandas</button>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-400">Cargando tanda…</p>}
      {data && (
        <>
          <div>
            <h3 className="text-lg font-semibold">
              Tanda #{data.id} · {canalLabel(data.canal)} · enviada el {fechaCorta(data.fecha_envio)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {data.enviadas} enviadas · {data.devueltas} devueltas · {data.faltan} faltan ·{' '}
              <span className={data.sin_respuesta > 0 ? 'text-red-300' : ''}>{data.sin_respuesta} sin respuesta</span>
              {' · '}{data.dias_desde_envio} días desde el envío (SLA {data.dias_sla} días)
            </p>
            {data.nota && <p className="text-xs text-slate-500 mt-1">{data.nota}</p>}
          </div>
          {(data.empresas || []).map((emp) => (
            <section key={emp.empresa_id} className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-2">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <h4 className="font-semibold text-slate-200">{emp.razon_social || emp.cuit || emp.empresa_id}</h4>
                <span className="text-xs text-slate-400">
                  CUIT {emp.cuit || '—'} · {emp.enviadas} enviadas · {emp.devueltas} devueltas · {emp.faltan} faltan
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className={thClass}>Aseguradora</th>
                      <th className={thClass}>Pedida</th>
                      <th className={thClass}>Días</th>
                      <th className={thClass}>Estado</th>
                      <th className={thClass}>Respuesta</th>
                      <th className={thClass}>Propuesta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {(emp.pares || []).map((p) => (
                      <tr key={p.evento_id} className={p.estado === 'SIN_RESPUESTA' ? 'bg-red-500/10' : ''}>
                        <td className="px-3 py-2 text-slate-200">{aseguradoraLabel(p.aseguradora)}</td>
                        <td className="px-3 py-2 text-slate-300">{fechaCorta(p.fecha_pedido)}</td>
                        <td className="px-3 py-2 text-slate-300">{p.dias_desde_pedido} d</td>
                        <td className="px-3 py-2"><BadgeEstadoPar estado={p.estado} /></td>
                        <td className="px-3 py-2"><TextoRespuesta respuesta={p.respuesta} /></td>
                        <td className="px-3 py-2 text-slate-300">
                          {p.propuesta
                            ? `v${p.propuesta.version} · ${p.propuesta.estado}${p.propuesta.fecha_entrega ? ` · ${fechaCorta(p.propuesta.fecha_entrega)}` : ''}`
                            : <span className="text-slate-500">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
};

// VISTA 2 - Tandas (GET /art/tandas). Enviadas / devueltas / faltan / sin
// respuesta y los días desde el envío contra el SLA del canal: todo viene
// del backend. Una tanda con pares SIN_RESPUESTA se resalta.
const ArtTandasBoard = ({ token }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tandaAbierta, setTandaAbierta] = useState(null);

  useEffect(() => {
    let cancelado = false;
    listarTandas(token)
      .then((r) => { if (!cancelado) setData(r); })
      .catch((err) => { if (!cancelado) setError(err.message); });
    return () => { cancelado = true; };
  }, [token]);

  if (tandaAbierta !== null) {
    return <DetalleTanda token={token} tandaId={tandaAbierta} onVolver={() => setTandaAbierta(null)} />;
  }

  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
            <tr>
              <th className={thClass}>Tanda</th>
              <th className={thClass}>Canal</th>
              <th className={thClass}>Envío</th>
              <th className={thClass}>Enviadas</th>
              <th className={thClass}>Devueltas</th>
              <th className={thClass}>Faltan</th>
              <th className={thClass}>Sin respuesta</th>
              <th className={thClass}>Empresas</th>
              <th className={thClass}>Días / SLA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {!data && !error && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Cargando tandas…</td></tr>}
            {data && items.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">Todavía no hay tandas.</td></tr>
            )}
            {items.map((t) => (
              <tr key={t.id} className={t.sin_respuesta > 0 ? 'bg-red-500/10' : 'hover:bg-slate-700/30'}>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => setTandaAbierta(t.id)} className="text-blue-400 hover:text-blue-300 font-medium">
                    #{t.id}
                  </button>
                </td>
                <td className="px-3 py-2 text-slate-200">{canalLabel(t.canal)}</td>
                <td className="px-3 py-2 text-slate-300">{fechaCorta(t.fecha_envio)}</td>
                <td className="px-3 py-2">{t.enviadas}</td>
                <td className="px-3 py-2">{t.devueltas}</td>
                <td className="px-3 py-2">{t.faltan}</td>
                <td className={`px-3 py-2 ${t.sin_respuesta > 0 ? 'text-red-300 font-medium' : ''}`}>{t.sin_respuesta}</td>
                <td className="px-3 py-2">{t.empresas}</td>
                <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{t.dias_desde_envio} d / SLA {t.dias_sla} d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArtTandasBoard;
