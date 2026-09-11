import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import ArtPerformanceEventos from './ArtPerformanceEventos';
import {
  obtenerPerformanceCompanias,
  descargarCsvPerformanceCompanias,
} from './artCarteraApi';
import {
  aseguradoraLabel,
  decimalAr,
  numeroAr,
  porcentajeDeFraccion,
  variacionPct,
  SECCIONES_CIIU,
  TRAMOS_NOMINA_SRT,
} from './artCarteraConstants';
import { descargarBlobComoArchivo } from './descargaArchivo';
import { fechaCorta } from '../../utils/fechas';

const VACIO = '—';

const labelClass = 'block text-slate-400 text-xs mb-1';
const inputClass = 'px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';
const tdNum = 'px-3 py-3 text-sm text-right whitespace-nowrap';

const FILTROS_INICIALES = {
  desde: '',
  hasta: '',
  seccion: '',
  tramo: '',
  // Default ON y explícito: el histórico 2020-2025 ya caducó completo, así
  // que en false el tablero queda casi vacío y se lee como "no hay datos".
  incluir_caducados: true,
};

const TOOLTIP_CADUCADOS = 'el histórico 2020-2025 ya caducó completo';

// Las columnas del tablero, en orden. Cada una declara cómo se RENDERIZA y
// con qué valor se ORDENA: son dos cosas distintas en las columnas
// compuestas (rechazadas total/vigentes ordena por el total, técnica por las
// abiertas), y tenerlas separadas evita ordenar por el string que se ve.
//
// `valor` devuelve null cuando el backend mandó null - null siempre va al
// final, en cualquier dirección: "sin dato" no es ni el mejor ni el peor.
const COLUMNAS = [
  {
    id: 'aseguradora',
    label: 'Aseguradora',
    texto: true,
    valor: (c) => aseguradoraLabel(c.aseguradora),
    render: (c) => <span className="font-medium">{aseguradoraLabel(c.aseguradora)}</span>,
  },
  {
    id: 'cotizadas',
    label: 'Cotizadas',
    valor: (c) => c.cotizadas ?? null,
    render: (c) => numeroAr(c.cotizadas) ?? '0',
  },
  {
    id: 'benchmark_ganadora',
    label: 'Benchmark ganadora',
    valor: (c) => c.benchmark_ganadora ?? null,
    render: (c) => numeroAr(c.benchmark_ganadora) ?? '0',
  },
  {
    id: 'benchmark_perdedora',
    label: 'Benchmark perdedora',
    valor: (c) => c.benchmark_perdedora ?? null,
    render: (c) => numeroAr(c.benchmark_perdedora) ?? '0',
  },
  {
    id: 'sin_comparable',
    label: 'Sin comparable',
    valor: (c) => c.sin_comparable ?? null,
    render: (c) => numeroAr(c.sin_comparable) ?? '0',
  },
  {
    id: 'tasa_ganadora',
    label: 'Tasa ganadora',
    valor: (c) => (c.tasa_ganadora === null || c.tasa_ganadora === undefined ? null : Number(c.tasa_ganadora)),
    // null NO se muestra como 0%: significa que no hubo ninguna ganadora ni
    // perdedora en el corte (sólo sin_comparable), no que perdió todas.
    render: (c) => porcentajeDeFraccion(c.tasa_ganadora) ?? VACIO,
  },
  {
    id: 'rechazadas',
    label: 'Rechazadas (total/vig.)',
    valor: (c) => c.rechazadas_total ?? null,
    render: (c) => `${numeroAr(c.rechazadas_total) ?? '0'} / ${numeroAr(c.rechazadas_vigentes) ?? '0'}`,
  },
  {
    id: 'bloqueadas',
    label: 'Bloqueadas (total/vig.)',
    valor: (c) => c.bloqueadas_total ?? null,
    render: (c) => `${numeroAr(c.bloqueadas_total) ?? '0'} / ${numeroAr(c.bloqueadas_vigentes) ?? '0'}`,
  },
  {
    id: 'tecnica',
    label: 'Técnica (abiertas/resueltas, días)',
    valor: (c) => c.tecnica_abiertas ?? null,
    render: (c) => {
      const dias = decimalAr(c.dias_en_tecnica_promedio, { maximumFractionDigits: 1 });
      return `${numeroAr(c.tecnica_abiertas) ?? '0'} / ${numeroAr(c.tecnica_resueltas) ?? '0'}${dias ? ` · ${dias} d` : ''}`;
    },
  },
  {
    id: 'alicuota_promedio_ganadora',
    label: 'Alícuota prom. ganadora',
    valor: (c) => (c.alicuota_promedio_ganadora === null || c.alicuota_promedio_ganadora === undefined
      ? null : Number(c.alicuota_promedio_ganadora)),
    render: (c) => decimalAr(c.alicuota_promedio_ganadora, { maximumFractionDigits: 2 }) ?? VACIO,
  },
  {
    id: 'alicuota_promedio_perdedora',
    label: 'Alícuota prom. perdedora',
    valor: (c) => (c.alicuota_promedio_perdedora === null || c.alicuota_promedio_perdedora === undefined
      ? null : Number(c.alicuota_promedio_perdedora)),
    render: (c) => decimalAr(c.alicuota_promedio_perdedora, { maximumFractionDigits: 2 }) ?? VACIO,
  },
  {
    id: 'descuento_promedio_vs_actual',
    label: 'Descuento prom. vs actual',
    valor: (c) => (c.descuento_promedio_vs_actual === null || c.descuento_promedio_vs_actual === undefined
      ? null : Number(c.descuento_promedio_vs_actual)),
    render: (c) => variacionPct(c.descuento_promedio_vs_actual) ?? VACIO,
  },
];

// Orden por defecto: las que más cotizaron arriba. Es la lectura con la que
// se abre el tablero - "¿quién está trabajando la cartera?" - y deja a las
// de 0 eventos, que son varias del catálogo, fuera del primer golpe de vista.
const ORDEN_INICIAL = { columna: 'cotizadas', direccion: 'desc' };

const comparar = (a, b, columna, direccion) => {
  const va = columna.valor(a);
  const vb = columna.valor(b);
  // Sin dato siempre al final, en las dos direcciones.
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  const signo = direccion === 'asc' ? 1 : -1;
  if (columna.texto) return signo * String(va).localeCompare(String(vb), 'es-AR');
  return signo * (va - vb);
};

const CabeceraOrdenable = ({ columna, orden, onOrdenar }) => {
  const activa = orden.columna === columna.id;
  const ariaSort = activa ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th
      className={`px-3 py-3 text-sm font-medium text-slate-300 whitespace-nowrap ${columna.texto ? 'text-left' : 'text-right'}`}
      aria-sort={ariaSort}
    >
      <button
        type="button"
        onClick={() => onOrdenar(columna)}
        className={`inline-flex items-center gap-1 hover:text-white ${activa ? 'text-white' : ''}`}
      >
        {columna.label}
        <span aria-hidden="true" className={activa ? 'text-blue-400' : 'text-slate-600'}>
          {activa && orden.direccion === 'asc' ? '▲' : '▼'}
        </span>
      </button>
    </th>
  );
};

const FilaSkeleton = () => (
  <tr className="animate-pulse">
    {COLUMNAS.map((c) => (
      <td key={c.id} className="px-3 py-3"><div className="h-3 bg-slate-700 rounded w-full max-w-[80px]" /></td>
    ))}
  </tr>
);

// Sub-pestaña "Performance" del módulo ART (BLOQUE 2) - GET
// /art/performance-companias (app/api/v1/art_performance.py del backend, PR
// #102). Performance de CADA aseguradora del catálogo sobre el histórico de
// `empresa_art_estado`.
//
// LO QUE NO ES: un embudo de ventas. `benchmark_ganadora` dice que esa
// compañía cotizó por debajo de la tarifa que la empresa paga hoy, no que
// AYMA le colocó la cuenta - por eso la leyenda de la definición es FIJA en
// el encabezado y se repite en el drill-down. La confusión entre las dos
// cosas ya costó un bloque entero en el tablero de gestión (ver
// ArtReferencialTarifasBoard.jsx, la vieja pestaña "Embudo").
//
// La lista de compañías sale ÍNTEGRA de la respuesta (`companias` trae una
// entrada por cada aseguradora activa, incluidas las de 0 eventos): no se
// arma contra ASEGURADORAS_ART ni contra ninguna lista local, porque el
// catálogo se mueve y dos listas que hay que acordarse de actualizar
// terminan divergiendo.
const ArtPerformanceBoard = ({ token, onAbrirFicha }) => {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [orden, setOrden] = useState(ORDEN_INICIAL);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const [errorCsv, setErrorCsv] = useState(null);
  const [aseguradoraDetalle, setAseguradoraDetalle] = useState(null);

  const filtrosKey = JSON.stringify(filtros);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resultado = await obtenerPerformanceCompanias(token, filtros);
        if (!cancelado) setData(resultado || {});
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filtrosKey]);

  const cambiarFiltro = (campo, valor) => setFiltros((prev) => ({ ...prev, [campo]: valor }));

  const ordenarPor = (columna) => setOrden((prev) => (
    prev.columna === columna.id
      ? { columna: prev.columna, direccion: prev.direccion === 'asc' ? 'desc' : 'asc' }
      : { columna: columna.id, direccion: columna.texto ? 'asc' : 'desc' }
  ));

  const companias = useMemo(
    () => (Array.isArray(data?.companias) ? data.companias : []),
    [data],
  );

  // Las de 0 eventos van SIEMPRE al final, cualquiera sea el orden elegido:
  // son la mitad del catálogo y ordenar por "alícuota promedio ganadora"
  // las traería todas juntas arriba (null primero o último, según) tapando
  // a las que efectivamente cotizaron.
  const companiasOrdenadas = useMemo(() => {
    const columna = COLUMNAS.find((c) => c.id === orden.columna);
    const sinEventos = (c) => !Number(c?.eventos_total);
    return [...companias].sort((a, b) => {
      if (sinEventos(a) !== sinEventos(b)) return sinEventos(a) ? 1 : -1;
      return columna ? comparar(a, b, columna, orden.direccion) : 0;
    });
  }, [companias, orden]);

  const totales = data?.totales || null;
  const advertencias = Array.isArray(data?.advertencias) ? data.advertencias : [];
  const parametros = data?.parametros || null;

  const exportarCsv = async () => {
    setDescargando(true);
    setErrorCsv(null);
    try {
      const blob = await descargarCsvPerformanceCompanias(token, filtros);
      descargarBlobComoArchivo(blob, 'performance-companias.csv');
    } catch (err) {
      setErrorCsv(err.message);
    } finally {
      setDescargando(false);
    }
  };

  if (aseguradoraDetalle) {
    return (
      <ArtPerformanceEventos
        token={token}
        aseguradora={aseguradoraDetalle}
        rango={{ desde: filtros.desde, hasta: filtros.hasta }}
        onVolver={() => setAseguradoraDetalle(null)}
        onAbrirFicha={onAbrirFicha}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Performance por compañía</h2>
          <p className="text-slate-400 text-sm mt-1">
            Ganadora/perdedora = benchmark de precio contra la tarifa actual. No son ventas de AYMA.
          </p>
          {parametros?.hoy && (
            <p className="text-slate-500 text-xs mt-1">
              Corte al {fechaCorta(parametros.hoy)} · {numeroAr(parametros.eventos_considerados) ?? '0'} eventos
              considerados · {numeroAr(parametros.aseguradoras_del_catalogo) ?? '0'} aseguradoras del catálogo
            </p>
          )}
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className={labelClass} htmlFor="perf-desde">Desde</label>
            <input
              id="perf-desde"
              type="date"
              value={filtros.desde}
              onChange={(e) => cambiarFiltro('desde', e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="perf-hasta">Hasta</label>
            <input
              id="perf-hasta"
              type="date"
              value={filtros.hasta}
              onChange={(e) => cambiarFiltro('hasta', e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="perf-seccion">Sección CIIU</label>
            <select
              id="perf-seccion"
              value={filtros.seccion}
              onChange={(e) => cambiarFiltro('seccion', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Todas</option>
              {SECCIONES_CIIU.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="perf-tramo">Tramo</label>
            <select
              id="perf-tramo"
              value={filtros.tramo}
              onChange={(e) => cambiarFiltro('tramo', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Todos</option>
              {TRAMOS_NOMINA_SRT.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 pb-2" title={TOOLTIP_CADUCADOS}>
            <input
              type="checkbox"
              checked={filtros.incluir_caducados}
              onChange={(e) => cambiarFiltro('incluir_caducados', e.target.checked)}
              className="rounded border-slate-600 bg-slate-700"
            />
            <span>Incluir caducados</span>
            <span className="text-slate-500" title={TOOLTIP_CADUCADOS}>
              <Icon name="clock" size={14} />
            </span>
          </label>
        </div>
        <p className="text-slate-500 text-xs mt-3">Incluir caducados: {TOOLTIP_CADUCADOS}.</p>
      </div>

      {error && !loading && (
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">No se pudo cargar la performance por compañía. {error}</p>
        </div>
      )}

      {advertencias.length > 0 && (
        <div className="bg-yellow-500/15 border border-yellow-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-yellow-200 font-medium">Advertencias del cálculo</p>
            <ul className="text-yellow-100/80 mt-1 space-y-1 list-disc list-inside">
              {advertencias.map((a, i) => <li key={i}>{typeof a === 'string' ? a : JSON.stringify(a)}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full">
            {/* La fila de totales viaja DENTRO del thead sticky: al scrollear
                200 filas de detalle, el número contra el que se comparan
                tiene que seguir a la vista. */}
            <thead className="sticky top-0 z-10 bg-slate-800">
              <tr className="bg-slate-700/50">
                {COLUMNAS.map((columna) => (
                  <CabeceraOrdenable
                    key={columna.id}
                    columna={columna}
                    orden={orden}
                    onOrdenar={ordenarPor}
                  />
                ))}
              </tr>
              <tr className="bg-slate-900/70 border-b border-slate-600">
                {COLUMNAS.map((columna) => (
                  <td
                    key={columna.id}
                    className={`px-3 py-2.5 text-sm font-semibold text-slate-100 whitespace-nowrap ${columna.texto ? 'text-left' : 'text-right'}`}
                  >
                    {columna.id === 'aseguradora'
                      ? 'Totales'
                      : (totales ? columna.render(totales) : VACIO)}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading && Array.from({ length: 6 }).map((_, i) => <FilaSkeleton key={i} />)}
              {!loading && companiasOrdenadas.length === 0 && (
                <tr>
                  <td colSpan={COLUMNAS.length} className="px-3 py-8 text-center text-slate-400 text-sm">
                    No hay compañías para este corte.
                  </td>
                </tr>
              )}
              {!loading && companiasOrdenadas.map((compania) => {
                const sinEventos = !Number(compania?.eventos_total);
                return (
                  <tr
                    key={compania.aseguradora}
                    onClick={() => setAseguradoraDetalle(compania.aseguradora)}
                    className={`cursor-pointer hover:bg-slate-700/40 ${sinEventos ? 'opacity-40' : ''}`}
                  >
                    {COLUMNAS.map((columna) => (
                      <td
                        key={columna.id}
                        className={columna.texto ? 'px-3 py-3 text-sm text-slate-200 whitespace-nowrap' : `${tdNum} text-slate-300`}
                      >
                        {columna.render(compania) ?? VACIO}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ArtPerformanceBoard;
