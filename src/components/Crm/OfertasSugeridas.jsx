import React, { useState } from 'react';
import { authHeader, formatApiError } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

// Badge de score: rango define el color, no un valor fijo por producto,
// porque el mismo producto puede rankear distinto según la cartera de
// cada entidad (edad del auto, vencimiento de póliza, etc.).
const scoreBadgeClase = (score) => {
  const n = Number(score) || 0;
  if (n >= 90) return 'bg-red-500/20 text-red-300 border border-red-500/40';
  if (n >= 70) return 'bg-orange-500/20 text-orange-300 border border-orange-500/40';
  if (n >= 50) return 'bg-blue-500/20 text-blue-300 border border-blue-500/40';
  return 'bg-slate-500/20 text-slate-400 border border-slate-600';
};

// Tarjetas de venta cruzada de la ficha de Persona/Empresa/Grupo. Reemplaza
// los chips deshabilitados de "productos faltantes": el motivo es el
// argumento de venta, así que va completo y visible, no truncado.
// `tipo` es el segmento de URL que espera el backend: 'persona' | 'empresa' | 'grupo'.
const OfertasSugeridas = ({ token, tipo, id, ofertas, onOportunidadCreada, onVerOportunidad }) => {
  const [creandoCodigo, setCreandoCodigo] = useState(null);
  const [error, setError] = useState(null);

  if (!ofertas || ofertas.length === 0) {
    return <p className="text-slate-500 text-sm">Sin ofertas sugeridas por ahora</p>;
  }

  const ordenadas = [...ofertas].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));

  const crearOportunidad = async (oferta) => {
    setCreandoCodigo(oferta.producto_codigo);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/ofertas/${tipo}/${id}/crear-oportunidad`, {
        method: 'POST',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto_codigo: oferta.producto_codigo }),
      });
      if (!res.ok) throw new Error(await formatApiError(res));
      const creada = await res.json();
      await onOportunidadCreada?.(creada);
    } catch (err) {
      console.error('Error creando oportunidad desde oferta sugerida:', err);
      setError(err.message);
    } finally {
      setCreandoCodigo(null);
    }
  };

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
        Ofertas sugeridas
      </h4>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm mb-3">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {ordenadas.map((oferta) => (
          <div
            key={oferta.producto_codigo}
            className={`border rounded-lg p-4 transition ${
              oferta.oportunidad_abierta
                ? 'bg-slate-800/30 border-slate-700 opacity-60'
                : 'bg-slate-700/40 border-slate-600'
            }`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="font-semibold text-white">{oferta.producto_nombre}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${scoreBadgeClase(oferta.score)}`}>
                    Score {oferta.score}
                  </span>
                  {oferta.obligatorio_legal && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-600/30 text-red-200 border border-red-500/50">
                      OBLIGATORIO POR LEY
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-300">{oferta.motivo}</p>
              </div>

              <div className="shrink-0">
                {oferta.oportunidad_abierta ? (
                  <button
                    type="button"
                    onClick={() => onVerOportunidad?.(oferta.oportunidad_id)}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                  >
                    Ver oportunidad
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => crearOportunidad(oferta)}
                    disabled={creandoCodigo === oferta.producto_codigo}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition"
                  >
                    {creandoCodigo === oferta.producto_codigo ? 'Creando...' : 'Crear oportunidad'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OfertasSugeridas;
