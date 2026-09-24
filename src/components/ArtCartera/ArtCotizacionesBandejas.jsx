import React, { useCallback, useEffect, useState } from 'react';
import { listarPropuestasDotacion, listarTandas, obtenerBandejaCotizaciones } from './artCotizacionesApi';
import {
  CANALES_TANDA,
  ESTADO_PAR,
  ETAPAS_BANDEJA,
  ETAPAS_CON_RESPUESTA_PENDIENTE,
  RESPUESTAS_FILTRO,
  TIPO_RESPUESTA,
  canalLabel,
  slaVencido,
} from './artCotizacionesConstants';
import { ASEGURADORAS_ART, aseguradoraLabel, decimalAr, numeroAr } from './artCarteraConstants';
import { fechaCorta } from '../../utils/fechas';
import ArtRespuestaCotizacionModal from './ArtRespuestaCotizacionModal';
import ArtDotacionPropuestas from './ArtDotacionPropuestas';

const labelClass = 'block text-slate-400 text-xs mb-1';
const selectClass = 'px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';
const thClass = 'text-left px-3 py-2 font-medium whitespace-nowrap';
const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';

const solapaClass = (activa) => `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
  activa ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
}`;

const CeldaRespuesta = ({ fila }) => {
  const r = fila.respuesta;
  if (!r) return <span className="text-slate-500">—</span>;
  const tipo = TIPO_RESPUESTA[r.tipo];
  return (
    <div className="space-y-0.5">
      <span className={`${badgeBase} ${tipo?.clase || 'bg-slate-600/40 text-slate-300'}`}>
        {tipo?.label || r.tipo}{r.abierta ? ' · en revisión' : ''}
      </span>
      {r.motivo && <span className="block text-xs text-slate-400">{r.motivo}</span>}
      {r.productor_bloqueante && <span className="block text-xs text-slate-400">{r.productor_bloqueante}</span>}
    </div>
  );
};

// VISTA 1 - Bandejas (GET /art/cotizaciones/bandeja). Cinco solapas con el
// contador que manda el backend en `resumen.por_etapa` (con todos los
// filtros menos la etapa), una fila por par empresa-aseguradora. El SLA
// vencido es el estado SIN_RESPUESTA del par: lo decide el backend.
const ArtCotizacionesBandejas = ({ token }) => {
  const [etapa, setEtapa] = useState('PEDIDA');
  const [canal, setCanal] = useState('');
  const [tandaId, setTandaId] = useState('');
  const [aseguradora, setAseguradora] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [data, setData] = useState(null);
  const [tandas, setTandas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [parRespuesta, setParRespuesta] = useState(null);
  const [aviso, setAviso] = useState(null);
  // La bandeja "Dotación propuesta" (@CERVI, OPERACIONES-0009) no es una
  // etapa del circuito: es una solapa más que reemplaza filtros y tabla.
  const [dotacion, setDotacion] = useState(false);
  const [nDotacion, setNDotacion] = useState(null);
  const [recargaDotacion, setRecargaDotacion] = useState(0);
  const refrescarDotacion = useCallback(() => setRecargaDotacion((n) => n + 1), []);

  // El filtro de respuesta sólo existe en Recibidas.
  const respuestaEfectiva = etapa === 'RECIBIDA' ? respuesta : '';

  useEffect(() => {
    let cancelado = false;
    listarTandas(token)
      .then((r) => { if (!cancelado) setTandas(Array.isArray(r?.items) ? r.items : []); })
      .catch(() => { /* el filtro de tanda queda vacío; la bandeja carga igual */ });
    return () => { cancelado = true; };
  }, [token]);

  // (n) = PENDIENTE de los dos grupos, de `por_revision` del backend.
  useEffect(() => {
    let cancelado = false;
    listarPropuestasDotacion(token, { limit: 1 })
      .then((r) => {
        if (cancelado) return;
        const pr = r?.por_revision;
        setNDotacion(pr ? (pr.lote ?? 0) + (pr.individual ?? 0) : (r?.total ?? null));
      })
      .catch(() => { if (!cancelado) setNDotacion(null); });
    return () => { cancelado = true; };
  }, [token, recargaDotacion]);

  useEffect(() => {
    if (dotacion) return undefined;
    let cancelado = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await obtenerBandejaCotizaciones(token, {
          etapa, canal, tanda_id: tandaId, aseguradora, respuesta: respuestaEfectiva,
        });
        if (!cancelado) setData(r);
      } catch (err) {
        if (!cancelado) { setError(err.message); setData(null); }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [token, etapa, canal, tandaId, aseguradora, respuestaEfectiva, recarga, dotacion]);

  const items = Array.isArray(data?.items) ? data.items : [];
  const porEtapa = data?.resumen?.por_etapa || {};
  const conAccion = ETAPAS_CON_RESPUESTA_PENDIENTE.includes(etapa);
  const columnas = conAccion ? 10 : 9;

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 flex-wrap" aria-label="Bandejas">
        {ETAPAS_BANDEJA.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => { setDotacion(false); setEtapa(e.id); }}
            className={solapaClass(!dotacion && etapa === e.id)}
            aria-pressed={!dotacion && etapa === e.id}
          >
            {e.label}
            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-slate-900/60" data-testid={`contador-${e.id}`}>
              {porEtapa[e.id] ?? '—'}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDotacion(true)}
          className={solapaClass(dotacion)}
          aria-pressed={dotacion}
        >
          Dotación propuesta
          <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-slate-900/60" data-testid="contador-DOTACION">
            {nDotacion ?? '—'}
          </span>
        </button>
      </nav>

      {dotacion && <ArtDotacionPropuestas token={token} onCambio={refrescarDotacion} />}

      {!dotacion && (<>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex items-end gap-4 flex-wrap">
        <div>
          <label className={labelClass} htmlFor="bj-canal">Canal</label>
          <select id="bj-canal" className={selectClass} value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="">Todos</option>
            {CANALES_TANDA.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="bj-tanda">Tanda</label>
          <select id="bj-tanda" className={selectClass} value={tandaId} onChange={(e) => setTandaId(e.target.value)}>
            <option value="">Todas</option>
            {tandas.map((t) => (
              <option key={t.id} value={t.id}>#{t.id} · {canalLabel(t.canal)} · {fechaCorta(t.fecha_envio)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="bj-aseg">Aseguradora</label>
          <select id="bj-aseg" className={selectClass} value={aseguradora} onChange={(e) => setAseguradora(e.target.value)}>
            <option value="">Todas</option>
            {ASEGURADORAS_ART.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        {etapa === 'RECIBIDA' && (
          <div>
            <label className={labelClass} htmlFor="bj-resp">Respuesta</label>
            <select id="bj-resp" className={selectClass} value={respuesta} onChange={(e) => setRespuesta(e.target.value)}>
              <option value="">Todas</option>
              {RESPUESTAS_FILTRO.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {aviso && (
        <p role="status" className="text-sm text-green-300 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
          {aviso}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
            <tr>
              <th className={thClass}>Empresa</th>
              <th className={thClass}>CUIT</th>
              <th className={thClass}>Aseguradora</th>
              <th className={thClass}>Canal</th>
              <th className={thClass}>Tanda</th>
              <th className={thClass}>Fecha</th>
              <th className={thClass}>Días en la etapa</th>
              <th className={thClass}>Respuesta</th>
              <th className={thClass}>Alícuota</th>
              {conAccion && <th className={thClass}>Acción</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {loading && (
              <tr><td colSpan={columnas} className="px-3 py-6 text-center text-slate-400">Cargando bandeja…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={columnas} className="px-3 py-6 text-center text-slate-500">Nada en esta bandeja con estos filtros.</td></tr>
            )}
            {!loading && items.map((f) => {
              const vencido = slaVencido(f);
              return (
                <tr
                  key={f.evento_id}
                  data-sla-vencido={vencido ? 'true' : 'false'}
                  className={vencido ? 'bg-red-500/10' : 'hover:bg-slate-700/30'}
                >
                  <td className="px-3 py-2 text-slate-200">
                    {f.razon_social || 'Sin razón social'}
                    {vencido && (
                      <span className={`${badgeBase} block w-fit mt-1 ${ESTADO_PAR.SIN_RESPUESTA.clase}`} title={`SLA ${f.dias_sla} días`}>
                        SLA vencido
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{f.cuit || '—'}</td>
                  <td className="px-3 py-2 text-slate-200">{aseguradoraLabel(f.aseguradora)}</td>
                  <td className="px-3 py-2 text-slate-300">{canalLabel(f.canal)}</td>
                  <td className="px-3 py-2 text-slate-300">{f.tanda_id ? `#${f.tanda_id}` : <span className="text-slate-500">suelto</span>}</td>
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                    {fechaCorta(f.fecha_etapa || f.fecha_pedido) || '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {f.dias_en_etapa === null || f.dias_en_etapa === undefined
                      ? <span className="text-slate-500" title="La decisión del cliente no tiene fecha guardada">sin fecha</span>
                      : `${f.dias_en_etapa} d`}
                  </td>
                  <td className="px-3 py-2"><CeldaRespuesta fila={f} /></td>
                  <td className="px-3 py-2 text-slate-200 whitespace-nowrap">
                    {f.alicuota === null || f.alicuota === undefined ? <span className="text-slate-500">—</span> : `${decimalAr(f.alicuota)}%`}
                  </td>
                  {conAccion && (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => { setAviso(null); setParRespuesta(f); }}
                        className="px-2 py-1 rounded bg-blue-600/80 hover:bg-blue-500 text-xs whitespace-nowrap"
                      >
                        Cargar respuesta
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!loading && data && (
        <p className="text-xs text-slate-500">
          {numeroAr(items.length)} de {numeroAr(data.total ?? items.length)} pares en la bandeja.
        </p>
      )}
      </>)}

      {parRespuesta && (
        <ArtRespuestaCotizacionModal
          token={token}
          par={parRespuesta}
          onCerrar={() => setParRespuesta(null)}
          onRegistrada={(r) => {
            setParRespuesta(null);
            setAviso(`Respuesta registrada para ${r?.razon_social || 'la empresa'} · ${aseguradoraLabel(r?.aseguradora)}.`);
            setRecarga((n) => n + 1);
          }}
        />
      )}
    </div>
  );
};

export default ArtCotizacionesBandejas;
