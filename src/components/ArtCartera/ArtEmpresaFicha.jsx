import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { Dato } from '../Crm/FichaHelpers';
import { ArtDatos } from '../Crm/EmpresaArtSection';
import { estrategiaArtInfo, estrategiaArtBadgeClass } from '../Crm/artEstrategia';
import { obtenerEmpresaArt } from './artCarteraApi';
import ArtEstadoModal from './ArtEstadoModal';
import {
  ASEGURADORAS_ART, riesgoBadgeClass, estadoArtInfo, esAlicuotaNoCompetitiva,
} from './artCarteraConstants';

const fechaCorta = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString('es-AR');
};

const CAMPO_BLOQUEADO_LABEL = {
  dotacion: 'Dotación',
  tarifa_pct_historica: 'Tarifa histórica (%)',
  masa_salarial_historica: 'Masa salarial histórica',
};

// Celda de la matriz empresa × aseguradora. `item` es AseguradoraEstadoItem
// (puede ser undefined si el backend nunca devolvió esa aseguradora, o venir
// con estado_efectivo=null cuando nunca se cotizó ahí - ver
// app/schemas/art_consultas.py::AseguradoraEstadoItem).
const CeldaMatriz = ({ aseguradora, item, onRegistrar }) => {
  const nuncaCotizado = !item || !item.tipo_ultimo;
  const efectivo = item?.estado_efectivo;
  const historico = item?.tipo_ultimo;
  const caducado = efectivo === 'COTIZABLE' && historico && historico !== 'COTIZABLE';
  const infoEfectivo = estadoArtInfo(efectivo);
  const noCompetitiva = esAlicuotaNoCompetitiva(item?.alicuota);

  return (
    <td className="px-3 py-3 align-top min-w-[190px] border-l border-slate-700/60 first:border-l-0">
      <div className="flex flex-col gap-1.5">
        {nuncaCotizado ? (
          <span className="text-xs text-slate-500">Nunca cotizado</span>
        ) : (
          <>
            <span className={`inline-block w-fit px-2 py-0.5 rounded text-xs font-medium ${infoEfectivo.badge}`}>
              {infoEfectivo.label}
            </span>
            {caducado && (
              <span className="text-[11px] text-slate-500">histórico: {estadoArtInfo(historico).label}</span>
            )}
            {item.alicuota !== null && item.alicuota !== undefined && (
              <span className={`text-sm font-semibold ${noCompetitiva ? 'text-red-400' : 'text-slate-200'}`}>
                {Number(item.alicuota).toLocaleString('es-AR', { maximumFractionDigits: 3 })}%
                {noCompetitiva && <span className="block text-[11px] font-normal text-red-400/80">No competitiva (&gt;8,02)</span>}
              </span>
            )}
            {item.motivo && <span className="text-[11px] text-slate-400">{item.motivo}</span>}
            {item.productor_bloqueante && (
              <span className="text-[11px] text-slate-400">Bloqueado por {item.productor_bloqueante}</span>
            )}
            <div className="text-[11px] text-slate-500 leading-relaxed">
              {item.fecha_evento && <div>Evento: {fechaCorta(item.fecha_evento)}</div>}
              {item.fecha_caducidad && <div>Caduca: {fechaCorta(item.fecha_caducidad)}</div>}
              {item.dias_restantes !== null && item.dias_restantes !== undefined && (
                <div className={item.dias_restantes < 0 ? 'text-orange-400' : ''}>
                  {item.dias_restantes < 0
                    ? `Venció hace ${Math.abs(item.dias_restantes)} días`
                    : `${item.dias_restantes} días restantes`}
                </div>
              )}
              {item.dias_en_tecnica !== null && item.dias_en_tecnica !== undefined && (
                <div>{item.dias_en_tecnica} días en técnica</div>
              )}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => onRegistrar(aseguradora.id)}
          className="mt-1 text-left text-xs text-blue-400 hover:text-blue-300 transition"
        >
          Registrar respuesta
        </button>
      </div>
    </td>
  );
};

const CalculoStat = ({ label, valor, resaltar }) => (
  <div>
    <p className="text-slate-500 text-xs uppercase tracking-wide">{label}</p>
    <p className={`mt-0.5 text-lg font-semibold ${resaltar ? 'text-blue-400' : ''}`}>
      {valor === null || valor === undefined ? '-' : Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
    </p>
  </div>
);

// Pantalla B - Ficha de empresa (/art/:cuit): cabecera + motor de cálculo +
// matriz de 13 aseguradoras + historial append-only. GET /art/empresas/{cuit}
// (app/api/v1/art_consultas.py::obtener_empresa_art).
const ArtEmpresaFicha = ({ token, cuit, onVolver }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalAseguradora, setModalAseguradora] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resultado = await obtenerEmpresaArt(token, cuit);
      setData(resultado);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, cuit]);

  useEffect(() => { cargar(); }, [cargar]);

  const volverBtn = (
    <button
      type="button"
      onClick={onVolver}
      className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition"
    >
      <Icon name="arrow-left" size={14} />
      Volver a la cartera
    </button>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {volverBtn}
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="h-40 bg-slate-800/50 rounded-xl border border-slate-700" />
          <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {volverBtn}
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-200 text-sm">No se pudo cargar la ficha. {error}</p>
            <button type="button" onClick={cargar} className="mt-2 text-sm text-red-300 hover:text-white underline">
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { empresa, aseguradoras, historial, calculo, calculo_bloqueado_por } = data;
  const info = estrategiaArtInfo(empresa.estrategia_art);
  const mapaAseguradoras = new Map(aseguradoras.map((a) => [a.aseguradora, a]));

  return (
    <div className="space-y-6">
      {volverBtn}

      {/* Cabecera */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold">{empresa.razon_social}</h2>
            {empresa.nombre_fantasia && <p className="text-slate-400 text-sm">{empresa.nombre_fantasia}</p>}
          </div>
          <div className="flex gap-2">
            {empresa.riesgo_suscripcion && (
              <span className={`px-2.5 py-1 rounded text-xs font-medium ${riesgoBadgeClass(empresa.riesgo_suscripcion)}`}>
                Riesgo {empresa.riesgo_suscripcion}
              </span>
            )}
            <span className={`px-2.5 py-1 rounded text-xs font-medium ${estrategiaArtBadgeClass(empresa.estrategia_art)}`}>
              {info.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Dato label="CUIT" valor={empresa.cuit} mono />
          <Dato label="CIIU" valor={empresa.ciiu} />
          <Dato label="Provincia" valor={empresa.provincia} />
          <Dato label="Dotación" valor={empresa.dotacion} />
          <Dato label="Teléfono" valor={empresa.telefono} />
          <Dato label="Email" valor={empresa.email} />
          <ArtDatos ficha={empresa} />
        </div>
      </div>

      {/* Motor de cálculo */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Motor de cálculo</h3>
        {calculo ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CalculoStat label="LRTM" valor={calculo.lrtm} />
            <CalculoStat label="LRTA" valor={calculo.lrta} />
            <CalculoStat label="Comisión" valor={calculo.comision} />
            <CalculoStat label="Win" valor={calculo.win} resaltar />
            <CalculoStat label="Win x trabajador" valor={calculo.win_x_trabajador} resaltar />
            <CalculoStat label="Wina" valor={calculo.wina} />
            <CalculoStat label="LRTAW" valor={calculo.lrtaw} />
            <CalculoStat label="% vs actual" valor={calculo.pct_vs_actual} />
          </div>
        ) : (
          <p className="text-slate-500 text-sm">
            Cálculo bloqueado: falta {CAMPO_BLOQUEADO_LABEL[calculo_bloqueado_por] || calculo_bloqueado_por}.
          </p>
        )}
      </div>

      {/* Matriz de 13 aseguradoras (orden fijo: ver ASEGURADORAS_ART) */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Matriz de aseguradoras</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                {ASEGURADORAS_ART.map((a) => (
                  <th key={a.id} className="px-3 py-2.5 text-left text-xs font-medium text-slate-300 whitespace-nowrap">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {ASEGURADORAS_ART.map((a) => (
                  <CeldaMatriz
                    key={a.id}
                    aseguradora={a}
                    item={mapaAseguradoras.get(a.id)}
                    onRegistrar={setModalAseguradora}
                  />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial append-only, orden cronológico inverso (ya lo trae el backend) */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Historial</h3>
        </div>
        {historial.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">Sin eventos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-300 font-medium">Fecha</th>
                  <th className="px-4 py-2 text-left text-slate-300 font-medium">Aseguradora</th>
                  <th className="px-4 py-2 text-left text-slate-300 font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left text-slate-300 font-medium">Detalle</th>
                  <th className="px-4 py-2 text-left text-slate-300 font-medium">Caduca</th>
                  <th className="px-4 py-2 text-left text-slate-300 font-medium">Fuente</th>
                  <th className="px-4 py-2 text-left text-slate-300 font-medium">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {historial.map((h) => (
                  <tr key={h.id} className={h.activo ? '' : 'opacity-50'}>
                    <td className="px-4 py-2 text-slate-400">{fechaCorta(h.fecha_evento)}</td>
                    {/* aseguradora_externa (ACTUAL en una ART que AYMA no representa,
                        ej. "LIBERTY ART" - ver app/services/aseguradoras.py del backend)
                        no está en ASEGURADORAS_ART a propósito: el nombre real viaja en
                        aseguradora_raw, nunca se pierde detrás del sentinel interno. */}
                    <td className="px-4 py-2">
                      {h.aseguradora_raw || ASEGURADORAS_ART.find((a) => a.id === h.aseguradora)?.label || h.aseguradora}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${estadoArtInfo(h.tipo).badge}`}>
                        {estadoArtInfo(h.tipo).label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {h.alicuota !== null && h.alicuota !== undefined && `${h.alicuota}%`}
                      {h.motivo}
                      {h.productor_bloqueante && `Bloqueante: ${h.productor_bloqueante}`}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{fechaCorta(h.fecha_caducidad) || '-'}</td>
                    <td className="px-4 py-2 text-slate-500">{h.fuente}</td>
                    <td className="px-4 py-2 text-slate-500">{h.nota || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAseguradora && (
        <ArtEstadoModal
          token={token}
          cuit={cuit}
          aseguradora={modalAseguradora}
          onClose={() => setModalAseguradora(null)}
          onRegistrado={() => { setModalAseguradora(null); cargar(); }}
        />
      )}
    </div>
  );
};

export default ArtEmpresaFicha;
