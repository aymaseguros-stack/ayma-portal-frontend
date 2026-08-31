import React, { useEffect, useRef, useState } from 'react';
import ScoringIndicator from './ScoringIndicator';
import { CRM_TABS, MAIL_TABS } from './navTabs';

// Nav de fila 1 (junto al toggle): Pólizas / Clientes / Siniestros. "Clientes"
// y "Siniestros" son admin-only.
const NAV_TABS = (admin) => [
  { id: 'polizas', label: 'Pólizas' },
  ...(admin ? [{ id: 'clientes', label: 'Clientes' }] : []),
  ...(admin ? [{ id: 'admin-siniestros', label: 'Siniestros' }] : []),
];

// Padding horizontal ajustado (no la fuente) para que todo entre en una sola
// fila a 1280/1440px; overflow-x-auto + shrink-0 como red de seguridad si aun
// así no entra.
const tabButtonClass = (active) =>
  `px-2 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition shrink-0 ${
    active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
  }`;

const toggleButtonClass = (active) =>
  `px-2 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition shrink-0 ${
    active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
  }`;

// Sub-tabs de la fila 2 según el toggle activo de la fila 1. Dashboard no
// tiene fila 2 (se pinta el dashboard directamente en el contenido).
// Siniestros no es un toggle: es su propia vista en la fila 1, con
// sub-pestañas propias (ver navTabs.SINIESTROS_TABS), igual que Pólizas.
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

  // Menú del badge de rol: única entrada al día es "Seguridad" (2FA).
  const [menuRolAbierto, setMenuRolAbierto] = useState(false);
  const menuRolRef = useRef(null);
  useEffect(() => {
    if (!menuRolAbierto) return;
    const cerrarSiClickAfuera = (e) => {
      if (menuRolRef.current && !menuRolRef.current.contains(e.target)) {
        setMenuRolAbierto(false);
      }
    };
    document.addEventListener('mousedown', cerrarSiClickAfuera);
    return () => document.removeEventListener('mousedown', cerrarSiClickAfuera);
  }, [menuRolAbierto]);

  return (
    <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4">
        {/* Fila 1: logo + toggle Dashboard / Mail / CRM + nav Pólizas /
            Clientes / Siniestros a la izquierda (separados por un divisor
            vertical sutil), y a la derecha Denuncia + Soporte + badge de rol
            + Salir. */}
        <div className="py-3 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">
              <h1 className="text-xl font-bold text-white leading-tight">AYMA</h1>
              {displayName && (
                <p className="text-[11px] text-white/60 leading-tight truncate max-w-[160px]">{displayName}</p>
              )}
            </div>

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

            <div className="w-px self-stretch bg-slate-700/60 shrink-0" />

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
              <div className="relative" ref={menuRolRef}>
                <button
                  onClick={() => setMenuRolAbierto(!menuRolAbierto)}
                  className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-full text-sm capitalize transition"
                >
                  {rol}
                </button>
                {menuRolAbierto && (
                  <div className="absolute right-0 mt-2 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-10">
                    <button
                      onClick={() => { setActiveTab('seguridad'); setMenuRolAbierto(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition ${
                        activeTab === 'seguridad' ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      🔒 Seguridad
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg transition text-sm font-medium"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Fila 2: sub-tabs del toggle activo, en su propia línea debajo de
            la fila 1. Dashboard no tiene fila 2. */}
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
