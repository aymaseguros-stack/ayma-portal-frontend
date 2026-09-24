import React, { useState } from 'react';
import ArtAccionComercialBoard from './ArtAccionComercialBoard';
import ArtCotizacionesBoard from './ArtCotizacionesBoard';

const SECCIONES = [
  { id: 'lista', label: 'A quién llamar' },
  { id: 'cotizaciones', label: 'Cotizaciones' },
];

const seccionClass = (activa) => `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
  activa ? 'bg-blue-600/30 text-blue-100 border border-blue-500/50' : 'text-slate-400 hover:text-white border border-transparent'
}`;

// Universo ART -> Acción comercial. "Cotizaciones" (OPERACIONES-0008) es una
// sub-pestaña de ESTA pantalla, no una ruta ni un ítem de menú: la
// navegación está congelada. Mismo patrón de estado local que Performance.
const ArtAccionComercialView = ({ token }) => {
  const [seccion, setSeccion] = useState('lista');
  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2" aria-label="Acción comercial">
        {SECCIONES.map((s) => (
          <button key={s.id} type="button" onClick={() => setSeccion(s.id)} className={seccionClass(seccion === s.id)} aria-pressed={seccion === s.id}>
            {s.label}
          </button>
        ))}
      </nav>
      {seccion === 'lista' && <ArtAccionComercialBoard token={token} />}
      {seccion === 'cotizaciones' && <ArtCotizacionesBoard token={token} />}
    </div>
  );
};

export default ArtAccionComercialView;
