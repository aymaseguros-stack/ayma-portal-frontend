import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import {
  ErrorPaginaAccionComercial,
  ORDEN_ACCION_COMERCIAL_DEFAULT,
  descargarCsvAccionComercial,
  obtenerListaCompletaAccionComercial,
} from './artCarteraApi';
import {
  PROPENSIONES_CAMBIO, RIESGOS_DEUDA, MASA_CONFIANZAS, masaConfianzaInfo, fuenteMasaLabel,
  TOOLTIP_COMISION_TECHO, aseguradoraLabel, decimalAr, numeroAr, pesosAr, propensionInfo,
} from './artCarteraConstants';
import { descargarBlobComoArchivo } from './descargaArchivo';
import { fechaCorta } from '../../utils/fechas';
import ArtAccionComercialDetalle from './ArtAccionComercialDetalle';

// El backend siempre trabaja con una ventana rodante: "todos" es su tope
// (DIAS_VENTANA_MAX = 365), no "sin ventana". La etiqueta lo dice.
const VENTANAS = [
  { id: '365', label: 'Todos (hasta 365 días)', dias: 365 },
  { id: '30', label: 'Próximos 30 días', dias: 30 },
  { id: '90', label: 'Próximos 90 días', dias: 90 },
];

// ART-81: la pantalla abre en 90 días, no en el tope de la ventana.
// El subtítulo dice "a quién llamar hoy" y arrancar en 365 contradecía eso:
// eran 646 filas, casi todas con el vencimiento a más de medio año. Las
// otras opciones -incluida "Todos"- siguen disponibles sin cambios.
const VENTANA_DEFAULT = '90';

// Búsqueda por razón social O CUIT, sobre las filas YA TRAÍDAS. El endpoint
// no tiene parámetro de texto (ver PARAMS_LISTA_ACCION_COMERCIAL): buscar
// server-side sería un 422, no un filtro ignorado (ART-47).
//
// Se compara sin mayúsculas ni acentos, y el CUIT sin separadores: en la
// base conviven "30-71000001-7" y "30710000017" según por dónde entró la
// empresa, así que un CUIT tipeado con guiones tiene que encontrar los dos.
const normalizarTextoBusqueda = (valor) => (valor ?? '')
  .toString()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const soloDigitos = (valor) => (valor ?? '').toString().replace(/\D/g, '');

const filaCoincideBusqueda = (fila, termino) => {
  const q = normalizarTextoBusqueda(termino);
  if (!q) return true;
  if (normalizarTextoBusqueda(fila.razon_social).includes(q)) return true;
  const digitos = soloDigitos(termino);
  if (digitos && soloDigitos(fila.cuit).includes(digitos)) return true;
  return normalizarTextoBusqueda(fila.cuit).includes(q);
};

// Fuentes de `alicuota_actual_fuente` que la pantalla filtra. El valor sale
// de la fila; el endpoint NO tiene parámetro para esto (ver PARAMS_LISTA en
// app/api/v1/art_accion_comercial.py), así que se filtra sobre lo traído.
const FUENTES_ALICUOTA = [
  { id: '', label: 'Todas las fuentes' },
  { id: 'SRT_VENTANILLA', label: 'Solo SRT_VENTANILLA' },
  { id: 'PLANILLA', label: 'Solo PLANILLA' },
];

const TELEFONOS = [
  { id: '', label: 'Con y sin teléfono' },
  { id: 'con', label: 'Con teléfono' },
  { id: 'sin', label: 'Sin teléfono' },
];

// D-B18 / ART-69 (PR #135). Res. SRT 46/2018.
const MOTIVO_NO_ELEGIBLE = {
  PERMANENCIA_6M: 'Permanencia mínima 6 meses',
  PERMANENCIA_12M: 'Permanencia mínima 12 meses',
};

// ART-76 (PR #136): los dos motivos son trabajos DISTINTOS y por eso se
// muestran distintos - el primero se resuelve consiguiendo cotizaciones, el
// segundo no se resuelve nunca.
const MOTIVO_SIN_COMPANIA = {
  SIN_COMPANIA_SUGERIDA: {
    label: 'Sin evidencia',
    detalle: 'No hay cotizaciones suficientes. Se resuelve consiguiendo cotizaciones.',
    clase: 'bg-slate-500/20 text-slate-300',
  },
  SIN_COMPANIA_COLOCABLE: {
    label: 'Ninguna colocable',
    detalle: 'Había evidencia y era toda de compañías en las que AYMA no coloca.',
    clase: 'bg-amber-500/20 text-amber-300',
  },
};

// ART-74 (backend PR #139): `dotacion_confianza` es la confianza del ORIGEN
// de la dotación y la decide el backend a partir de `dotacion_fuente`. La
// pantalla NO la deduce ni la recalcula: un nivel que no esté acá se muestra
// crudo, y un null no muestra señal.
const DOTACION_CONFIANZA = {
  ALTA: {
    label: 'confianza ALTA',
    detalle: 'Origen confirmado (F931).',
    clase: 'bg-green-500/20 text-green-300',
  },
  MEDIA: {
    label: 'confianza MEDIA',
    detalle: 'Origen razonable: ventanilla SRT, contrato o padrón ARCA.',
    clase: 'bg-amber-500/20 text-amber-300',
  },
  BAJA: {
    label: 'confianza BAJA',
    detalle: 'Origen débil: planilla histórica, rango MiPyME o sin origen identificable.',
    clase: 'bg-slate-500/20 text-slate-400',
  },
};

// ART-74: el techo lo aplica el backend (`dotacion > 5.000`), no la
// pantalla. Es señal visual y no filtro: la fila no se mueve ni se esconde.
const TOOLTIP_DOTACION_SOSPECHOSA = 'Dotación >5.000 — verificar contra F931';

const labelClass = 'block text-slate-400 text-xs mb-1';
const selectClass = 'px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';
// Mismo lenguaje visual que el buscador de la pestaña "Cartera"
// (ArtCarteraListado): mismo input y misma lupa adentro.
const inputClass = 'px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-500';
const thClass = 'text-left px-3 py-2 font-medium whitespace-nowrap';
const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';

const COLUMNAS = 11;

const FilaSkeleton = () => (
  <tr className="animate-pulse">
    {Array.from({ length: COLUMNAS }).map((_, i) => (
      <td key={i} className="px-3 py-3"><div className="h-3 bg-slate-700 rounded w-full max-w-[110px]" /></td>
    ))}
  </tr>
);

// Alícuota actual + de dónde salió (D-B15). ES LA DISTINCIÓN MÁS
// IMPORTANTE DE LA PANTALLA: REFRIGERACION COMERCIAL figura en planilla con
// 10,950 y la ventanilla contestó 12,600. `alicuota_actual_verificada` la
// decide el backend (true sólo con SRT_VENTANILLA | SRT): la pantalla no la
// deduce de la fuente.
const CeldaAlicuotaActual = ({ fila }) => {
  if (fila.alicuota_actual === null || fila.alicuota_actual === undefined) {
    return <span className="text-slate-500">Sin dato</span>;
  }
  const verificada = fila.alicuota_actual_verificada === true;
  return (
    <div className="space-y-1">
      <span className={verificada ? 'text-white font-medium' : 'text-slate-300'}>
        {decimalAr(fila.alicuota_actual)}%
      </span>
      <span
        className={`${badgeBase} block w-fit ${verificada ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}
        title={
          verificada
            ? 'Medida en la ventanilla de la SRT: es la tarifa que la empresa paga hoy.'
            : 'Estimada: sale de la planilla, no de una ventanilla de la SRT.'
        }
      >
        {verificada ? '✓ verificada' : '⚠ no verificada'} · {fila.alicuota_actual_fuente || 'sin fuente'}
      </span>
    </div>
  );
};

// Dotación: el número, su confianza de origen (ART-74) y las dos marcas que
// ya existían -estimada cuando viene de la planilla histórica, y la de
// sospecha cuando el backend la marca-. Todo viene resuelto en la fila.
const CeldaDotacion = ({ fila }) => {
  if (fila.dotacion === null || fila.dotacion === undefined) {
    return <span className="text-slate-500">Sin dato</span>;
  }
  const estimada = fila.dotacion_fuente === 'PLANILLA_HISTORICA';
  const confianza = DOTACION_CONFIANZA[fila.dotacion_confianza];
  return (
    <div className="space-y-1">
      <span className="text-slate-200 whitespace-nowrap">
        {numeroAr(fila.dotacion)}
        {fila.dotacion_sospechosa === true && (
          <span className="ml-1 text-red-300" title={TOOLTIP_DOTACION_SOSPECHOSA} aria-label={TOOLTIP_DOTACION_SOSPECHOSA}>
            ⚠
          </span>
        )}
      </span>
      {confianza && (
        <span className={`${badgeBase} block w-fit ${confianza.clase}`} title={confianza.detalle}>
          {confianza.label}
        </span>
      )}
      {!confianza && fila.dotacion_confianza && (
        <span className={`${badgeBase} block w-fit bg-slate-600/40 text-slate-300`}>
          {fila.dotacion_confianza}
        </span>
      )}
      {estimada && (
        <span
          className={`${badgeBase} block w-fit bg-yellow-500/20 text-yellow-300`}
          title={`Fuente: ${fila.dotacion_fuente}`}
        >
          estimada
        </span>
      )}
    </div>
  );
};

// ART-97: propensión al cambio de ART (la calcula el backend sobre el
// historial SRT). SIN_HISTORIAL va vacío: menos de 12 meses no dicen nada.
// El tooltip lleva `cambios_ultimos_5_anios`, que viaja en la misma fila.
export const BadgePropension = ({ fila }) => {
  const info = propensionInfo(fila?.propension_cambio);
  if (!info || info.id === 'SIN_HISTORIAL') return null;
  const cambios = fila?.cambios_ultimos_5_anios;
  const tooltip = cambios === null || cambios === undefined
    ? info.detalle
    : `${numeroAr(cambios)} ${cambios === 1 ? 'cambio' : 'cambios'} de ART en los últimos 5 años`;
  return (
    <span className={`${badgeBase} ${info.clase}`} title={tooltip} data-testid="badge-propension">
      {info.label}
    </span>
  );
};

// OPERACIONES-0008: "Pedida (n)" cuando hay algo pedido a una compañía que
// todavía no volvió. `pedido_en_curso` y `pedidos_abiertos` vienen en la
// fila (PEDIDA sin respuesta y TECNICA en revisión); acá sólo se muestran.
export const BadgePedidoEnCurso = ({ fila }) => {
  if (!fila?.pedido_en_curso) return null;
  const abiertos = Array.isArray(fila.pedidos_abiertos) ? fila.pedidos_abiertos : [];
  const detalle = abiertos
    .map((p) => `${aseguradoraLabel(p.aseguradora)} · ${p.tipo === 'TECNICA' ? 'en técnica' : 'pedida'} · ${p.dias} d${p.tanda_id ? ` · tanda #${p.tanda_id}` : ''}`)
    .join('\n');
  return (
    <span
      className={`${badgeBase} block w-fit mt-1 bg-blue-500/20 text-blue-300`}
      title={detalle || 'Pedido de cotización en curso'}
      data-testid="badge-pedido-en-curso"
    >
      Pedida ({abiertos.length})
    </span>
  );
};

const CeldaCompaniaSugerida = ({ fila }) => {
  if (fila.compania_sugerida) {
    return (
      <div className="space-y-1">
        <span className="text-slate-200">{aseguradoraLabel(fila.compania_sugerida)}</span>
        {fila.compania_sugerida_origen && (
          <span className={`${badgeBase} block w-fit bg-slate-600/40 text-slate-300`}>
            {fila.compania_sugerida_origen === 'COTIZACION_VIGENTE' ? 'cotización vigente' : 'mediana histórica'}
          </span>
        )}
      </div>
    );
  }
  const motivo = MOTIVO_SIN_COMPANIA[fila.motivo_sin_compania_sugerida];
  if (!motivo) {
    return <span className="text-slate-500">{fila.motivo_sin_compania_sugerida || 'Sin dato'}</span>;
  }
  return (
    <span className={`${badgeBase} ${motivo.clase}`} title={motivo.detalle}>
      {motivo.label}
    </span>
  );
};

// Sub-pestaña "Acción comercial" (BLOQUE 3, paso 3) - a quién llamar HOY.
// Fuente ÚNICA: GET /art/accion-comercial/lista. Ningún campo ni cálculo se
// inventa en el cliente: delta_pp, las tres comisiones, la vía de
// colocación (D-B7), el gate de permanencia (ART-69) y el filtro de
// colocabilidad (ART-76) vienen resueltos en la fila.
//
// QUÉ HACE ÚTIL A LA PANTALLA: las señales, no la tabla. Una empresa no
// elegible NO se esconde -se atenúa y se dice desde cuándo se puede
// tocar-; una alícuota de planilla se marca como no verificada; una
// dotación histórica se marca estimada; OTRO_PRODUCTOR avisa que es media
// comisión; y el null de compañía sugerida distingue "falta evidencia" de
// "no hay ninguna colocable".
//
// El orden lo resuelve el backend con `orden=ventana_asc` (vencimiento ASC,
// comisión actual DESC a igual fecha) y la pantalla no reordena.
// ART-90 / ART-108 (backend #217 / #218): con qué masa se calculó la
// comisión de la fila (F931 del período o Cuadro 1) y qué tan firme es.
const MasaDeFila = ({ fila }) => {
  const info = masaConfianzaInfo(fila.masa_confianza);
  const fuente = fuenteMasaLabel(fila.masa_fuente, fila.masa_periodo);
  if (!info && !fuente) return null;
  return (
    <span className="flex items-center gap-1 mt-1 flex-wrap">
      {info && (
        <span className={`${badgeBase} ${info.clase}`} title={info.detalle} data-testid="chip-masa-confianza">
          Masa {info.label}
        </span>
      )}
      {fuente && <span className="text-[11px] text-slate-500" data-testid="masa-fuente">{fuente}</span>}
    </span>
  );
};

// ART-90: masa BAJA → la comisión es un techo. La cifra no cambia (el
// backend sólo la pondera x0,5 para ordenar); se muestra como "≤ $X".
const CeldaComisionActual = ({ fila }) => (fila.comision_es_techo === true ? (
  <span className="text-slate-300" title={TOOLTIP_COMISION_TECHO} data-testid="comision-techo">
    ≤ {pesosAr(fila.comision_actual_estimada)}
  </span>
) : (
  <span className="text-slate-200">{pesosAr(fila.comision_actual_estimada)}</span>
));

const ArtAccionComercialBoard = ({ token }) => {
  const [soloElegibles, setSoloElegibles] = useState(false);
  const [ventana, setVentana] = useState(VENTANA_DEFAULT);
  const [busqueda, setBusqueda] = useState('');
  const [fuenteAlicuota, setFuenteAlicuota] = useState('');
  const [telefono, setTelefono] = useState('');
  // ART-97: multi. El endpoint filtra UNA propensión (`?propension=`), así
  // que la lista se filtra en la pantalla (ya están todas las filas) y al
  // CSV sólo viaja cuando hay exactamente una elegida.
  const [propensiones, setPropensiones] = useState(() => new Set());
  // ART-103: riesgo de deuda histórica (Sí / No / Todos). Igual que
  // propensión: se filtra en la pantalla y al CSV viaja como ?riesgo_deuda=.
  const [riesgoDeuda, setRiesgoDeuda] = useState('');
  const valorRiesgoDeuda = RIESGOS_DEUDA.find((r) => r.id === riesgoDeuda)?.valor ?? null;
  // ART-90: `?masa_confianza=` lo filtra el backend (uno solo; fuera de
  // ALTA/MEDIA/BAJA es 422), así que viaja en filtrosServidor y al CSV.
  const [masaConfianza, setMasaConfianza] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // D-1: la lista se pagina en el cliente. `parcial` guarda el corte cuando
  // una página intermedia falla; `reintento` vuelve a disparar la carga.
  const [parcial, setParcial] = useState(null);
  const [reintento, setReintento] = useState(0);
  const [progreso, setProgreso] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const [errorCsv, setErrorCsv] = useState(null);
  const [avisoExport, setAvisoExport] = useState(null);
  const [filaDetalle, setFilaDetalle] = useState(null);

  // SÓLO los parámetros que el endpoint conoce: uno que no conozca es 422,
  // no un filtro ignorado (ART-47).
  // D-5: el `limit` NO va acá. El paginador pone limit/offset en cada página
  // de la lista, y el export CSV lo ignora del lado del backend: mandarlo era
  // ruido que hacía creer que el archivo salía cortado en 500.
  const filtrosServidor = useMemo(() => ({
    dias_ventana: VENTANAS.find((v) => v.id === ventana)?.dias ?? 365,
    solo_elegibles: soloElegibles,
    orden: ORDEN_ACCION_COMERCIAL_DEFAULT,
    ...(masaConfianza ? { masa_confianza: masaConfianza } : {}),
  }), [ventana, soloElegibles, masaConfianza]);

  // D-1: se piden TODAS las páginas. El backend pagina de a 500 como mucho y
  // devuelve el `total` real; presentar la primera página como si fuera el
  // universo hacía que con "Todos" se vieran 500 de 653 empresas.
  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    setParcial(null);
    setData(null);
    (async () => {
      try {
        const resultado = await obtenerListaCompletaAccionComercial(token, filtrosServidor, {
          onProgreso: ({ items: traidos, total }) => {
            if (!cancelado) setProgreso({ traidos: traidos.length, total });
          },
        });
        if (!cancelado) setData(resultado);
      } catch (err) {
        if (cancelado) return;
        if (err instanceof ErrorPaginaAccionComercial) {
          // Las filas que SÍ llegaron se muestran, pero con el aviso de que
          // falta gente: una lista corta sin aviso se cuenta como universo.
          setData({ items: err.items, total: err.total, resumen: err.resumen });
          setParcial({ traidas: err.items.length, total: err.total, mensaje: err.message });
        } else {
          setError(err.message);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [token, filtrosServidor, reintento]);

  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);

  // M del contador: el `total` del backend, no las filas que haya en pantalla.
  const totalBackend = Number.isFinite(data?.total) ? data.total : items.length;

  // Los dos filtros que el endpoint no tiene. Se aplican sobre las filas ya
  // traídas y NO tocan ningún valor: eligen qué filas se ven.
  const filas = useMemo(() => items.filter((f) => {
    if (fuenteAlicuota && f.alicuota_actual_fuente !== fuenteAlicuota) return false;
    if (telefono === 'con' && !f.telefono_principal) return false;
    if (telefono === 'sin' && f.telefono_principal) return false;
    if (propensiones.size && !propensiones.has(f.propension_cambio)) return false;
    if (valorRiesgoDeuda !== null && f.riesgo_deuda_historica !== valorRiesgoDeuda) return false;
    if (!filaCoincideBusqueda(f, busqueda)) return false;
    return true;
  }), [items, fuenteAlicuota, telefono, propensiones, valorRiesgoDeuda, busqueda]);

  const hayFiltroDePantalla = Boolean(fuenteAlicuota || telefono || busqueda.trim());
  const togglePropension = (id) => setPropensiones((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });
  // El buscador vacía la tabla por una razón distinta a los otros filtros
  // (no hay coincidencias para lo tipeado), y el estado vacío lo dice.
  const sinResultadosDeBusqueda = Boolean(busqueda.trim()) && filas.length === 0;

  const exportarCsv = useCallback(async () => {
    setDescargando(true);
    setErrorCsv(null);
    setAvisoExport(null);
    try {
      const filtrosCsv = { ...filtrosServidor };
      if (propensiones.size === 1) filtrosCsv.propension = [...propensiones][0];
      if (valorRiesgoDeuda !== null) filtrosCsv.riesgo_deuda = valorRiesgoDeuda;
      const { blob, exportacion } = await descargarCsvAccionComercial(token, filtrosCsv);
      descargarBlobComoArchivo(blob, 'accion-comercial-art.csv');
      // Sólo se avisa cuando el backend DIJO que cortó. Sin truncamiento no
      // se muestra nada: un cartel en cada descarga se deja de leer.
      if (exportacion?.truncado) setAvisoExport(exportacion);
    } catch (err) {
      setErrorCsv(err.message);
    } finally {
      setDescargando(false);
    }
  }, [token, filtrosServidor, propensiones, valorRiesgoDeuda]);

  const resumen = data?.resumen || null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Acción comercial ART</h2>
          <p className="text-slate-400 text-sm mt-1">
            A quién llamar hoy: vencimientos dentro de la ventana, ordenados por fecha y, a igual
            fecha, por la comisión que la cuenta deja hoy.
          </p>
          {resumen && (
            <p className="text-slate-500 text-xs mt-1">
              {numeroAr(filas.length)} empresas
              {filas.length !== totalBackend ? ` de ${numeroAr(totalBackend)}` : ''}
              {' · alícuota verificada en '}
              {decimalAr(resumen.cobertura_verificacion)}% de la lista traída
              {resumen.periodo_mercado ? ` · mercado ${resumen.periodo_mercado}` : ''}
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

      {errorCsv && <p className="text-sm text-red-300">{errorCsv}</p>}

      {avisoExport && (
        <p
          role="status"
          className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2"
        >
          El CSV salió cortado:{' '}
          {avisoExport.filas !== null && avisoExport.filas !== undefined && avisoExport.total
            ? `se exportaron ${numeroAr(avisoExport.filas)} de ${numeroAr(avisoExport.total)} filas`
            : 'no salieron todas las filas'}
          . Achicá la ventana de vencimiento y volvé a exportar. La última fila del archivo
          lo dice también (__TRUNCADO__).
        </p>
      )}

      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex items-end gap-4 flex-wrap">
        <div>
          <label className={labelClass} htmlFor="ac-busqueda">Razón social o CUIT</label>
          <div className="relative">
            <Icon name="magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="ac-busqueda"
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar..."
              className={`${inputClass} w-56 pl-9`}
            />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="ac-ventana">Vencimiento</label>
          <select
            id="ac-ventana"
            className={selectClass}
            value={ventana}
            onChange={(e) => setVentana(e.target.value)}
          >
            {VENTANAS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="ac-fuente">Fuente de la alícuota actual</label>
          <select
            id="ac-fuente"
            className={selectClass}
            value={fuenteAlicuota}
            onChange={(e) => setFuenteAlicuota(e.target.value)}
          >
            {FUENTES_ALICUOTA.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="ac-telefono">Teléfono</label>
          <select
            id="ac-telefono"
            className={selectClass}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          >
            {TELEFONOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <fieldset>
          <legend className={labelClass}>Propensión</legend>
          <div className="flex items-center gap-1 flex-wrap">
            {PROPENSIONES_CAMBIO.map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border cursor-pointer ${
                  propensiones.has(p.id) ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-600 bg-slate-700 text-slate-300'
                }`}
                title={p.detalle}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={propensiones.has(p.id)}
                  onChange={() => togglePropension(p.id)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className={labelClass}>Riesgo deuda histórica</legend>
          <div className="flex items-center gap-1 flex-wrap">
            {RIESGOS_DEUDA.map((r) => (
              <label
                key={r.id || 'todos'}
                className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border cursor-pointer ${
                  riesgoDeuda === r.id ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-slate-600 bg-slate-700 text-slate-300'
                }`}
                title="Baja por falta de pago en los últimos 5 años (ART-99)"
              >
                <input
                  type="radio"
                  name="riesgo-deuda"
                  className="sr-only"
                  checked={riesgoDeuda === r.id}
                  onChange={() => setRiesgoDeuda(r.id)}
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className={labelClass} htmlFor="ac-masa-confianza">Confianza de la masa</label>
          <select
            id="ac-masa-confianza"
            className={selectClass}
            value={masaConfianza}
            onChange={(e) => setMasaConfianza(e.target.value)}
          >
            <option value="">Todas</option>
            {MASA_CONFIANZAS.map((c) => <option key={c.id} value={c.id}>{c.label} · {c.detalle}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 pb-2">
          <input
            type="checkbox"
            checked={soloElegibles}
            onChange={(e) => setSoloElegibles(e.target.checked)}
            className="rounded bg-slate-700 border-slate-600"
          />
          Solo elegibles para traspaso
        </label>
      </div>

      {propensiones.size > 1 && (
        <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          Con más de una propensión elegida el filtro se aplica en la pantalla: el endpoint filtra de a una, así que el
          CSV sale sin filtro de propensión. Elegí una sola para exportarla filtrada.
        </p>
      )}

      {hayFiltroDePantalla && (
        <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          El filtro de fuente de alícuota y el de teléfono se aplican en la pantalla: el endpoint no
          los tiene. El CSV lo arma el backend, así que sale con el vencimiento y la elegibilidad
          elegidos, pero con todas las fuentes y con y sin teléfono.
        </p>
      )}

      {loading && (
        <p role="status" className="text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
          {progreso && progreso.total > progreso.traidos
            ? `Cargando empresas: ${numeroAr(progreso.traidos)} de ${numeroAr(progreso.total)}...`
            : 'Cargando empresas...'}
        </p>
      )}

      {parcial && (
        <div
          role="alert"
          className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center justify-between gap-3 flex-wrap"
        >
          <span>
            Se cargaron {numeroAr(parcial.traidas)} de {numeroAr(parcial.total)} empresas — la lista
            está incompleta, no la uses para armar listados.
            {parcial.mensaje ? ` (${parcial.mensaje})` : ''}
          </span>
          <button
            type="button"
            onClick={() => setReintento((n) => n + 1)}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-sm"
          >
            Reintentar
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-slate-400 border-b border-slate-700">
            <tr>
              <th className={thClass}>Razón social</th>
              <th className={thClass}>Vencimiento</th>
              <th className={thClass}>Dotación</th>
              <th className={thClass}>Alícuota actual</th>
              <th className={thClass}>Alícuota mercado</th>
              <th className={thClass}>Delta pp</th>
              <th className={thClass}>Comisión actual</th>
              <th className={thClass}>Propensión</th>
              <th className={thClass}>Compañía sugerida</th>
              <th className={thClass}>Vía</th>
              <th className={thClass}>Teléfono</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {loading && Array.from({ length: 6 }).map((_, i) => <FilaSkeleton key={i} />)}

            {!loading && filas.length === 0 && (
              <tr>
                <td colSpan={COLUMNAS} className="px-3 py-8 text-center text-slate-500">
                  {sinResultadosDeBusqueda
                    ? `Sin resultados para "${busqueda.trim()}".`
                    : 'Sin empresas para estos filtros.'}
                </td>
              </tr>
            )}

            {!loading && filas.map((fila) => {
              const noElegible = fila.elegible_traspaso === false;
              return (
                <tr
                  key={fila.empresa_id}
                  className={`hover:bg-slate-700/30 ${noElegible ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setFilaDetalle(fila)}
                      className="text-left text-blue-400 hover:text-blue-300 font-medium"
                    >
                      {fila.razon_social || fila.cuit || 'Sin razón social'}
                    </button>
                    <BadgePedidoEnCurso fila={fila} />
                    {noElegible && (
                      <span
                        className={`${badgeBase} block w-fit mt-1 bg-red-500/20 text-red-300`}
                        title="Res. SRT 46/2018: permanencia mínima. No se puede traspasar todavía."
                      >
                        No elegible · {MOTIVO_NO_ELEGIBLE[fila.motivo_no_elegible] || fila.motivo_no_elegible}
                        {fila.habilitado_desde ? ` · desde ${fechaCorta(fila.habilitado_desde)}` : ' · sin fecha de habilitación'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-300">
                    {fechaCorta(fila.fecha_vencimiento) || <span className="text-slate-500">Sin dato</span>}
                    {fila.dias_a_vencimiento !== null && fila.dias_a_vencimiento !== undefined && (
                      <span className="block text-xs text-slate-500">{fila.dias_a_vencimiento} días</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <CeldaDotacion fila={fila} />
                    <MasaDeFila fila={fila} />
                  </td>
                  <td className="px-3 py-3"><CeldaAlicuotaActual fila={fila} /></td>
                  <td className="px-3 py-3 text-slate-300 whitespace-nowrap">
                    {fila.alicuota_mercado_tramo === null || fila.alicuota_mercado_tramo === undefined
                      ? <span className="text-slate-500">Sin dato</span>
                      : `${decimalAr(fila.alicuota_mercado_tramo)}%`}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {fila.delta_pp === null || fila.delta_pp === undefined ? (
                      <span className="text-slate-500">Sin dato</span>
                    ) : (
                      <span className={Number(fila.delta_pp) > 0 ? 'text-green-400' : 'text-slate-300'}>
                        {Number(fila.delta_pp) > 0 ? '+' : ''}{decimalAr(fila.delta_pp)} pp
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {fila.comision_actual_estimada === null || fila.comision_actual_estimada === undefined ? (
                      <span className="text-slate-500" title={fila.motivo_sin_comision_actual || ''}>
                        {fila.motivo_sin_comision_actual || 'Sin dato'}
                      </span>
                    ) : <CeldaComisionActual fila={fila} />}
                  </td>
                  <td className="px-3 py-3"><BadgePropension fila={fila} /></td>
                  <td className="px-3 py-3"><CeldaCompaniaSugerida fila={fila} /></td>
                  <td className="px-3 py-3">
                    {fila.via_colocacion === 'OTRO_PRODUCTOR' ? (
                      <span
                        className={`${badgeBase} bg-orange-500/20 text-orange-300`}
                        title="Va por otro productor: comisión neta a la mitad (2,00% contra 4,00%)."
                      >
                        OTRO PRODUCTOR · media comisión
                      </span>
                    ) : (
                      <span className="text-slate-400">{fila.via_colocacion || '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {fila.telefono_principal
                      ? <span className="text-slate-300">{fila.telefono_principal}</span>
                      : <span className="text-slate-500">Sin teléfono</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p className="text-xs text-slate-500">
          {numeroAr(filas.length)} de {numeroAr(totalBackend)} filas traídas
          {hayFiltroDePantalla || propensiones.size || riesgoDeuda ? ' (filtros de pantalla aplicados)' : ''}.
        </p>
      )}

      {filaDetalle && (
        <ArtAccionComercialDetalle
          token={token}
          fila={filaDetalle}
          onCerrar={() => setFilaDetalle(null)}
        />
      )}
    </div>
  );
};

export default ArtAccionComercialBoard;
