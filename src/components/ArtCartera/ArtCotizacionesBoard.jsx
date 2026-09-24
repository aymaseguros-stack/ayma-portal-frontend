import React, { useState } from 'react';
import ArtCotizacionesBandejas from './ArtCotizacionesBandejas';
import ArtTandasBoard from './ArtTandasBoard';
import ArtArmarTanda from './ArtArmarTanda';

const VISTAS = [
  { id: 'bandejas', label: 'Bandejas' },
  { id: 'tandas', label: 'Tandas' },
  { id: 'armar', label: 'Armar tanda' },
];

const vistaClass = (activa) => `px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
  activa ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
}`;

// Sub-pestaña "Cotizaciones" de Acción comercial (OPERACIONES-0008): el
// circuito de pedido a la compañía. Tres vistas con estado local -la
// navegación está congelada y la app no usa router-, mismo patrón que la
// sub-pestaña Performance. Ningún número se calcula en el cliente.
const ArtCotizacionesBoard = ({ token }) => {
  const [vista, setVista] = useState('bandejas');
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Cotizaciones ART</h2>
        <p className="text-slate-400 text-sm mt-1">
          Qué se pidió, a quién, qué volvió y qué falta. Las etapas y el SLA los deriva el backend.
        </p>
      </div>
      <nav className="flex items-center gap-1 flex-wrap border-b border-slate-700 pb-2" aria-label="Vistas de cotizaciones">
        {VISTAS.map((v) => (
          <button key={v.id} type="button" onClick={() => setVista(v.id)} className={vistaClass(vista === v.id)} aria-pressed={vista === v.id}>
            {v.label}
          </button>
        ))}
      </nav>
      {vista === 'bandejas' && <ArtCotizacionesBandejas token={token} />}
      {vista === 'tandas' && <ArtTandasBoard token={token} />}
      {vista === 'armar' && <ArtArmarTanda token={token} />}
    </div>
  );
};

export default ArtCotizacionesBoard;
