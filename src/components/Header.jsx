import React from 'react';
import ScoringIndicator from './ScoringIndicator';
import { CRM_TABS, MAIL_TABS } from './navTabs';

// Fila 1: navegación principal a la izquierda del logo. "Clientes" y
// "Siniestros" son admin-only; "Denuncia" y "Soporte" (extremo derecho) son
// los accesos de clientes y demás usuarios, por eso van agrupados aparte.
const NAV_TABS = (admin) => [
  { id: 'polizas', label: 'Pólizas' },
  ...(admin ? [{ id: 'clientes', label: 'Clientes' }] : []),
  ...(admin ? [{ id: 'admin-siniestros', label: 'Siniestros' }] : []),
];

// Padding horizontal ajustado (no la fuente) para que los tabs del CRM y de
// Siniestros entren sin desbordar la fila 3 a 1280/1440px; overflow-x-auto +
// shrink-0 como red de seguridad si aun así no entran.
const tabButtonClass = (active) =>
  `px-2.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition shrink-0 ${
    active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
  }`;

const toggleButtonClass = (active) =>
  `px-2.5 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition shrink-0 ${
    active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
  }`;

// Sub-tabs de la fila 3 según el toggle activo de la fila 2. Dashboard no
// tiene fila 3 (se pinta el dashboard directamente en el contenido).
// Siniestros ya no es un toggle de fila 2: es su propia vista en la fila 1,
// con sub-pestañas propias (ver navTabs.SINIESTROS_TABS), igual que Pólizas.
const SUB_TABS_POR_PANEL = {
  mail: MAIL_TABS,
  crm: CRM_TABS,
};

// IDs de la vista Siniestros (fila 1), para resaltar el tab aunque el
// usuario esté en su sub-pestaña "Resueltos".
const SINIESTROS_VIEW_IDS = ['admin-siniestros', 'siniestros-resueltos'];

const Header = ({
  displayName, rol, activeTab, setActiveTab, isAdmin, onLogout, token,
  panelPrincipal, onPanelPrincipalChange,
}) => {
  const subTabs = isAdmin ? SUB_TABS_POR_PANEL[panelPrincipal] : null;

  return (
    <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4">
        {/* Fila 1: logo + mail a la izquierda, nav principal, y a la derecha
            Soporte + badge de rol + Salir */}
        <div className="py-3 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6 min-w-0">
            <div className="shrink-0">
              <h1 className="text-xl font-bold text-white leading-tight">AYMA</h1>
              {displayName && (
                <p className="text-[11px] text-white/60 leading-tight truncate max-w-[160px]">{displayName}</p>
              )}
            </div>

            <nav className="flex items-center gap-1 overflow-x-auto min-w-0">
              {NAV_TABS(isAdmin).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={tabButtonClass(
                    tab.id === 'admin-siniestros'
                      ? SINIESTROS_VIEW_IDS.includes(activeTab)
                      : activeTab === tab.id
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('siniestro')}
              className={tabButtonClass(activeTab === 'siniestro')}
            >
              Denuncia
            </button>
            <button
              onClick={() => setActiveTab('soporte')}
              className={tabButtonClass(activeTab === 'soporte')}
            >
              Soporte
            </button>
            {isAdmin && <ScoringIndicator token={token} />}
            {rol && (
              <span className="px-3 py-1 bg-blue-600/30 text-blue-300 rounded-full text-sm capitalize">
                {rol}
              </span>
            )}
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg transition text-sm font-medium"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Fila 2: toggle mutuamente excluyente Dashboard / Mail / CRM */}
        <div className="border-t border-slate-700/60 py-2 flex items-center gap-3 overflow-x-auto">
          <div className="flex items-center gap-0.5 bg-slate-900/40 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => onPanelPrincipalChange('dashboard')}
              className={toggleButtonClass(panelPrincipal === 'dashboard')}
            >
              Dashboard
            </button>
            {isAdmin && (
              <button
                onClick={() => onPanelPrincipalChange('mail')}
                className={toggleButtonClass(panelPrincipal === 'mail')}
              >
                Mail
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => onPanelPrincipalChange('crm')}
                className={toggleButtonClass(panelPrincipal === 'crm')}
              >
                CRM
              </button>
            )}
          </div>
        </div>

        {/* Fila 3: sub-tabs del toggle activo, en su propia línea debajo de
            la fila 2. Dashboard no tiene fila 3. */}
        {subTabs && (
          <div className="border-t border-slate-700/60 py-2">
            <nav className="flex items-center gap-1 overflow-x-auto">
              {subTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={tabButtonClass(activeTab === tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
