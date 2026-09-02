import React, { useEffect, useState } from 'react';
import { authHeader } from '../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const CLASIFICACION_COLOR = {
  bajo: 'bg-red-500',
  medio: 'bg-yellow-400',
  optimo: 'bg-green-500',
};

const esNumeroFinito = (valor) => typeof valor === 'number' && Number.isFinite(valor);

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
        if (!res.ok) {
          // authHeader ya manda Authorization si hay token: un 401 acá es
          // sesión vencida / token inválido de verdad, no un header
          // ausente. El interceptor global (utils/api.js, instalado en
          // main.jsx) ya lo detecta y desloguea solo. Acá nos limitamos a
          // no dejar datos viejos pisando la pantalla y seguimos: esta
          // llamada secundaria nunca debe tumbar el resto del header.
          if (!cancelado) setResumen(null);
          return;
        }
        const data = await res.json();
        if (!cancelado) setResumen(data);
      } catch (err) {
        console.error('Error cargando scoring:', err);
        if (!cancelado) setResumen(null);
      }
    };
    cargar();
    const interval = setInterval(cargar, 60000);
    return () => { cancelado = true; clearInterval(interval); };
  }, [token]);

  // Mismo patrón que Cartera ART: /crm/scoring/resumen tampoco tiene un
  // schema estricto. Si falta algún campo numérico que se usa en cálculos
  // (.toFixed, Math.round, %), no se renderiza el indicador en vez de
  // romper con un TypeError y tumbar todo el header.
  const resumenValido = resumen
    && esNumeroFinito(resumen.puntos_hoy)
    && esNumeroFinito(resumen.objetivo_diario)
    && esNumeroFinito(resumen.puntos_semana)
    && esNumeroFinito(resumen.objetivo_semanal)
    && esNumeroFinito(resumen.porcentaje_semanal);

  if (!resumenValido) return null;

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
