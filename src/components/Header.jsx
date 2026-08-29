import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icons';

const NAV_TABS = (admin) => [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'polizas', label: 'Pólizas' },
  ...(admin ? [{ id: 'clientes', label: 'Clientes' }] : []),
  { id: 'vehiculos', label: 'Vehículos' },
  ...(admin ? [{ id: 'art', label: 'ART' }] : []),
  ...(admin ? [{ id: 'integral', label: 'Integral Comercio' }] : []),
  { id: 'siniestro', label: 'Denuncia' },
  { id: 'soporte', label: 'Soporte' },
  ...(admin ? [{ id: 'admin-siniestros', label: 'Siniestros en curso' }] : []),
];

const CRM_DROPDOWN_ITEMS = [
  { id: 'crm', label: 'Pipeline', icon: 'briefcase' },
  { id: 'personas', label: 'Personas', icon: 'users' },
  { id: 'empresas', label: 'Empresas', icon: 'building-office' },
  { id: 'leads', label: 'Leads', icon: 'flag' },
  { id: 'recuperables', label: 'Recuperables', icon: 'arrow-path' },
  { id: 'marketing', label: 'Marketing', icon: 'megaphone' },
  { id: 'compliance', label: 'Compliance', icon: 'check-badge' },
  { id: 'intelligence', label: 'Intelligence', icon: 'magnifying-glass' },
];

const tabButtonClass = (active) =>
  `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
    active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
  }`;

const CrmDropdown = ({ activeTab, setActiveTab }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isActive = CRM_DROPDOWN_ITEMS.some((item) => item.id === activeTab);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${tabButtonClass(isActive)} inline-flex items-center gap-1`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        CRM
        <Icon name="chevron-down" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
          {CRM_DROPDOWN_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition ${
                activeTab === item.id
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
              }`}
            >
              <Icon name={item.icon} className="text-slate-400 shrink-0" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Header = ({ displayName, rol, activeTab, setActiveTab, isAdmin, onLogout }) => {
  return (
    <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-6">
        <div className="flex items-center gap-6 min-w-0">
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-white leading-tight">AYMA</h1>
            {displayName && (
              <p className="text-[11px] text-white/60 leading-tight truncate max-w-[160px]">{displayName}</p>
            )}
          </div>

          {/* El scroll horizontal se limita a los tabs de texto; el
              dropdown de CRM queda fuera de ese contenedor para que su
              panel absoluto no se recorte por el overflow-x. */}
          <nav className="flex items-center gap-1 min-w-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              {NAV_TABS(isAdmin).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={tabButtonClass(activeTab === tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {isAdmin && <CrmDropdown activeTab={activeTab} setActiveTab={setActiveTab} />}
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
    </header>
  );
};

export default Header;
