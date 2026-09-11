import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import {
  listarEventosPerformanceCompania,
  descargarCsvEventosPerformanceCompania,
} from './artCarteraApi';
import {
  aseguradoraLabel,
  decimalAr,
  numeroAr,
  variacionPct,
  MOTIVOS_RECHAZO_ART,
  RESULTADOS_BENCHMARK,
  TIPOS_ESTADO_ART,
  TRAMOS_NOMINA_SRT,
  fuenteTarifaActualLabel,
} from './artCarteraConstants';
import { descargarBlobComoArchivo } from './descargaArchivo';
import CiiuLabel from '../Ciiu/CiiuLabel';
import { fechaCorta } from '../../utils/fechas';

const VACIO = '—';
const SIZE = 100;

const labelClass = 'block text-slate-400 text-xs mb-1';
const inputClass = 'px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';
const th = 'px-3 py-3 text-left text-sm font-medium text-slate-300 whitespace-nowrap';
const thNum = 'px-3 py-3 text-right text-sm font-medium text-slate-300 whitespace-nowrap';
const td = 'px-3 py-2.5 text-sm text-slate-300 whitespace-nowrap';
const tdNum = 'px-3 py-2.5 text-sm text-right text-slate-300 whitespace-nowrap';

const FILTROS_INICIALES = { tipo: '', resultado: '', tramo: '', motivo: '' };

const RESULTADO_BADGE = {
  ganadora: 'bg-green-500/20 text-green-300',
  perdedora: 'bg-red-500/20 text-red-300',
  sin_comparable: 'bg-slate-500/20 text-slate-400',
};

const resultadoLabel = (id) => RESULTADOS_BENCHMARK.find((r) => r.id === id)?.label
  || (typeof id === 'string' && id ? id : null);

const FilaSkeleton = () => (
  <tr className="animate-pulse">
    {Array.from({ length: 15 }).map((_, i) => (
      <td key={i} className="px-3 py-2.5"><div className="h-3 bg-slate-700 rounded w-full max-w-[70px]" /></td>
    ))}
  </tr>
);

// Vista 2 del BLOQUE 2: las filas crudas detrás de un número del tablero
// (GET /art/performance-companias/{aseguradora}/eventos). Se abre desde una
// fila de ArtPerformanceBoard y vuelve al mismo panel - la app no usa router
// de URLs (ver el comentario de ArtCarteraView.jsx), así que la navegación
// es estado local, igual que la ficha de empresa y la grilla.
//
// `desde`/`hasta` bajan del tablero para que el detalle sea el MISMO corte
// que la celda que lo originó; `incluir_caducados` NO baja: este endpoint
// incluye siempre los caducados (el histórico ya caducó entero) y cada fila
// trae `vigente` para distinguirlos.
const ArtPerformanceEventos = ({ token, aseguradora, rango = {}, fuentes, onVolver, onAbrirFicha }) => {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const [errorCsv, setErrorCsv] = useState(null);

  // `fuente` baja del tablero por el mismo motivo que el rango de fechas: el
  // detalle tiene que ser el MISMO corte que la celda que lo originó.
  const fuentesKey = Array.isArray(fuentes) ? fuentes.join(',') : '';
  const consulta = useMemo(
    () => ({
      ...filtros,
      desde: rango.desde || '',
      hasta: rango.hasta || '',
      fuente: fuentesKey ? fuentesKey.split(',') : [],
    }),
    [filtros, rango.desde, rango.hasta, fuentesKey],
  );
  const consultaKey = JSON.stringify(consulta);

  // Cualquier cambio de filtro vuelve a la página 1: quedarse en la 3 de un
  // universo que ahora tiene 40 filas muestra una tabla vacía que se lee
  // como "no hay eventos".
  useEffect(() => { setPage(1); }, [consultaKey]);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resultado = await listarEventosPerformanceCompania(token, aseguradora, {
          ...consulta, page, size: SIZE,
        });
        if (!cancelado) setData(resultado || {});
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, aseguradora, consultaKey, page]);

  const cambiarFiltro = (campo, valor) => setFiltros((prev) => ({ ...prev, [campo]: valor }));

  const exportarCsv = async () => {
    setDescargando(true);
    setErrorCsv(null);
    try {
      const blob = await descargarCsvEventosPerformanceCompania(token, aseguradora, {
        ...consulta, page, size: SIZE,
      });
      descargarBlobComoArchivo(blob, `performance-${aseguradora}-eventos.csv`);
    } catch (err) {
      setErrorCsv(err.message);
    } finally {
      setDescargando(false);
    }
  };

  const items = Array.isArray(data?.items) ? data.items : [];
  const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : 0;
  const ultimaPagina = Math.max(1, Math.ceil(total / SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button
            type="button"
            onClick={onVolver}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-2"
          >
            <Icon name="arrow-left" size={14} />
            Volver
          </button>
          <h2 className="text-2xl font-bold">{aseguradoraLabel(aseguradora)}</h2>
          <p className="text-slate-400 text-sm mt-1">
            Eventos detrás del tablero. Ganadora/perdedora = benchmark de precio contra la tarifa actual de la
            empresa. No son ventas de AYMA.
          </p>
        </div>
        <button
          type="button"
          onClick={exportarCsv}
          disabled={descargando}
          className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 disabled:opacity-50 inline-flex items-center gap-2"
        >
          <Icon name="document-text" size={14} />
          {descargando ? 'Generando...' : 'CSV'}
        </button>
      </div>

      {errorCsv && (
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
          No se pudo descargar el CSV. {errorCsv}
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wide mb-3">
          <Icon name="funnel" size={14} />
          Filtros
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={labelClass} htmlFor="ev-tipo">Tipo</label>
            <select
              id="ev-tipo"
              value={filtros.tipo}
              onChange={(e) => cambiarFiltro('tipo', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Todos</option>
              {TIPOS_ESTADO_ART.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="ev-resultado">Resultado</label>
            <select
              id="ev-resultado"
              value={filtros.resultado}
              onChange={(e) => cambiarFiltro('resultado', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Todos</option>
              {RESULTADOS_BENCHMARK.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="ev-tramo">Tramo</label>
            <select
              id="ev-tramo"
              value={filtros.tramo}
              onChange={(e) => cambiarFiltro('tramo', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Todos</option>
              {TRAMOS_NOMINA_SRT.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="ev-motivo">Motivo</label>
            <select
              id="ev-motivo"
              value={filtros.motivo}
              onChange={(e) => cambiarFiltro('motivo', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Todos</option>
              {MOTIVOS_RECHAZO_ART.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <p className="text-slate-500 text-xs mt-3">
          Resultado aplica sólo a los eventos de tipo ALICUOTA; motivo, sólo a los de tipo RECHAZADA.
        </p>
      </div>

      {error && !loading && (
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">No se pudieron cargar los eventos. {error}</p>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className={th}>CUIT</th>
                <th className={th}>Razón social</th>
                <th className={th}>CIIU</th>
                <th className={th}>Sección</th>
                <th className={thNum}>Dotación</th>
                <th className={th}>Tramo</th>
                <th className={th}>Tipo</th>
                <th className={th}>Motivo</th>
                <th className={thNum}>Alícuota</th>
                <th className={thNum}>Tarifa actual</th>
                <th className={th}>Fuente tarifa actual</th>
                <th className={thNum}>Desc. vs actual</th>
                <th className={th}>Fecha evento</th>
                <th className={th}>Caducidad</th>
                <th className={th}>Vigente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading && Array.from({ length: 5 }).map((_, i) => <FilaSkeleton key={i} />)}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-3 py-8 text-center text-slate-400 text-sm">
                    No hay eventos para este corte.
                  </td>
                </tr>
              )}
              {!loading && items.map((ev) => (
                <tr key={ev.id} className={ev.vigente ? '' : 'text-slate-400'}>
                  <td className={td}>
                    {ev.cuit ? (
                      <button
                        type="button"
                        onClick={() => onAbrirFicha?.(ev.cuit)}
                        className="text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {ev.cuit}
                      </button>
                    ) : VACIO}
                  </td>
                  <td className={td}>{ev.razon_social || VACIO}</td>
                  <td className={td}>
                    <CiiuLabel codigo={ev.ciiu} descripcion={ev.ciiu_descripcion} />
                  </td>
                  <td className={td}>{ev.seccion || VACIO}</td>
                  <td className={tdNum}>{numeroAr(ev.dotacion) ?? VACIO}</td>
                  <td className={td}>{ev.tramo || VACIO}</td>
                  <td className={td}>
                    <span className="inline-flex items-center gap-2">
                      {ev.tipo || VACIO}
                      {resultadoLabel(ev.resultado) && (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${RESULTADO_BADGE[ev.resultado] || 'bg-slate-500/20 text-slate-400'}`}>
                          {resultadoLabel(ev.resultado)}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={td}>{ev.motivo || VACIO}</td>
                  <td className={tdNum}>{decimalAr(ev.alicuota, { maximumFractionDigits: 3 }) ?? VACIO}</td>
                  <td className={tdNum}>{decimalAr(ev.tarifa_actual, { maximumFractionDigits: 3 }) ?? VACIO}</td>
                  <td className={td}>{fuenteTarifaActualLabel(ev.fuente_tarifa_actual) || VACIO}</td>
                  <td className={tdNum}>{variacionPct(ev.descuento_vs_actual) ?? VACIO}</td>
                  <td className={td}>{fechaCorta(ev.fecha_evento) ?? VACIO}</td>
                  <td className={td}>{fechaCorta(ev.fecha_caducidad) ?? VACIO}</td>
                  <td className={td}>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${ev.vigente ? 'bg-green-500/20 text-green-300' : 'bg-slate-600/40 text-slate-400'}`}>
                      {ev.vigente ? 'Vigente' : 'Caducado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-700 text-sm text-slate-400">
          <span>{numeroAr(total) ?? '0'} eventos · página {page} de {ultimaPagina}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= ultimaPagina || loading}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtPerformanceEventos;
