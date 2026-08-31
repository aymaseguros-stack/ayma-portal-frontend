import React, { useState } from 'react';
import OfertasDetectadasPanel from './OfertasDetectadasPanel';
import ReglasOfertaPanel from './ReglasOfertaPanel';

const SUB_TABS = [
  { id: 'detectadas', label: 'Detectadas' },
  { id: 'reglas', label: 'Reglas' },
];

const subTabButtonClass = (active) =>
  `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
    active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
  }`;

// Tab "Oportunidades" del CRM (fila 2): el ranking global que arma el motor
// de oferta ("Detectadas") y la administración de las reglas que lo generan
// ("Reglas"), como pestaña interna propia -no comparte fila con las
// sub-pestañas de Pipeline/Personas/Empresas.
const OportunidadesPanel = ({ token, onIrAFicha }) => {
  const [subTab, setSubTab] = useState('detectadas');

  return (
    <div className="space-y-6">
      <div className="flex gap-1 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={subTabButtonClass(subTab === t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'detectadas' && <OfertasDetectadasPanel token={token} onIrAFicha={onIrAFicha} />}
      {subTab === 'reglas' && <ReglasOfertaPanel token={token} />}
    </div>
  );
};

export default OportunidadesPanel;
