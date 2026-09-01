import React, { useEffect, useState } from 'react';
import { Dato } from './FichaHelpers';
import { normalizeList, formatApiError, authHeader } from '../../utils/api';
import { estrategiaArtInfo, estrategiaArtBadgeClass } from './artEstrategia';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const fechaCorta = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString('es-AR');
};

// Sección "ART" del bloque de Datos en la ficha de empresa, más el historial
// de verificaciones SRT debajo. Se usa solo dentro de EmpresasPanel.

// Bloque visual con los datos ART de la ficha (se llama junto al resto de
// <Dato> en la sección "Datos").
export const ArtDatos = ({ ficha }) => {
  const info = estrategiaArtInfo(ficha.estrategia_art);
  return (
    <>
      <Dato label="ART vigente" valor={ficha.art_vigente} />
      <Dato label="Número de contrato" valor={ficha.art_numero_contrato} />
      <Dato label="Vigencia desde" valor={fechaCorta(ficha.art_vigencia_desde)} />
      <Dato
        label="Vigencia hasta"
        valor={!ficha.art_vigencia_hasta && ficha.art_vigente
          ? <span className="text-green-400 font-medium">Vigente</span>
          : fechaCorta(ficha.art_vigencia_hasta)}
      />
      <Dato label="Alícuota" valor={ficha.art_alicuota} />
      <div>
        <p className="text-slate-500 text-xs uppercase tracking-wide">Estrategia</p>
        <p className="mt-0.5">
          <span className={`px-2 py-1 rounded text-xs font-medium ${estrategiaArtBadgeClass(ficha.estrategia_art)}`}>
            {info.label}
          </span>
        </p>
      </div>
      <Dato label="Última verificación SRT" valor={fechaCorta(ficha.art_ultima_verificacion)} />
      {ficha.art_verificacion_pendiente && (
        <div className="md:col-span-2">
          <p className="text-slate-400 text-sm">Pendiente de verificación en SRT</p>
        </div>
      )}
    </>
  );
};

// Tabla de historial de verificaciones SRT (fecha, resultado, ART
// encontrada, cambio detectado). Las revertidas se muestran tachadas con el
// motivo de reversión como tooltip.
export const ArtHistorial = ({ token, empresaId }) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!empresaId) return;
    let cancelado = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/srt/verificaciones?empresa_id=${empresaId}`, {
          headers: authHeader(token),
        });
        if (!res.ok) throw new Error(await formatApiError(res));
        const data = await res.json();
        if (!cancelado) setHistorial(normalizeList(data).items);
      } catch (err) {
        console.error('Error cargando historial SRT:', err);
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [empresaId, token]);

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
        Historial de verificaciones SRT
      </h4>
      {loading ? (
        <p className="text-slate-500 text-sm text-center py-6">Cargando...</p>
      ) : error ? (
        <p className="text-red-400 text-sm text-center py-6">{error}</p>
      ) : historial.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">Sin verificaciones registradas</p>
      ) : (
        <div className="overflow-x-auto border border-slate-700 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-3 py-2 text-left text-slate-300 font-medium">Fecha</th>
                <th className="px-3 py-2 text-left text-slate-300 font-medium">Resultado</th>
                <th className="px-3 py-2 text-left text-slate-300 font-medium">ART encontrada</th>
                <th className="px-3 py-2 text-left text-slate-300 font-medium">Cambio detectado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {historial.map((v) => {
                const tachado = v.revertida ? 'line-through text-slate-500' : '';
                return (
                  <tr
                    key={v.id}
                    className={tachado}
                    title={v.revertida ? v.motivo_reversion || 'Verificación revertida' : undefined}
                  >
                    <td className={`px-3 py-2 ${tachado}`}>{fechaCorta(v.fecha) || '-'}</td>
                    <td className={`px-3 py-2 ${tachado}`}>{v.resultado || '-'}</td>
                    <td className={`px-3 py-2 ${tachado}`}>{v.art_encontrada || '-'}</td>
                    <td className={`px-3 py-2 ${tachado}`}>{v.cambio_detectado ? 'Sí' : 'No'}</td>
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
