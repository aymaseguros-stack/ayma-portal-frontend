import React, { useEffect, useState } from 'react';
import { authHeader } from '../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const CLASIFICACION_COLOR = {
  bajo: 'bg-red-500',
  medio: 'bg-yellow-400',
  optimo: 'bg-green-500',
};

// Indicador compacto de scoring diario en el header ("Hoy 47/130"), con
// barra de 60px coloreada por clasificación y tooltip con el acumulado semanal.
const ScoringIndicator = ({ token }) => {
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelado = false;
    const cargar = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/crm/scoring/resumen`, { headers: authHeader(token) });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelado) setResumen(data);
      } catch (err) {
        console.error('Error cargando scoring:', err);
      }
    };
    cargar();
    const interval = setInterval(cargar, 60000);
    return () => { cancelado = true; clearInterval(interval); };
  }, [token]);

  if (!resumen) return null;

  const color = CLASIFICACION_COLOR[resumen.clasificacion] || 'bg-slate-500';
  const porcentaje = Math.min(100, Math.max(0, resumen.porcentaje_diario || 0));

  return (
    <div
      className="hidden sm:flex items-center gap-2 shrink-0"
      title={`Esta semana: ${resumen.puntos_semana}/${resumen.objetivo_semanal} pts (${resumen.porcentaje_semanal.toFixed(0)}%)`}
    >
      <span className="text-xs text-white/70 whitespace-nowrap">
        Hoy {Math.round(resumen.puntos_hoy)}/{resumen.objetivo_diario}
      </span>
      <div className="w-[60px] h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
};

export default ScoringIndicator;
