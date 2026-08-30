import React from 'react';

const NAV_TABS = (admin) => [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'polizas', label: 'Pólizas' },
  ...(admin ? [{ id: 'clientes', label: 'Clientes' }] : []),
  { id: 'siniestro', label: 'Denuncia' },
  { id: 'soporte', label: 'Soporte' },
  ...(admin ? [{ id: 'admin-siniestros', label: 'Siniestros en curso' }] : []),
];

const CRM_TABS = [
  { id: 'crm', label: 'Pipeline' },
  { id: 'personas', label: 'Personas' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'leads', label: 'Leads' },
  { id: 'recuperables', label: 'Recuperables' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'intelligence', label: 'Intelligence' },
];

const tabButtonClass = (active) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition shrink-0 ${
    active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
  }`;

const Header = ({ displayName, rol, activeTab, setActiveTab, isAdmin, onLogout }) => {
  return (
    <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4">
        {/* Renglón 1: logo + barra operativa a la izquierda, badge + Salir a la derecha */}
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
                  className={tabButtonClass(activeTab === tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
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

        {/* Renglón 2: barra del CRM, ítems en línea (sin dropdown) */}
        {isAdmin && (
          <div className="border-t border-slate-700/60 py-2 flex items-center gap-3 overflow-x-auto">
            <span className="text-[11px] uppercase tracking-wide text-white/50 shrink-0">CRM</span>
            <nav className="flex items-center gap-1">
              {CRM_TABS.map((tab) => (
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
