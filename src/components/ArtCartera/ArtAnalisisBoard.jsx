import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { numeroSeguro } from '../../utils/api';
import { obtenerAnalisisArt } from './artCarteraApi';
import {
  ASEGURADORAS_ART, RIESGO_SUSCRIPCION_OPCIONES, numeroAr, decimalAr,
} from './artCarteraConstants';
import { ESTRATEGIA_ART_ORDEN, estrategiaArtInfo } from '../Crm/artEstrategia';

// Config de las 5 tarjetas de metricas (total/promedio/mediana) - clave =
// llave del dict `metricas` que manda GET /art/analisis (ver
// app/schemas/art_dashboard.py::AnalisisARTResponse). `tarifa_pct_historica`
// nunca trae `total` (sumar un % entre empresas no significa nada, lo
// documenta el propio backend) - se muestra igual con guion.
const METRICAS_CONFIG = [
  { key: 'dotacion', label: 'Dotación', sufijo: '', decimalesTotal: 0, decimalesProm: 1 },
  { key: 'masa_salarial_estimada', label: 'Masa salarial', sufijo: '', decimalesTotal: 0, decimalesProm: 0 },
  { key: 'tarifa_pct_historica', label: 'Tarifa histórica', sufijo: '%', decimalesTotal: 0, decimalesProm: 3 },
  { key: 'lrtm', label: 'LRTM', sufijo: '', decimalesTotal: 2, decimalesProm: 2 },
  { key: 'comision', label: 'Comisión', sufijo: '', decimalesTotal: 2, decimalesProm: 2 },
];

const humanizar = (clave) => String(clave || '')
  .replace(/_/g, ' ')
  .toLowerCase()
  .replace(/\b\w/g, (c) => c.toUpperCase());

const RIESGO_BAR_COLOR = { NORMAL: 'bg-green-500', MEDIO: 'bg-yellow-500', ALTO: 'bg-orange-500', NO_COLOCABLE: 'bg-red-500' };
const ESTRATEGIA_BAR_COLOR = { blue: 'bg-blue-500', green: 'bg-green-500', orange: 'bg-orange-500', gray: 'bg-slate-500' };

const MetricaCard = ({ label, bloque, sufijo, decimalesTotal, decimalesProm }) => {
  const val = (campo, decimales) => {
    const f = decimalAr(bloque?.[campo], { maximumFractionDigits: decimales });
    return f ? `${f}${sufijo}` : '—';
  };
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
      <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">{label}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 text-xs">Total</span>
          <span className="text-sm font-semibold">{val('total', decimalesTotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 text-xs">Promedio</span>
          <span className="text-sm font-semibold">{val('promedio', decimalesProm)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 text-xs">Mediana</span>
          <span className="text-sm font-semibold">{val('mediana', decimalesProm)}</span>
        </div>
      </div>
    </div>
  );
};

// Barra horizontal simple en CSS (sin librería de gráficos) - una fila por
// clave del dict de distribución, ancho proporcional al total del grupo.
const BarraDistribucion = ({ label, cantidad, total, colorClass }) => {
  const cant = numeroSeguro(cantidad) ?? 0;
  const pct = total > 0 ? Math.round((cant / total) * 1000) / 10 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{numeroAr(cant) ?? '0'} · {pct.toLocaleString('es-AR')}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
        <div className={`h-full ${colorClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
};

const BloqueDistribucion = ({ titulo, datos, entradas }) => {
  const total = entradas.reduce((sum, [, cantidad]) => sum + (numeroSeguro(cantidad) ?? 0), 0);
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">{titulo}</h3>
      {!datos || entradas.length === 0 || total === 0 ? (
        <p className="text-slate-500 text-sm">Sin datos de distribución.</p>
      ) : (
        <div className="space-y-3">
          {entradas.map(([clave, cantidad, label, colorClass]) => (
            <BarraDistribucion key={clave} label={label} cantidad={cantidad} total={total} colorClass={colorClass} />
          ))}
        </div>
      )}
    </div>
  );
};

// Pestaña 2 del tablero de gestión (Bloque 6b) - Análisis de cartera.
// GET /art/analisis (app/api/v1/art_dashboard.py). Todo lo que llega en
// `data` puede faltar parcial o totalmente (campos faltantes/null/500): las
// 3 secciones se defienden por separado, ninguna tira si otra no vino.
const ArtAnalisisBoard = ({ token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resultado = await obtenerAnalisisArt(token);
        if (!cancelado) setData(resultado || {});
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [token]);

  const metricas = data?.metricas || {};
  const distRiesgo = data?.distribucion_riesgo_suscripcion || {};
  const distEstrategia = data?.distribucion_estrategia_art || {};
  const carteraADefender = Array.isArray(data?.cartera_a_defender) ? data.cartera_a_defender : [];

  const clavesRiesgo = [
    ...RIESGO_SUSCRIPCION_OPCIONES,
    ...Object.keys(distRiesgo).filter((k) => !RIESGO_SUSCRIPCION_OPCIONES.includes(k)),
  ];
  const entradasRiesgo = clavesRiesgo
    .filter((k) => k in distRiesgo)
    .map((k) => [k, distRiesgo[k], k, RIESGO_BAR_COLOR[k] || 'bg-slate-500']);

  // 'SIN_VERIFICAR' es la etiqueta que usa el backend cuando
  // estrategia_art es NULL (nunca se calculó); 'SIN_DATO' es un valor
  // calculado y distinto (se calculó, no se pudo determinar dirección) -
  // dos claves separadas a propósito, ver app/services/art_dashboard.py.
  const clavesEstrategia = [
    ...ESTRATEGIA_ART_ORDEN,
    'SIN_VERIFICAR',
    ...Object.keys(distEstrategia).filter((k) => !ESTRATEGIA_ART_ORDEN.includes(k) && k !== 'SIN_VERIFICAR'),
  ];
  const entradasEstrategia = clavesEstrategia
    .filter((k) => k in distEstrategia)
    .map((k) => {
      if (k === 'SIN_VERIFICAR') return [k, distEstrategia[k], 'Nunca calculado', 'bg-slate-500'];
      const info = estrategiaArtInfo(k);
      return [k, distEstrategia[k], info.label || humanizar(k), ESTRATEGIA_BAR_COLOR[info.color] || 'bg-slate-500'];
    });

  const comisionMaxima = carteraADefender.reduce((max, it) => {
    const v = Number(it?.comision_anual_estimada);
    return Number.isFinite(v) && v > max ? v : max;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Análisis</h2>
        <p className="text-slate-400 text-sm mt-1">
          Estadística de toda la cartera ART
          {data && (
            <> · {numeroAr(data.empresas_con_datos_completos) ?? '—'} de {numeroAr(data.empresas_total) ?? '—'} empresas con datos completos</>
          )}
        </p>
      </div>

      {error && !loading && (
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">No se pudo cargar el análisis. {error}</p>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-28 bg-slate-800/50 rounded-xl border border-slate-700" />)}
          </div>
          <div className="h-48 bg-slate-800/50 rounded-xl border border-slate-700" />
          <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700" />
        </div>
      ) : (
        <>
          {/* a. Tarjetas de totales/promedios/medianas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {METRICAS_CONFIG.map((cfg) => (
              <MetricaCard key={cfg.key} label={cfg.label} bloque={metricas[cfg.key]} sufijo={cfg.sufijo}
                decimalesTotal={cfg.decimalesTotal} decimalesProm={cfg.decimalesProm} />
            ))}
          </div>

          {/* b. Distribuciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BloqueDistribucion titulo="Distribución por riesgo de suscripción" datos={distRiesgo} entradas={entradasRiesgo} />
            <BloqueDistribucion titulo="Distribución por estrategia" datos={distEstrategia} entradas={entradasEstrategia} />
          </div>

          {/* c. Cartera a defender - la tabla más importante de la pantalla */}
          <div className="bg-slate-800/50 rounded-xl border-2 border-blue-500/40 overflow-hidden shadow-lg shadow-blue-500/5">
            <div className="px-6 py-4 border-b border-slate-700 bg-blue-500/10">
              <h3 className="text-base font-bold text-white">Cartera a defender</h3>
              <p className="text-slate-400 text-xs mt-1">
                Empresas donde cada aseguradora es hoy la ACTUAL, ordenadas por comisión anual estimada.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-sm font-medium text-slate-300">Aseguradora</th>
                    <th className="px-4 py-2.5 text-right text-sm font-medium text-slate-300">Empresas</th>
                    <th className="px-4 py-2.5 text-right text-sm font-medium text-slate-300">Dotación total</th>
                    <th className="px-4 py-2.5 text-left text-sm font-medium text-slate-300">Comisión anual estimada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {carteraADefender.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No hay datos de cartera a defender</td></tr>
                  ) : (
                    carteraADefender.map((it, idx) => {
                      const comision = Number(it?.comision_anual_estimada);
                      const pct = comisionMaxima > 0 && Number.isFinite(comision) ? (comision / comisionMaxima) * 100 : 0;
                      const label = ASEGURADORAS_ART.find((a) => a.id === it?.aseguradora)?.label || it?.aseguradora || '—';
                      return (
                        <tr key={`${it?.aseguradora || 'na'}-${idx}`}>
                          <td className="px-4 py-3 text-sm font-medium">{label}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-300">{numeroAr(it?.empresas) ?? '0'}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-300">{numeroAr(it?.dotacion_total) ?? '0'}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-blue-300 whitespace-nowrap">
                                {decimalAr(it?.comision_anual_estimada, { maximumFractionDigits: 2 }) ?? '—'}
                              </span>
                              <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden min-w-[60px]">
                                <div className="h-full bg-blue-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ArtAnalisisBoard;
