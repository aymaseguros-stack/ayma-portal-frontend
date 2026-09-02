import React, { useState } from 'react';
import ArtCarteraListado from './ArtCarteraListado';
import ArtEmpresaFicha from './ArtEmpresaFicha';
import ArtDesbloqueosBoard from './ArtDesbloqueosBoard';
import ArtTecnicaVencidaBoard from './ArtTecnicaVencidaBoard';

const SUB_TABS = [
  { id: 'cartera', label: 'Cartera' },
  { id: 'desbloqueos', label: 'Desbloqueos' },
  { id: 'tecnica-vencida', label: 'Técnica vencida' },
];

const subTabButtonClass = (active) =>
  `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
    active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
  }`;

// Bloque 5 del módulo ART: vista de cartera y matriz empresa × 12
// aseguradoras. Consume GET /art/empresas, GET /art/empresas/{cuit}, GET
// /art/desbloqueos y GET /art/tecnica-vencida (app/api/v1/art_consultas.py
// del backend). La app no usa un router de URLs (todo el resto del portal
// navega por estado de pestaña, ver App.jsx), así que la ficha de empresa
// se abre/cierra con estado local en vez de una ruta /art/:cuit real.
const ArtCarteraView = ({ token }) => {
  const [subTab, setSubTab] = useState('cartera');
  const [cuitFicha, setCuitFicha] = useState(null);

  const abrirFicha = (cuit) => setCuitFicha(cuit);
  const volverACartera = () => setCuitFicha(null);

  if (cuitFicha) {
    return <ArtEmpresaFicha token={token} cuit={cuitFicha} onVolver={volverACartera} />;
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 flex-wrap">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={subTabButtonClass(subTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {subTab === 'cartera' && <ArtCarteraListado token={token} onAbrirFicha={abrirFicha} />}
      {subTab === 'desbloqueos' && <ArtDesbloqueosBoard token={token} onAbrirFicha={abrirFicha} />}
      {subTab === 'tecnica-vencida' && <ArtTecnicaVencidaBoard token={token} onAbrirFicha={abrirFicha} />}
    </div>
  );
};

export default ArtCarteraView;
