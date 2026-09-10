import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { listarPropuestasArt } from './artCarteraApi';
import {
  aseguradoraLabel,
  decimalAr,
  diasRestantesTexto,
  estadoPropuestaInfo,
} from './artCarteraConstants';

const VACIO = '—';

// Historial de propuestas de una empresa (BLOQUE 1.3/1.4) - GET
// /art/empresas/{id}/propuestas. Va en la ficha, debajo de los datos de la
// empresa: es "qué se le ofreció a esta empresa y cómo quedó", la pregunta
// que hoy había que contestar de memoria antes de llamarla de nuevo.
//
// Muestra `estado_efectivo` y NO `estado`: una propuesta cuya validez pasó
// se lee VENCIDA aunque la columna diga ENTREGADA (el backend lo calcula al
// leer, ver app/models/crm/propuesta_art.py). Mostrar "Entregada" ahí
// mandaría a alguien a llamar prometiendo un precio que ya no está vigente.
//
// Se monta con `empresaId` (UUID), no con el CUIT: la ficha es la única
// pantalla que lo tiene, igual que para la grilla.
const ArtPropuestasEmpresa = ({ token, empresaId, onAbrirPropuesta }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resultado = await listarPropuestasArt(token, empresaId);
      setItems(resultado?.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, empresaId]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Propuestas</h3>
      </div>

      {loading && (
        <div className="p-6 animate-pulse space-y-2">
          <div className="h-4 bg-slate-700 rounded w-1/2" />
          <div className="h-4 bg-slate-700/60 rounded w-1/3" />
        </div>
      )}

      {!loading && error && (
        <div className="p-6">
          <p className="text-red-200 text-sm">No se pudieron cargar las propuestas. {error}</p>
          <button type="button" onClick={cargar} className="mt-2 text-sm text-red-300 hover:text-white underline">
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="p-6 text-slate-500 text-sm">
          Todavía no se armó ninguna propuesta para esta empresa. Se arman desde la grilla
          de cotización.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-2 text-left text-slate-300 font-medium">Versión</th>
                <th className="px-4 py-2 text-left text-slate-300 font-medium">Aseguradora</th>
                <th className="px-4 py-2 text-left text-slate-300 font-medium">Alícuota</th>
                <th className="px-4 py-2 text-left text-slate-300 font-medium">Estado</th>
                <th className="px-4 py-2 text-left text-slate-300 font-medium">Validez</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {items.map((propuesta) => {
                const estado = estadoPropuestaInfo(propuesta.estado_efectivo);
                const validez = diasRestantesTexto(propuesta.dias_restantes);
                return (
                  <tr key={propuesta.id}>
                    <td className="px-4 py-3 text-slate-300">v{propuesta.version}</td>
                    <td className="px-4 py-3 text-slate-200">
                      {aseguradoraLabel(propuesta.aseguradora)}
                      {propuesta.sujeta_a_f931 && (
                        <span className="block text-[11px] text-amber-400/90">sujeta a F.931</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-100">
                      {decimalAr(propuesta.alicuota_ofertada, { maximumFractionDigits: 3 })}%
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${estado.badge}`}>
                        {estado.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {validez || VACIO}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {onAbrirPropuesta && (
                        <button
                          type="button"
                          onClick={() => onAbrirPropuesta(propuesta.id)}
                          className="inline-flex items-center gap-1.5 text-blue-300 hover:text-white text-sm transition"
                        >
                          Ver
                          <Icon name="arrow-right" size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ArtPropuestasEmpresa;
