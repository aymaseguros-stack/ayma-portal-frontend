import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ConfirmarModal from '../ConfirmarModal';
import {
  aceptarLotePropuestasContacto,
  aceptarPropuestaContacto,
  listarSinCuit,
  listarTodasPropuestasContacto,
  obtenerDiagnosticoTelefonos,
  obtenerMetricaPaz,
  rechazarPropuestaContacto,
  sanearTelefonosPaz,
} from './artPazApi';
import {
  CONFIANZA_CLASE,
  TIPOS_CONTACTO,
  alertaPazInfo,
  motivoSinCuitLabel,
  resultadoLoteInfo,
  textoFraccion,
} from './artPazConstants';
import { numeroAr } from './artCarteraConstants';
import { fechaHora } from '../../utils/fechas';
import { useEsAdmin } from '../../utils/sesion';

const thClass = 'text-left px-3 py-2 font-medium whitespace-nowrap';
const tdClass = 'px-3 py-2';
const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';
const selectClass = 'px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';
const labelClass = 'block text-slate-400 text-xs mb-1';
const MAX_MOTIVO = 500;

const subClass = (activa) => `px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
  activa ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
}`;

const guion = <span className="text-slate-500">—</span>;

// Sólo se enlaza lo que es http(s): `url_origen` y `web` los trajo un
// worker de páginas de terceros, y un `javascript:` no puede quedar a un clic.
const esHttp = (url) => /^https?:\/\//i.test(String(url || '').trim());

const Enlace = ({ url, texto }) => {
  if (!url) return guion;
  if (!esHttp(url)) return <span className="text-slate-400 break-all">{url}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 break-all">
      {texto || url}
    </a>
  );
};

const hostDe = (url) => {
  try { return new URL(url).host; } catch { return url; }
};

const AlertasPaz = ({ alertas }) => {
  if (!alertas?.length) return guion;
  return (
    <div className="flex flex-wrap gap-1">
      {alertas.map((a) => {
        const info = alertaPazInfo(a);
        return (
          <span key={a} className={`${badgeBase} ${info.clase}`} title={info.ayuda} data-alerta={info.codigo}>
            {info.label}
          </span>
        );
      })}
    </div>
  );
};

const Tarjeta = ({ titulo, valor, detalle, testid }) => (
  <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 min-w-[11rem]">
    <p className="text-slate-400 text-xs">{titulo}</p>
    <p className="text-lg font-bold text-white" data-testid={testid}>{valor}</p>
    {detalle && <p className="text-xs text-slate-500 mt-0.5">{detalle}</p>}
  </div>
);

// Métrica de GET /art/workers/paz/metrica. Es lo único que ve un EMPLEADO.
const MetricaPaz = ({ metrica, error }) => {
  if (error) return <p role="alert" className="text-sm text-red-300">No se pudo cargar la métrica de @PAZ: {error}</p>;
  if (!metrica) return <p className="text-sm text-slate-400">Cargando métrica…</p>;
  const p = metrica.pendientes || {};
  return (
    <div className="flex flex-wrap gap-3" aria-label="Métrica de @PAZ">
      <Tarjeta
        titulo="Bloque 3 con teléfono ≥ MEDIA"
        valor={textoFraccion(metrica.bloque3_telefono_media_o_mas)}
        detalle={metrica.bloque3_solo_mater_ii_excluidas
          ? `${numeroAr(metrica.bloque3_solo_mater_ii_excluidas)} con sólo MATER II, excluidas`
          : null}
        testid="metrica-bloque3"
      />
      <Tarjeta titulo="P1 contactables ≥ MEDIA" valor={textoFraccion(metrica.p1_contactables_media_o_mas)} testid="metrica-p1-media" />
      <Tarjeta
        titulo="P1 contactables (cualquier confianza)"
        valor={textoFraccion(metrica.p1_contactables_cualquier_confianza)}
        testid="metrica-p1-cualquiera"
      />
      <Tarjeta
        titulo="Propuestas pendientes"
        valor={numeroAr(p.total ?? 0)}
        detalle={`${numeroAr(p.bloqueadas_lote ?? 0)} con alerta (fuera del lote)`}
        testid="metrica-pendientes"
      />
      <Tarjeta titulo="Hallazgos sin CUIT" valor={numeroAr(metrica.sin_cuit ?? 0)} testid="metrica-sin-cuit" />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Propuestas
// ---------------------------------------------------------------------------

const Propuestas = ({ token, onCambio }) => {
  const [tipo, setTipo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [confirmar, setConfirmar] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState(null);
  // Resultado de la última acción, por ítem: las aceptadas desaparecen de la
  // lista al recargar, así que se guarda la fila junto con el resultado.
  const [resultados, setResultados] = useState(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await listarTodasPropuestasContacto(token, { estado: 'PENDIENTE', tipo });
        if (!cancelado) setData(r);
      } catch (err) {
        if (!cancelado) { setError(err.message); setData(null); }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [token, tipo, recarga]);

  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);
  const tildables = useMemo(() => items.filter((p) => !p.bloquea_lote), [items]);

  // Una selección que ya no está en la lista (aceptada, caducada) se suelta.
  useEffect(() => {
    setSeleccion((prev) => {
      const vivos = new Set(tildables.map((p) => p.id));
      const sig = new Set([...prev].filter((id) => vivos.has(id)));
      return sig.size === prev.size ? prev : sig;
    });
  }, [tildables]);

  const refrescar = () => { setRecarga((n) => n + 1); onCambio?.(); };

  const alternar = (id) => setSeleccion((prev) => {
    const sig = new Set(prev);
    if (sig.has(id)) sig.delete(id); else sig.add(id);
    return sig;
  });
  const todas = tildables.length > 0 && tildables.every((p) => seleccion.has(p.id));
  const alternarTodas = () => setSeleccion(todas ? new Set() : new Set(tildables.map((p) => p.id)));

  const nombre = (p) => p?.razon_social || p?.cuit || `Propuesta #${p?.id}`;

  const ejecutarAceptar = async (p) => {
    try {
      const r = await aceptarPropuestaContacto(token, p.id);
      setResultados({ titulo: 'Aceptar', filas: [{ p, item: { id: p.id, resultado: 'ACEPTADA', accion: r?.accion } }] });
      setAviso(null);
    } catch (err) {
      if (err.status !== 409) throw err;
      // 409: el backend dejó la propuesta CADUCA. No es un error de la
      // pantalla: es el resultado, y se muestra como tal.
      setResultados({ titulo: 'Aceptar', filas: [{ p, item: { id: p.id, resultado: 'ERROR', status_code: 409, error: err.message } }] });
    }
    setConfirmar(null);
    refrescar();
  };

  const ejecutarRechazar = async (p) => {
    const m = motivo.trim();
    if (!m) throw new Error('El motivo es obligatorio.');
    if (m.length > MAX_MOTIVO) throw new Error(`El motivo tiene ${MAX_MOTIVO} caracteres como máximo.`);
    await rechazarPropuestaContacto(token, p.id, m);
    setConfirmar(null);
    setMotivo('');
    setResultados(null);
    setAviso(`Propuesta rechazada · ${nombre(p)}.`);
    refrescar();
  };

  const ejecutarLote = async (ids) => {
    const porId = new Map(items.map((p) => [p.id, p]));
    const r = await aceptarLotePropuestasContacto(token, ids);
    const filas = (Array.isArray(r?.items) ? r.items : []).map((item) => ({ p: porId.get(item.id), item }));
    setResultados({
      titulo: 'Aceptar seleccionadas',
      resumen: `${numeroAr(r?.aceptadas ?? 0)} aceptadas · ${numeroAr(r?.bloqueadas ?? 0)} bloqueadas · ${numeroAr(r?.con_error ?? 0)} con error`,
      filas,
    });
    setAviso(null);
    setSeleccion(new Set());
    setConfirmar(null);
    refrescar();
  };

  const abrir = (accion, p) => { setMotivo(''); setAviso(null); setConfirmar({ accion, p }); };

  return (
    <div className="space-y-3">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex items-end gap-4 flex-wrap">
        <div>
          <label className={labelClass} htmlFor="paz-tipo">Tipo</label>
          <select id="paz-tipo" className={selectClass} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {TIPOS_CONTACTO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button
          type="button"
          disabled={seleccion.size === 0}
          onClick={() => { setAviso(null); setConfirmar({ accion: 'lote', ids: [...seleccion] }); }}
          className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium disabled:opacity-40"
        >
          Aceptar seleccionadas ({seleccion.size})
        </button>
        <p className="text-xs text-slate-500 max-w-md">
          Las propuestas con alerta no entran en el lote: se revisan y aceptan una por una.
        </p>
      </div>

      {aviso && (
        <p role="status" className="text-sm text-green-300 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">{aviso}</p>
      )}

      {resultados && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-3 space-y-2" data-testid="resultado-contactos">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-200 font-medium">
              Resultado · {resultados.titulo}
              {resultados.resumen && <span className="text-slate-400 font-normal"> · {resultados.resumen}</span>}
            </p>
            <button type="button" onClick={() => setResultados(null)} className="text-xs text-slate-400 hover:text-white">Cerrar</button>
          </div>
          <ul className="space-y-1">
            {resultados.filas.map(({ p, item }) => {
              const info = resultadoLoteInfo(item);
              return (
                <li key={item.id} className="text-sm flex flex-wrap items-center gap-2" data-testid="resultado-item">
                  <span className="text-slate-300">{p ? `${nombre(p)} · ${p.tipo} ${p.valor}` : `Propuesta #${item.id}`}</span>
                  <span className={`${badgeBase} ${info.clase}`}>{info.label}</span>
                  {info.detalle && <span className="text-xs text-slate-400">{info.detalle}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
            <tr>
              <th className={thClass}>
                <input
                  type="checkbox"
                  aria-label="Tildar todas las que entran en el lote"
                  checked={todas}
                  disabled={tildables.length === 0}
                  onChange={alternarTodas}
                />
              </th>
              <th className={thClass}>Empresa</th>
              <th className={thClass}>CUIT</th>
              <th className={thClass}>Tipo</th>
              <th className={thClass}>Valor</th>
              <th className={thClass}>Fuente</th>
              <th className={thClass}>Origen</th>
              <th className={thClass}>Confianza sugerida</th>
              <th className={thClass}>Alertas</th>
              <th className={thClass}>Fecha</th>
              <th className={thClass}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {loading && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-slate-400">Cargando propuestas…</td></tr>
            )}
            {!loading && items.length === 0 && !error && (
              <tr><td colSpan={11} className="px-3 py-6 text-center text-slate-500">No hay propuestas de contacto pendientes.</td></tr>
            )}
            {!loading && items.map((p) => (
              <tr key={p.id} data-testid="fila-contacto" data-bloquea-lote={p.bloquea_lote ? 'true' : 'false'} className="hover:bg-slate-700/30">
                <td className={tdClass}>
                  <input
                    type="checkbox"
                    aria-label={`Tildar ${nombre(p)} ${p.valor}`}
                    checked={seleccion.has(p.id)}
                    disabled={p.bloquea_lote}
                    title={p.bloquea_lote ? `No entra en el lote: ${(p.alertas || []).join(', ')}` : undefined}
                    onChange={() => alternar(p.id)}
                  />
                </td>
                <td className={`${tdClass} text-slate-200`}>{p.razon_social || 'Sin razón social'}</td>
                <td className={`${tdClass} text-slate-400 whitespace-nowrap`}>{p.cuit || '—'}</td>
                <td className={`${tdClass} text-slate-300`}>
                  {p.tipo}
                  {p.titular_dato && p.titular_dato !== 'EMPRESA' && (
                    <span className="block text-xs text-orange-300">{p.titular_dato}</span>
                  )}
                </td>
                <td className={`${tdClass} text-slate-200 break-all`}>
                  {p.valor}
                  {(p.persona_nombre || p.persona_cargo) && (
                    <span className="block text-xs text-slate-400">
                      {[p.persona_nombre, p.persona_cargo].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </td>
                <td className={`${tdClass} text-slate-300 whitespace-nowrap`} title={p.fuente}>{p.fuente_codigo || p.fuente}</td>
                <td className={`${tdClass} max-w-[14rem]`}>
                  <Enlace url={p.url_origen} texto={p.url_origen ? hostDe(p.url_origen) : null} />
                </td>
                <td className={tdClass}>
                  <span className={`${badgeBase} ${CONFIANZA_CLASE[p.confianza_sugerida] || CONFIANZA_CLASE.BAJA}`}>
                    {p.confianza_sugerida}
                  </span>
                </td>
                <td className={tdClass}>
                  <AlertasPaz alertas={p.alertas} />
                  {p.bloquea_lote && <span className="block text-xs text-slate-500 mt-1">Fuera del lote</span>}
                </td>
                <td className={`${tdClass} text-slate-400 whitespace-nowrap`}>{fechaHora(p.creado_en) || '—'}</td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => abrir('aceptar', p)}
                      className="px-2 py-1 rounded bg-green-600/80 hover:bg-green-500 text-xs"
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => abrir('rechazar', p)}
                      className="px-2 py-1 rounded bg-red-600/80 hover:bg-red-500 text-xs"
                    >
                      Rechazar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && data && (
        <p className="text-xs text-slate-500">
          {numeroAr(items.length)} de {numeroAr(data.total ?? items.length)} propuestas pendientes · {numeroAr(items.length - tildables.length)} con alerta.
        </p>
      )}

      {confirmar?.accion === 'aceptar' && (
        <ConfirmarModal
          titulo="Aceptar contacto"
          mensaje={`${nombre(confirmar.p)} · ${confirmar.p.tipo} ${confirmar.p.valor}. Se escribe en los contactos de la empresa con confianza ${confirmar.p.confianza_sugerida}, sin verificar.${confirmar.p.alertas?.length ? ` Alertas: ${confirmar.p.alertas.join(', ')}.` : ''}`}
          textoConfirmar="Aceptar"
          onConfirmar={() => ejecutarAceptar(confirmar.p)}
          onCancelar={() => setConfirmar(null)}
        />
      )}
      {confirmar?.accion === 'rechazar' && (
        <ConfirmarModal
          titulo="Rechazar contacto"
          mensaje={`${nombre(confirmar.p)} · ${confirmar.p.tipo} ${confirmar.p.valor}. Un valor rechazado no vuelve a proponerse.`}
          textoConfirmar="Rechazar"
          onConfirmar={() => ejecutarRechazar(confirmar.p)}
          onCancelar={() => { setConfirmar(null); setMotivo(''); }}
        >
          <label className={labelClass} htmlFor="paz-motivo">Motivo (obligatorio, hasta {MAX_MOTIVO} caracteres)</label>
          <textarea
            id="paz-motivo"
            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            rows={3}
            maxLength={MAX_MOTIVO}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <p className="text-xs text-slate-500 text-right">{motivo.length}/{MAX_MOTIVO}</p>
        </ConfirmarModal>
      )}
      {confirmar?.accion === 'lote' && (
        <ConfirmarModal
          titulo="Aceptar seleccionadas"
          mensaje={`Se aceptan ${confirmar.ids.length} propuestas sin alerta. Cada una va en su propia transacción y el resultado se muestra por ítem.`}
          textoConfirmar={`Aceptar ${confirmar.ids.length}`}
          onConfirmar={() => ejecutarLote(confirmar.ids)}
          onCancelar={() => setConfirmar(null)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sin CUIT (sólo lectura). NO se muestra el teléfono: estos hallazgos no son
// contactables hasta pasar por C-8, y un número visible invita a llamar
// fuera del gate. Sólo si lo tiene o no.
// ---------------------------------------------------------------------------

const LIMIT_SIN_CUIT = 100;

const Conteos = ({ titulo, conteos, etiqueta = (k) => k, testid }) => {
  const entradas = Object.entries(conteos || {});
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 min-w-[12rem]" data-testid={testid}>
      <p className="text-slate-400 text-xs mb-1">{titulo}</p>
      {entradas.length === 0 ? <p className="text-sm text-slate-500">—</p> : (
        <ul className="text-sm space-y-0.5">
          {entradas.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-4">
              <span className="text-slate-300">{etiqueta(k)}</span>
              <span className="text-white font-medium">{numeroAr(v)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SinCuit = ({ token }) => {
  const [fuente, setFuente] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fuentes, setFuentes] = useState([]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await listarSinCuit(token, { fuente, limit: LIMIT_SIN_CUIT, offset });
        if (cancelado) return;
        setData(r);
        // Las opciones del filtro salen del conteo SIN filtro, para no
        // quedarse con una sola fuente después de elegirla.
        if (!fuente) setFuentes(Object.keys(r?.por_fuente || {}));
      } catch (err) {
        if (!cancelado) { setError(err.message); setData(null); }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [token, fuente, offset]);

  const items = Array.isArray(data?.items) ? data.items : [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Hallazgos de @PAZ que no se pudieron atar a una única empresa. No entran al CRM ni se contactan: son insumo para C-8.
      </p>
      {error && <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      {data && (
        <div className="flex flex-wrap gap-3">
          <Tarjeta titulo="Total sin CUIT" valor={numeroAr(total)} testid="sin-cuit-total" />
          <Conteos titulo="Por fuente" conteos={data.por_fuente} testid="sin-cuit-por-fuente" />
          <Conteos titulo="Por motivo" conteos={data.por_motivo} etiqueta={motivoSinCuitLabel} testid="sin-cuit-por-motivo" />
        </div>
      )}
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className={labelClass} htmlFor="sc-fuente">Fuente</label>
          <select id="sc-fuente" className={selectClass} value={fuente} onChange={(e) => { setOffset(0); setFuente(e.target.value); }}>
            <option value="">Todas</option>
            {fuentes.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
            <tr>
              <th className={thClass}>Nombre</th>
              <th className={thClass}>Localidad</th>
              <th className={thClass}>Web</th>
              <th className={thClass}>Fuente</th>
              <th className={thClass}>Motivo</th>
              <th className={thClass}>Candidatos</th>
              <th className={thClass}>Veces</th>
              <th className={thClass}>Última vez</th>
              <th className={thClass}>¿Tiene teléfono?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {loading && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Cargando…</td></tr>}
            {!loading && items.length === 0 && !error && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">No hay hallazgos sin CUIT.</td></tr>
            )}
            {!loading && items.map((h) => (
              <tr key={h.id} data-testid="fila-sin-cuit">
                <td className={`${tdClass} text-slate-200`}>{h.nombre}</td>
                <td className={`${tdClass} text-slate-300`}>{h.localidad || guion}</td>
                <td className={`${tdClass} max-w-[14rem]`}><Enlace url={h.web} texto={h.web ? hostDe(h.web) : null} /></td>
                <td className={`${tdClass} text-slate-300 whitespace-nowrap`} title={h.fuente}>{h.fuente_codigo || h.fuente}</td>
                <td className={`${tdClass} text-slate-300`}>{motivoSinCuitLabel(h.motivo)}</td>
                <td className={`${tdClass} text-slate-300`}>{numeroAr(h.candidatos ?? 0)}</td>
                <td className={`${tdClass} text-slate-300`}>{numeroAr(h.veces ?? 0)}</td>
                <td className={`${tdClass} text-slate-400 whitespace-nowrap`}>{fechaHora(h.ultima_vez) || '—'}</td>
                <td className={`${tdClass} text-slate-300`} data-testid="tiene-telefono">{(h.telefono || '').trim() ? 'Sí' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && total > LIMIT_SIN_CUIT && (
        <div className="flex items-center gap-2 text-sm">
          <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT_SIN_CUIT))} className="px-3 py-1.5 rounded bg-slate-700 disabled:opacity-40">Anterior</button>
          <span className="text-slate-400">{numeroAr(offset + 1)}–{numeroAr(Math.min(offset + LIMIT_SIN_CUIT, total))} de {numeroAr(total)}</span>
          <button type="button" disabled={offset + LIMIT_SIN_CUIT >= total} onClick={() => setOffset(offset + LIMIT_SIN_CUIT)} className="px-3 py-1.5 rounded bg-slate-700 disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Diagnóstico ART-116 (sólo números).
// ---------------------------------------------------------------------------

const DiagnosticoTelefonos = ({ token, recarga = 0 }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    obtenerDiagnosticoTelefonos(token)
      .then((r) => { if (!cancelado) { setData(r); setError(null); } })
      .catch((err) => { if (!cancelado) setError(err.message); });
    return () => { cancelado = true; };
  }, [token, recarga]);

  if (error) return <p role="alert" className="text-sm text-red-300">{error}</p>;
  if (!data) return <p className="text-sm text-slate-400">Cargando diagnóstico…</p>;

  const porFuente = Object.entries(data.por_fuente || {});
  const mater = data.mater_ii_activas || {};
  const places = data.google_places_activas || {};
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Teléfonos cargados por fuente (ESCALAR y ADICIONAL son las columnas de la empresa). Sólo conteos.
      </p>
      <div className="flex flex-wrap gap-3">
        <Tarjeta
          titulo={`Números compartidos por ${data.umbral_compartido ?? 3}+ empresas`}
          valor={numeroAr(data.numeros_compartidos_3mas ?? 0)}
          testid="diag-compartidos"
        />
        <Tarjeta
          titulo="Empresas en esos números"
          valor={numeroAr(data.empresas_en_numeros_compartidos_3mas ?? 0)}
          testid="diag-empresas-compartidos"
        />
        <Tarjeta titulo="Filas MATER II activas" valor={numeroAr(mater.total ?? 0)} testid="diag-mater-total" />
        <Conteos titulo="MATER II activas por tipo" conteos={mater.por_tipo} testid="diag-mater-por-tipo" />
        <Tarjeta titulo="Filas GOOGLE_PLACES activas" valor={numeroAr(places.total ?? 0)} testid="diag-places-total" />
        <Conteos titulo="GOOGLE_PLACES activas por tipo" conteos={places.por_tipo} testid="diag-places-por-tipo" />
      </div>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
            <tr>
              <th className={thClass}>Fuente</th>
              <th className={thClass}>Total</th>
              <th className={thClass}>Menos de 6 dígitos</th>
              <th className={thClass}>No numéricos</th>
              <th className={thClass}>En números compartidos 3+</th>
              <th className={thClass}>Ya como estudio contable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {porFuente.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Sin teléfonos cargados.</td></tr>
            )}
            {porFuente.map(([f, c]) => (
              <tr key={f} data-testid="fila-diagnostico">
                <td className={`${tdClass} text-slate-200`}>{f}</td>
                <td className={`${tdClass} text-slate-200`}>{numeroAr(c?.total ?? 0)}</td>
                <td className={`${tdClass} text-slate-300`}>{numeroAr(c?.menos_6_dig ?? 0)}</td>
                <td className={`${tdClass} text-slate-300`}>{numeroAr(c?.no_numericos ?? 0)}</td>
                <td className={`${tdClass} text-slate-300`}>{numeroAr(c?.en_compartidos_3mas ?? 0)}</td>
                <td className={`${tdClass} text-slate-300`} data-testid={`diag-estudio-${f}`}>{numeroAr(c?.estudio_contable ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Saneamiento ART-116 (POST /art/workers/paz/saneamiento). Primero SIEMPRE en
// seco; "Confirmar" se habilita recién con una previsualización a la vista y
// pasa por ConfirmarModal. La respuesta trae contadores y una muestra
// (empresa, fuente, tipo): acá no se muestra un solo valor de contacto.
// ---------------------------------------------------------------------------

// Orden y rótulo de los cuatro bloques (claves del backend).
const BLOQUES_SANEAMIENTO = [
  { clave: 'mater_ii', letra: 'a', titulo: 'MATER II', accion: 'Se desactivan (D-CO4-4 no acreditable)', desactiva: true },
  { clave: 'google_places', letra: 'b', titulo: 'GOOGLE_PLACES', accion: 'Se desactivan teléfono y web (ToS Google: sólo place_id)', desactiva: true },
  { clave: 'compartidos_3mas', letra: 'c', titulo: 'ESTUDIO_CONTABLE', accion: 'Números en 3+ empresas: se marcan como estudio contable', desactiva: false },
  { clave: 'basura', letra: 'd', titulo: 'Basura', accion: 'Menos de 6 dígitos o no numéricos: se desactivan', desactiva: true },
];

// N filas que se desactivan y M que se marcan estudio contable.
const conteosSaneamiento = (r) => {
  const b = r?.bloques || {};
  const filas = (k) => b[k]?.filas_empresa_contacto ?? 0;
  return {
    desactiva: filas('mater_ii') + filas('google_places') + filas('basura'),
    estudio: filas('compartidos_3mas'),
  };
};

const BloqueSaneamientoCard = ({ def, bloque }) => {
  const muestra = Array.isArray(bloque?.muestra) ? bloque.muestra : [];
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 space-y-2" data-testid={`saneo-bloque-${def.clave}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-white font-medium text-sm">{def.letra}) {def.titulo}</p>
        <p className="text-lg font-bold text-white" data-testid={`saneo-filas-${def.clave}`}>
          {numeroAr(bloque?.filas_empresa_contacto ?? 0)}
        </p>
      </div>
      <p className="text-xs text-slate-400">
        {def.accion} · {numeroAr(bloque?.empresas ?? 0)} empresas
        {bloque?.numeros != null && ` · ${numeroAr(bloque.numeros)} números`}
      </p>
      {Object.keys(bloque?.por_tipo || {}).length > 0 && (
        <p className="text-xs text-slate-400">
          {Object.entries(bloque.por_tipo).map(([t, n]) => `${t} ${numeroAr(n)}`).join(' · ')}
        </p>
      )}
      {muestra.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-slate-500">
            <tr><th className="text-left py-1">Empresa</th><th className="text-left py-1">Fuente</th><th className="text-left py-1">Tipo</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {muestra.map((m, i) => (
              <tr key={`${m.empresa_id}-${m.fuente}-${i}`} data-testid="saneo-muestra">
                <td className="py-1 text-slate-200">{m.razon_social || m.empresa_id}</td>
                <td className="py-1 text-slate-300">{m.fuente}</td>
                <td className="py-1 text-slate-300">{m.tipo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const ResultadoSaneamiento = ({ r }) => {
  const escalares = ['compartidos_3mas', 'basura']
    .map((k) => [k, r.bloques?.[k]?.escalares_no_contactables])
    .filter(([, e]) => e && Object.keys(e).length);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300" data-testid="saneo-total">
        {r.dry_run ? 'Previsualización (no se escribió nada)' : 'Saneamiento aplicado'} ·{' '}
        {numeroAr(r.filas_actualizadas ?? 0)} filas {r.dry_run ? 'cambiarían' : 'cambiadas'}
      </p>
      {(r.filas_actualizadas ?? 0) === 0 && (
        <p className="text-sm text-emerald-300" data-testid="saneo-nada">
          Nada para sanear. Si ya se aplicó antes, esto es lo esperado.
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {BLOQUES_SANEAMIENTO.map((def) => (
          <BloqueSaneamientoCard key={def.clave} def={def} bloque={r.bloques?.[def.clave]} />
        ))}
      </div>
      {escalares.length > 0 && (
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-3" data-testid="saneo-escalares">
          <p className="text-slate-300 text-sm font-medium">Teléfonos de la empresa (columnas escalares)</p>
          <p className="text-xs text-slate-400 mb-1">No se escriben; /lista y la métrica ya no los usan.</p>
          <ul className="text-sm space-y-0.5">
            {escalares.map(([k, e]) => (
              <li key={k} className="text-slate-300">
                {BLOQUES_SANEAMIENTO.find((d) => d.clave === k)?.titulo}:{' '}
                {Object.entries(e).map(([c, n]) => `${c} ${numeroAr(n)}`).join(' · ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const SaneamientoTelefonos = ({ token, onAplicado }) => {
  const [previa, setPrevia] = useState(null);
  const [aplicado, setAplicado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  const previsualizar = async () => {
    setCargando(true);
    setError(null);
    setAplicado(null);
    try {
      setPrevia(await sanearTelefonosPaz(token, { dryRun: true }));
    } catch (err) {
      setPrevia(null);
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const confirmar = async () => {
    const r = await sanearTelefonosPaz(token, { dryRun: false });
    setConfirmando(false);
    setAplicado(r);
    // Una previsualización ya aplicada no habilita una segunda confirmación.
    setPrevia(null);
    onAplicado?.();
  };

  const puedeConfirmar = !!previa && previa.dry_run === true && (previa.filas_actualizadas ?? 0) > 0;
  const { desactiva, estudio } = conteosSaneamiento(previa);

  return (
    <section className="bg-slate-800/40 rounded-2xl border border-slate-700 p-4 space-y-3" aria-label="Saneamiento ART-116">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-white font-medium mr-auto">Saneamiento ART-116</h3>
        <button
          type="button"
          onClick={previsualizar}
          disabled={cargando}
          className="px-3 py-1.5 rounded-lg text-sm bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-50"
        >
          {cargando ? 'Previsualizando…' : 'Previsualizar saneamiento'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          disabled={!puedeConfirmar || cargando}
          title={puedeConfirmar ? undefined : 'Primero previsualizá el saneamiento'}
          className="px-3 py-1.5 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirmar saneamiento
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Desactiva MATER II, GOOGLE_PLACES (teléfono y web) y teléfonos basura, y marca como estudio contable los
        números compartidos por 3+ empresas. No se borra nada.
      </p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {previa && <ResultadoSaneamiento r={previa} />}
      {aplicado && <ResultadoSaneamiento r={aplicado} />}
      {confirmando && (
        <ConfirmarModal
          titulo="Confirmar saneamiento"
          mensaje={`Se desactivan ${numeroAr(desactiva)} filas y se marcan ${numeroAr(estudio)} como estudio contable. No se borra nada.`}
          textoConfirmar="Sanear"
          onConfirmar={confirmar}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </section>
  );
};

const DiagnosticoArt116 = ({ token, onCambio }) => {
  const [recarga, setRecarga] = useState(0);
  const alAplicar = useCallback(() => {
    setRecarga((n) => n + 1);
    onCambio?.();
  }, [onCambio]);
  return (
    <div className="space-y-4">
      <SaneamientoTelefonos token={token} onAplicado={alAplicar} />
      <DiagnosticoTelefonos token={token} recarga={recarga} />
    </div>
  );
};

// ---------------------------------------------------------------------------

const SUBVISTAS = [
  { id: 'propuestas', label: 'Propuestas' },
  { id: 'sin-cuit', label: 'Sin CUIT' },
  { id: 'diagnostico', label: 'Diagnóstico ART-116' },
];

// Bandeja "Contactos propuestos" (@PAZ, OPERACIONES-0016). PAZ propone y una
// persona confirma (D-OP16-6). Arriba la métrica, que es lo único que ve un
// EMPLEADO; la bandeja, Sin CUIT y el diagnóstico son ADMIN en el backend.
const ArtContactoPropuestas = ({ token, onCambio }) => {
  const esAdmin = useEsAdmin();
  const [sub, setSub] = useState('propuestas');
  const [metrica, setMetrica] = useState(null);
  const [errorMetrica, setErrorMetrica] = useState(null);
  const [recargaMetrica, setRecargaMetrica] = useState(0);

  useEffect(() => {
    let cancelado = false;
    obtenerMetricaPaz(token)
      .then((r) => { if (!cancelado) { setMetrica(r); setErrorMetrica(null); } })
      .catch((err) => { if (!cancelado) setErrorMetrica(err.message); });
    return () => { cancelado = true; };
  }, [token, recargaMetrica]);

  const alCambiar = useCallback(() => {
    setRecargaMetrica((n) => n + 1);
    onCambio?.();
  }, [onCambio]);

  return (
    <div className="space-y-4">
      <MetricaPaz metrica={metrica} error={errorMetrica} />
      {!esAdmin && (
        <p className="text-sm text-slate-400">La bandeja de contactos propuestos la revisa un ADMIN.</p>
      )}
      {esAdmin && (
        <>
          <nav className="flex items-center gap-1 flex-wrap" aria-label="Vistas de contactos propuestos">
            {SUBVISTAS.map((v) => (
              <button key={v.id} type="button" onClick={() => setSub(v.id)} className={subClass(sub === v.id)} aria-pressed={sub === v.id}>
                {v.label}
              </button>
            ))}
          </nav>
          {sub === 'propuestas' && <Propuestas token={token} onCambio={alCambiar} />}
          {sub === 'sin-cuit' && <SinCuit token={token} />}
          {sub === 'diagnostico' && <DiagnosticoArt116 token={token} onCambio={alCambiar} />}
        </>
      )}
    </div>
  );
};

export default ArtContactoPropuestas;
