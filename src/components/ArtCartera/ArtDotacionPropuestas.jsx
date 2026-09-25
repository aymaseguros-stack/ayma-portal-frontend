import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../Modal';
import {
  aceptarLotePropuestasDotacion,
  aceptarPropuestaDotacion,
  listarTodasPropuestasDotacion,
  obtenerCiiuSinCuadro,
  obtenerMetricaCervi,
  rechazarPropuestaDotacion,
} from './artCotizacionesApi';
import {
  ETIQUETA_CLANAE97,
  alertaInfo,
  datosPropuesta,
  enNomencladorClae,
  pctDosDecimales,
  planAceptacion,
  resultadoInfo,
  textoError,
  valorValido,
} from './artCerviConstants';
import { buscarCiiu, MAX_RESULTADOS_CIIU } from './artCarteraApi';
import { decimalAr, numeroAr } from './artCarteraConstants';
import { useEsAdmin } from '../../utils/sesion';
import ArtCorridaCerviModal from './ArtCorridaCerviModal';
import ArtDotacionRechazadas from './ArtDotacionRechazadas';

const thClass = 'text-left px-3 py-2 font-medium whitespace-nowrap';
const tdClass = 'px-3 py-2';
const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';
const inputNum = 'w-20 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm';

const grupoClass = (activo) => `px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
  activo ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
}`;

const guion = <span className="text-slate-500">—</span>;

const Alertas = ({ alertas }) => {
  if (!alertas?.length) return guion;
  return (
    <div className="flex flex-wrap gap-1">
      {alertas.map((a) => {
        const info = alertaInfo(a);
        return (
          <span key={a} className={`${badgeBase} ${info.clase}`} title={a} data-alerta={info.codigo}>
            {info.label}{info.detalle ? ` ${info.detalle}` : ''}
          </span>
        );
      })}
    </div>
  );
};

const Resultado = ({ r }) => {
  if (!r) return null;
  const info = resultadoInfo(r.resultado);
  return (
    <span className="block mt-1 space-y-0.5" data-testid="resultado-fila">
      <span className={`${badgeBase} ${info.clase}`}>{info.label}</span>
      {r.detalle && <span className="block text-xs text-slate-400 max-w-xs">{r.detalle}</span>}
    </span>
  );
};

// Celdas comunes a los dos grupos (empresa ... tramo), en el orden del pedido.
const CeldasDatos = ({ p }) => {
  const d = datosPropuesta(p);
  return (
    <>
      <td className={`${tdClass} text-slate-400 whitespace-nowrap`}>{p.cuit || '—'}</td>
      <td className={`${tdClass} text-slate-300 whitespace-nowrap`}>
        {d.venceEnDias === null ? guion : `${numeroAr(d.venceEnDias)} d`}
      </td>
      <td className={`${tdClass} text-slate-300`}>{d.ciiu || guion}</td>
      <td className={`${tdClass} text-slate-200 whitespace-nowrap`}>
        {p.dotacion_previa === null || p.dotacion_previa === undefined ? guion : numeroAr(p.dotacion_previa)}
        <span className="block text-xs text-slate-500">{p.fuente_previa || 'sin fuente'}</span>
      </td>
      <td className={`${tdClass} text-slate-300 whitespace-nowrap`} title={d.versionCuadro ? `Cuadro 1 ${d.versionCuadro}` : undefined}>
        {d.promSector === null ? guion : decimalAr(d.promSector)}
      </td>
      <td className={`${tdClass} text-slate-300 whitespace-nowrap`}>{d.ratio === null ? guion : `×${decimalAr(d.ratio)}`}</td>
    </>
  );
};

const CeldaTramo = ({ p }) => {
  const d = datosPropuesta(p);
  if (!d.tramoPrevio && !d.tramoNuevo) return <td className={tdClass}>{guion}</td>;
  return (
    <td className={`${tdClass} text-slate-300 whitespace-nowrap`}>
      {d.tramoPrevio || 'sin tramo'} → {d.tramoNuevo || 'sin tramo'}
    </td>
  );
};

// Rechazo: el motivo es obligatorio (RechazarPropuestaRequest.motivo).
const RechazoModal = ({ propuesta, onCerrar, onConfirmar }) => {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    if (!motivo.trim()) { setError('El motivo es obligatorio.'); return; }
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar(motivo.trim());
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };
  return (
    <Modal title={`Rechazar propuesta · ${propuesta.razon_social || propuesta.cuit || ''}`} onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-3" aria-label="Rechazar propuesta">
        <p className="text-sm text-slate-300">
          No toca la empresa: la dotación queda como está. Otras propuestas pendientes de la misma empresa caducan.
        </p>
        <div>
          <label className="block text-slate-400 text-xs mb-1" htmlFor="rech-motivo">Motivo (obligatorio)</label>
          <textarea
            id="rech-motivo"
            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="px-3 py-2 rounded-lg bg-slate-700 text-sm">Cancelar</button>
          <button type="submit" disabled={enviando} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium disabled:opacity-50">
            {enviando ? 'Rechazando…' : 'Rechazar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Bandeja "Dotación propuesta" (@CERVI, OPERACIONES-0009 · ART-93). El
// worker propone por promedio sectorial y una persona confirma (D-OP9-1).
// Dos grupos según `requiere_revision_individual`, que deriva el backend
// (ART-92): el lote nunca incluye a los grandes. Ningún número se calcula
// acá: métrica, ratio, tramos y alertas vienen del backend.
const ArtDotacionPropuestas = ({ token, onCambio }) => {
  const esAdmin = useEsAdmin();
  const [grupo, setGrupo] = useState('lote');
  const [lote, setLote] = useState([]);
  const [individual, setIndividual] = useState([]);
  const [porRevision, setPorRevision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrica, setMetrica] = useState(null);
  const [errorMetrica, setErrorMetrica] = useState(null);
  const [ciius, setCiius] = useState(null);
  const [errorCiius, setErrorCiius] = useState(null);
  // ART-98: por código, si está en el catálogo CLAE (true/false) o si no se
  // pudo saber (null). Sólo señaliza: no cambia la cola ni la corrida.
  const [enClae, setEnClae] = useState({});
  const [rechazadas, setRechazadas] = useState([]);
  const [nRechazadas, setNRechazadas] = useState(null);
  const [loadingRech, setLoadingRech] = useState(true);
  const [errorRech, setErrorRech] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [valores, setValores] = useState({});
  const [valoresInd, setValoresInd] = useState({});
  const [resultados, setResultados] = useState({});
  const [resumen, setResumen] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [rechazando, setRechazando] = useState(null);
  const [corridaAbierta, setCorridaAbierta] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rLote, rInd] = await Promise.all([
          listarTodasPropuestasDotacion(token, { revision: 'lote' }),
          listarTodasPropuestasDotacion(token, { revision: 'individual' }),
        ]);
        if (cancelado) return;
        setLote(rLote.items || []);
        setIndividual(rInd.items || []);
        setPorRevision(rInd.por_revision || rLote.por_revision || null);
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    obtenerMetricaCervi(token)
      .then((m) => { if (!cancelado) { setMetrica(m); setErrorMetrica(null); } })
      .catch((err) => { if (!cancelado) setErrorMetrica(err.message); });
    obtenerCiiuSinCuadro(token)
      .then((c) => {
        if (cancelado) return;
        setCiius(c);
        setErrorCiius(null);
        // ART-98: cada código se busca en el catálogo CLAE del buscador de
        // CIIU (GET /art/ciiu?q=, prefijo). Son pocos códigos (los de la
        // última corrida) y el catálogo es de lectura para cualquier rol.
        const codigos = [...new Set((c?.items || []).map((it) => it.ciiu).filter(Boolean))];
        codigos.forEach((codigo) => {
          buscarCiiu(token, codigo, { limit: MAX_RESULTADOS_CIIU })
            .then((r) => { if (!cancelado) setEnClae((prev) => ({ ...prev, [codigo]: enNomencladorClae(codigo, r?.items) })); })
            .catch(() => { if (!cancelado) setEnClae((prev) => ({ ...prev, [codigo]: null })); });
        });
      })
      .catch((err) => { if (!cancelado) setErrorCiius(err.message); });
    setLoadingRech(true);
    listarTodasPropuestasDotacion(token, { estado: 'RECHAZADA', revision: 'todas' })
      .then((r) => {
        if (cancelado) return;
        setRechazadas(r.items || []);
        setNRechazadas(Number.isFinite(r.total) ? r.total : (r.items || []).length);
        setErrorRech(null);
      })
      .catch((err) => { if (!cancelado) setErrorRech(err.message); })
      .finally(() => { if (!cancelado) setLoadingRech(false); });
    return () => { cancelado = true; };
  }, [token, recarga]);

  const refrescar = useCallback(() => {
    setRecarga((n) => n + 1);
    onCambio?.();
  }, [onCambio]);

  const nombre = (id) => {
    const p = [...lote, ...individual].find((x) => x.id === id);
    return p?.razon_social || p?.cuit || `#${id}`;
  };

  const registrar = (nuevos, titulo) => {
    setResultados((prev) => ({ ...prev, ...nuevos }));
    setResumen({
      titulo,
      filas: Object.entries(nuevos).map(([id, r]) => ({ id: Number(id), nombre: nombre(Number(id)), ...r })),
    });
  };

  const toggle = (id) => setSeleccion((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const todasTildadas = lote.length > 0 && lote.every((p) => seleccion.has(p.id));
  const toggleTodas = () => setSeleccion(todasTildadas ? new Set() : new Set(lote.map((p) => p.id)));

  const aceptarSeleccionadas = async () => {
    const plan = planAceptacion(lote, seleccion, valores);
    const nuevos = {};
    plan.invalidas.forEach((id) => { nuevos[id] = { resultado: 'ERROR', detalle: 'Valor inválido: tiene que ser un entero mayor a 0. No se envió.' }; });
    setEnviando(true);
    try {
      if (plan.lote.length) {
        try {
          const r = await aceptarLotePropuestasDotacion(token, plan.lote);
          (r?.items || []).forEach((it) => {
            nuevos[it.id] = {
              resultado: it.resultado,
              detalle: it.resultado === 'ERROR'
                ? `${it.status_code ? `${it.status_code} · ` : ''}${textoError(it.error)}`
                : (it.motivo || ''),
            };
          });
        } catch (err) {
          plan.lote.forEach((id) => { nuevos[id] = { resultado: 'ERROR', detalle: err.message }; });
        }
      }
      for (const { id, valor } of plan.individuales) {
        try {
          const r = await aceptarPropuestaDotacion(token, id, { valor });
          nuevos[id] = { resultado: r?.estado || 'EDITADA', detalle: `Valor ${numeroAr(r?.valor_final ?? valor)}` };
        } catch (err) {
          nuevos[id] = { resultado: 'ERROR', detalle: err.message };
        }
      }
    } finally {
      setEnviando(false);
    }
    registrar(nuevos, 'Resultado de la aceptación');
    setSeleccion(new Set());
    setValores((prev) => {
      const s = { ...prev };
      Object.entries(nuevos).forEach(([id, r]) => { if (r.resultado === 'ACEPTADA' || r.resultado === 'EDITADA') delete s[id]; });
      return s;
    });
    refrescar();
  };

  const aceptarIndividual = async (p) => {
    const texto = valoresInd[p.id] ?? (p.dotacion_previa ?? '');
    const valor = valorValido(texto);
    if (valor === null) {
      registrar({ [p.id]: { resultado: 'ERROR', detalle: 'Ingresá un entero mayor a 0.' } }, 'Resultado');
      return;
    }
    setEnviando(true);
    try {
      const r = await aceptarPropuestaDotacion(token, p.id, { valor });
      registrar({ [p.id]: { resultado: r?.estado || 'ACEPTADA', detalle: `Valor ${numeroAr(r?.valor_final ?? valor)}` } }, 'Resultado');
      refrescar();
    } catch (err) {
      registrar({ [p.id]: { resultado: 'ERROR', detalle: err.message } }, 'Resultado');
    } finally {
      setEnviando(false);
    }
  };

  const confirmarRechazo = async (motivo) => {
    const p = rechazando;
    await rechazarPropuestaDotacion(token, p.id, motivo);
    setRechazando(null);
    registrar({ [p.id]: { resultado: 'RECHAZADA', detalle: motivo } }, 'Resultado');
    refrescar();
  };

  const nLote = porRevision?.lote ?? lote.length;
  const nInd = porRevision?.individual ?? individual.length;
  const seleccionadas = lote.filter((p) => seleccion.has(p.id)).length;
  const filas = grupo === 'lote' ? lote : individual;
  const columnas = 11 + (esAdmin ? 1 : 0) + (grupo === 'lote' && esAdmin ? 1 : 0);

  const v40 = metrica?.ventana_40;
  const pct = metrica?.bloque3_pct_comision_sobre_media;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4" data-testid="metrica-ventana40">
          <p className="text-xs text-slate-400 uppercase">Próximas 40 con dotación ≥ MEDIA</p>
          <p className="text-2xl font-bold mt-1">
            {v40 ? `${numeroAr(v40.medias_o_mas)} / ${numeroAr(v40.total)}` : '—'}
          </p>
        </div>
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4" data-testid="metrica-bloque3">
          <p className="text-xs text-slate-400 uppercase">% comisión Bloque 3 sobre dotación ≥ MEDIA</p>
          <p className="text-2xl font-bold mt-1">
            {pctDosDecimales(pct) ?? '—'}
          </p>
          {metrica && (
            <p className="text-xs text-slate-500 mt-1">{numeroAr(metrica.bloque3_empresas)} empresas en Bloque 3</p>
          )}
        </div>
        {errorMetrica && (
          <p role="alert" className="sm:col-span-2 text-sm text-red-300">No se pudo leer la métrica: {errorMetrica}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <nav className="flex items-center gap-1" aria-label="Grupos de propuestas">
          <button type="button" className={grupoClass(grupo === 'lote')} aria-pressed={grupo === 'lote'} onClick={() => setGrupo('lote')}>
            Para aceptar en lote <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-900/60" data-testid="contador-lote">{numeroAr(nLote)}</span>
          </button>
          <button type="button" className={grupoClass(grupo === 'individual')} aria-pressed={grupo === 'individual'} onClick={() => setGrupo('individual')}>
            Revisar a mano <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-slate-900/60" data-testid="contador-individual">{numeroAr(nInd)}</span>
          </button>
          <button type="button" className={grupoClass(grupo === 'rechazadas')} aria-pressed={grupo === 'rechazadas'} onClick={() => setGrupo('rechazadas')}>
            Rechazadas ({nRechazadas === null ? '…' : numeroAr(nRechazadas)})
          </button>
        </nav>
        <div className="flex items-center gap-2">
          {esAdmin && grupo === 'lote' && (
            <button
              type="button"
              disabled={enviando || seleccionadas === 0}
              onClick={aceptarSeleccionadas}
              className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium disabled:opacity-50"
            >
              {enviando ? 'Aceptando…' : `Aceptar seleccionadas (${seleccionadas})`}
            </button>
          )}
          {esAdmin && (
            <button type="button" onClick={() => setCorridaAbierta(true)} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium">
              Correr CERVI
            </button>
          )}
        </div>
      </div>

      {!esAdmin && (
        <p className="text-xs text-slate-500">Aceptar, rechazar y correr CERVI son sólo para ADMIN.</p>
      )}
      {grupo === 'lote' && esAdmin && (
        <p className="text-xs text-slate-500">
          El lote acepta cada una con el valor propuesto. Si editás el valor de una fila, esa se acepta sola con tu valor (queda EDITADA).
        </p>
      )}
      {grupo === 'rechazadas' && (
        <p className="text-xs text-slate-500">
          Mientras un rechazo esté vigente, CERVI no vuelve a proponer la empresa. Reabrir no borra el rechazo: la próxima corrida la vuelve a proponer.
        </p>
      )}
      {grupo === 'individual' && (
        <p className="text-xs text-slate-500">
          Grandes (ratio &gt; 50 o planilla ≥ 500): el promedio del sector las subdeclara. Se aceptan de a una, con el valor precargado de la planilla.
        </p>
      )}

      {resumen && (
        <div role="status" className="bg-slate-800 rounded-2xl border border-slate-700 p-3 text-sm space-y-1" data-testid="resumen-acciones">
          <p className="text-xs text-slate-400 uppercase">{resumen.titulo}</p>
          <ul className="space-y-1">
            {resumen.filas.map((f) => {
              const info = resultadoInfo(f.resultado);
              return (
                <li key={f.id} className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-200">{f.nombre}</span>
                  <span className={`${badgeBase} ${info.clase}`}>{info.label}</span>
                  {f.detalle && <span className="text-xs text-slate-400">{f.detalle}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_16rem]">
        {grupo === 'rechazadas' ? (
          <div className="space-y-2">
            {errorRech && (
              <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{errorRech}</p>
            )}
            <ArtDotacionRechazadas
              token={token}
              filas={rechazadas}
              loading={loadingRech}
              esAdmin={esAdmin}
              onReabierta={refrescar}
            />
          </div>
        ) : (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm" aria-label={grupo === 'lote' ? 'Para aceptar en lote' : 'Revisar a mano'}>
            <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
              <tr>
                {grupo === 'lote' && esAdmin && (
                  <th className={thClass}>
                    <input type="checkbox" aria-label="Seleccionar todas" checked={todasTildadas} onChange={toggleTodas} disabled={!lote.length} />
                  </th>
                )}
                <th className={thClass}>Empresa</th>
                <th className={thClass}>CUIT</th>
                <th className={thClass}>Vence en</th>
                <th className={thClass}>CIIU</th>
                <th className={thClass}>Planilla</th>
                <th className={thClass}>Prom. sector</th>
                <th className={thClass}>Ratio</th>
                <th className={thClass}>Propuesta</th>
                <th className={thClass}>Tramo</th>
                <th className={thClass}>Alertas</th>
                {grupo === 'individual' && <th className={thClass}>Valor a aceptar</th>}
                {esAdmin && <th className={thClass}>Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {loading && (
                <tr><td colSpan={columnas} className="px-3 py-6 text-center text-slate-400">Cargando propuestas…</td></tr>
              )}
              {!loading && !error && filas.length === 0 && (
                <tr>
                  <td colSpan={columnas} className="px-3 py-6 text-center text-slate-500">
                    {grupo === 'lote' ? 'No hay propuestas pendientes para aceptar en lote.' : 'No hay propuestas grandes para revisar a mano.'}
                  </td>
                </tr>
              )}
              {!loading && filas.map((p) => {
                const grande = p.requiere_revision_individual;
                return (
                  <tr key={p.id} data-testid={`propuesta-${p.id}`} className={grande ? 'bg-red-500/5' : 'hover:bg-slate-700/30'}>
                    {grupo === 'lote' && esAdmin && (
                      <td className={tdClass}>
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${p.razon_social || p.cuit || p.id}`}
                          checked={seleccion.has(p.id)}
                          onChange={() => toggle(p.id)}
                          disabled={grande}
                        />
                      </td>
                    )}
                    <td className={`${tdClass} text-slate-200`}>
                      {p.razon_social || 'Sin razón social'}
                      <Resultado r={resultados[p.id]} />
                    </td>
                    <CeldasDatos p={p} />
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {grupo === 'lote' && esAdmin ? (
                        <input
                          className={inputNum}
                          inputMode="numeric"
                          aria-label={`Propuesta ${p.razon_social || p.id}`}
                          value={valores[p.id] ?? String(p.valor_propuesto)}
                          onChange={(e) => setValores((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        />
                      ) : (
                        <span className="text-slate-200 font-medium">{numeroAr(p.valor_propuesto)}</span>
                      )}
                    </td>
                    <CeldaTramo p={p} />
                    <td className={tdClass}><Alertas alertas={p.alertas} /></td>
                    {grupo === 'individual' && (
                      <td className={tdClass}>
                        {esAdmin ? (
                          <input
                            className={inputNum}
                            inputMode="numeric"
                            required
                            aria-label={`Valor a aceptar ${p.razon_social || p.id}`}
                            value={valoresInd[p.id] ?? (p.dotacion_previa === null || p.dotacion_previa === undefined ? '' : String(p.dotacion_previa))}
                            onChange={(e) => setValoresInd((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          />
                        ) : guion}
                      </td>
                    )}
                    {esAdmin && (
                      <td className={`${tdClass} whitespace-nowrap`}>
                        <div className="flex gap-1">
                          {grupo === 'individual' && (
                            <button
                              type="button"
                              disabled={enviando}
                              onClick={() => aceptarIndividual(p)}
                              className="px-2 py-1 rounded bg-green-600/80 hover:bg-green-500 text-xs disabled:opacity-50"
                            >
                              Aceptar con este valor
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={enviando}
                            onClick={() => setRechazando(p)}
                            className="px-2 py-1 rounded bg-slate-700 hover:bg-red-600/80 text-xs disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        <aside className="bg-slate-800 rounded-2xl border border-slate-700 p-4 text-sm space-y-2 h-fit" aria-label="CIIU sin Cuadro 1">
          <p className="font-medium" data-testid="titulo-ciiu">
            CIIU sin Cuadro 1
            {ciius && (
              <span className="text-slate-400">
                {` · ${numeroAr(ciius.total_ciius)} ${ciius.total_ciius === 1 ? 'código' : 'códigos'}`}
                {` · ${numeroAr(ciius.total_empresas)} ${ciius.total_empresas === 1 ? 'empresa' : 'empresas'}`}
              </span>
            )}
          </p>
          {ciius && (
            <p className="text-xs text-slate-500">origen {ciius.origen}</p>
          )}
          {errorCiius && <p role="alert" className="text-xs text-red-300">{errorCiius}</p>}
          {!ciius && !errorCiius && <p className="text-xs text-slate-500">Cargando…</p>}
          {ciius && ciius.items?.length === 0 && <p className="text-xs text-slate-500">Todos los CIIU de la cola tienen Cuadro 1.</p>}
          {ciius && ciius.items?.length > 0 && (
            <ul className="divide-y divide-slate-700/60 max-h-80 overflow-y-auto">
              {ciius.items.map((c) => (
                <li key={c.ciiu ?? 'sin-ciiu'} className="py-1" data-testid={`ciiu-${c.ciiu ?? 'sin'}`}>
                  <div className="flex justify-between">
                    <span className="text-slate-300">{c.ciiu || 'Sin CIIU'}</span>
                    <span className="text-slate-400">{numeroAr(c.empresas)}</span>
                  </div>
                  {c.ciiu && enClae[c.ciiu] === false && (
                    <span
                      className={`${badgeBase} mt-1 bg-orange-500/20 text-orange-300 whitespace-normal`}
                      title="No está en el catálogo CLAE vigente ni en el Cuadro 1. La resolución es del backend (ART-98)."
                      data-testid="marca-clanae97"
                    >
                      {ETIQUETA_CLANAE97}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {!loading && grupo !== 'rechazadas' && (
        <p className="text-xs text-slate-500">
          {numeroAr(filas.length)} propuestas en este grupo. Al aceptar, la empresa queda con dotación DECLARADA · confianza MEDIA.
        </p>
      )}

      {rechazando && (
        <RechazoModal propuesta={rechazando} onCerrar={() => setRechazando(null)} onConfirmar={confirmarRechazo} />
      )}
      {corridaAbierta && (
        <ArtCorridaCerviModal
          token={token}
          onCerrar={() => setCorridaAbierta(false)}
          onCorrida={() => { setCorridaAbierta(false); setResumen(null); refrescar(); }}
        />
      )}
    </div>
  );
};

export default ArtDotacionPropuestas;
