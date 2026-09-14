import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import {
  LIMIT_MAX_ACCION_COMERCIAL,
  ORDEN_ACCION_COMERCIAL_DEFAULT,
  descargarCsvAccionComercial,
  obtenerListaAccionComercial,
} from './artCarteraApi';
import { aseguradoraLabel, decimalAr, numeroAr, pesosAr } from './artCarteraConstants';
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

// CAMBIO 3 del pedido: una dotación estimada que además supera este techo
// se marca como sospechosa. El umbral es de PANTALLA (no hay campo del
// backend que lo diga) y sólo cambia una etiqueta: no filtra ni recalcula.
const DOTACION_SOSPECHOSA_DESDE = 5000;

const labelClass = 'block text-slate-400 text-xs mb-1';
const selectClass = 'px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';
const thClass = 'text-left px-3 py-2 font-medium whitespace-nowrap';
const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';

const COLUMNAS = 10;

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

// CAMBIO 3: dotación estimada (PLANILLA_HISTORICA) y, si además pasa el
// techo, sospechosa.
const CeldaDotacion = ({ fila }) => {
  if (fila.dotacion === null || fila.dotacion === undefined) {
    return <span className="text-slate-500">Sin dato</span>;
  }
  const estimada = fila.dotacion_fuente === 'PLANILLA_HISTORICA';
  const sospechosa = estimada && Number(fila.dotacion) > DOTACION_SOSPECHOSA_DESDE;
  return (
    <div className="space-y-1">
      <span className="text-slate-200">{numeroAr(fila.dotacion)}</span>
      {estimada && (
        <span
          className={`${badgeBase} block w-fit ${sospechosa ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}
          title={`Fuente: ${fila.dotacion_fuente}`}
        >
          {sospechosa ? `⚠ sospechosa (> ${numeroAr(DOTACION_SOSPECHOSA_DESDE)})` : 'estimada'}
        </span>
      )}
    </div>
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
const ArtAccionComercialBoard = ({ token }) => {
  const [soloElegibles, setSoloElegibles] = useState(false);
  const [ventana, setVentana] = useState('365');
  const [fuenteAlicuota, setFuenteAlicuota] = useState('');
  const [telefono, setTelefono] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const [errorCsv, setErrorCsv] = useState(null);
  const [filaDetalle, setFilaDetalle] = useState(null);

  // SÓLO los parámetros que el endpoint conoce: uno que no conozca es 422,
  // no un filtro ignorado (ART-47).
  const filtrosServidor = useMemo(() => ({
    dias_ventana: VENTANAS.find((v) => v.id === ventana)?.dias ?? 365,
    solo_elegibles: soloElegibles,
    orden: ORDEN_ACCION_COMERCIAL_DEFAULT,
    limit: LIMIT_MAX_ACCION_COMERCIAL,
  }), [ventana, soloElegibles]);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resultado = await obtenerListaAccionComercial(token, filtrosServidor);
        if (!cancelado) setData(resultado);
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [token, filtrosServidor]);

  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);

  // Los dos filtros que el endpoint no tiene. Se aplican sobre las filas ya
  // traídas y NO tocan ningún valor: eligen qué filas se ven.
  const filas = useMemo(() => items.filter((f) => {
    if (fuenteAlicuota && f.alicuota_actual_fuente !== fuenteAlicuota) return false;
    if (telefono === 'con' && !f.telefono_principal) return false;
    if (telefono === 'sin' && f.telefono_principal) return false;
    return true;
  }), [items, fuenteAlicuota, telefono]);

  const hayFiltroDePantalla = Boolean(fuenteAlicuota || telefono);

  const exportarCsv = useCallback(async () => {
    setDescargando(true);
    setErrorCsv(null);
    try {
      const blob = await descargarCsvAccionComercial(token, filtrosServidor);
      descargarBlobComoArchivo(blob, 'accion-comercial-art.csv');
    } catch (err) {
      setErrorCsv(err.message);
    } finally {
      setDescargando(false);
    }
  }, [token, filtrosServidor]);

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
              {numeroAr(data.total) ?? '0'} empresas · alícuota verificada en{' '}
              {decimalAr(resumen.cobertura_verificacion)}% de la lista
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

      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 flex items-end gap-4 flex-wrap">
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

      {hayFiltroDePantalla && (
        <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          El filtro de fuente de alícuota y el de teléfono se aplican en la pantalla: el endpoint no
          los tiene. El CSV lo arma el backend, así que sale con el vencimiento y la elegibilidad
          elegidos, pero con todas las fuentes y con y sin teléfono.
        </p>
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
                  Sin empresas para estos filtros.
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
                  <td className="px-3 py-3"><CeldaDotacion fila={fila} /></td>
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
                    ) : (
                      <span className="text-slate-200">{pesosAr(fila.comision_actual_estimada)}</span>
                    )}
                  </td>
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
          {numeroAr(filas.length)} de {numeroAr(items.length)} filas traídas
          {hayFiltroDePantalla ? ' (filtros de pantalla aplicados)' : ''}.
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
