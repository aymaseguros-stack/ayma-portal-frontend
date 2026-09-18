import React, { useEffect, useRef, useState } from 'react';
import ScoringIndicator from './ScoringIndicator';
import { SUB_TABS_POR_SECCION, seccionDeTab } from './navTabs';

// Barra superior (D-NAV-1), en este orden:
//   Dashboard · Mail · CRM | Clientes · Seguros ... Denuncia · Soporte
// Mail, CRM, Clientes y Seguros son admin-only (mismo criterio de permisos
// que antes: esAdminOAgente). "Seguros" agrupa Pólizas y Siniestros, que
// dejaron de estar sueltos en la barra. "Cartera ART" ya no es un ítem
// superior: el módulo completo vive ahora en CRM > Empresas > Universo ART.
//
// Las etiquetas, el orden lógico y los permisos no cambian: lo único que se
// reparte es el layout. Navegación de sección propiamente dicha (arranca
// pegada al logo) vs. accesos de servicio (Denuncia · Soporte), que viajan
// con el grupo de la derecha en lugar de quedar flotando en el medio.
const SECCIONES_IZQUIERDA = (admin) => sinDivisoresColgando([
  { id: 'dashboard', label: 'Dashboard' },
  ...(admin ? [{ id: 'mail', label: 'Mail' }] : []),
  ...(admin ? [{ id: 'crm', label: 'CRM' }] : []),
  { divisor: true, id: 'div-1' },
  ...(admin ? [{ id: 'clientes', label: 'Clientes' }] : []),
  { id: 'seguros', label: 'Seguros' },
]);

const SECCIONES_DERECHA = () => [
  { id: 'denuncia', label: 'Denuncia' },
  { id: 'soporte', label: 'Soporte' },
];

// Con menos ítems (un CLIENTE no ve Mail/CRM/Clientes) un divisor puede
// quedar al borde o pegado a otro divisor. Se descartan esos casos para que
// el bloque no muestre una barra suelta sin nada que separar.
function sinDivisoresColgando(items) {
  return items.filter((item, i) => {
    if (!item.divisor) return true;
    const anterior = items[i - 1];
    const siguiente = items[i + 1];
    return Boolean(anterior) && Boolean(siguiente) && !anterior.divisor && !siguiente.divisor;
  });
}

// Padding horizontal ajustado (no la fuente) para que todo entre en una sola
// fila a 1280/1440px; overflow-x-auto + shrink-0 como red de seguridad si aun
// así no entra.
const tabButtonClass = (active) =>
  `px-2 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition shrink-0 ${
    active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
  }`;

const Header = ({
  displayName, rol, activeTab, setActiveTab, isAdmin, onLogout, token,
  onSeccionChange,
}) => {
  // Un solo estado de "sección activa": se deriva del activeTab. No hay
  // estado paralelo que pueda quedar desincronizado.
  const seccionActiva = seccionDeTab(activeTab);
  // Siniestros sigue siendo admin-only: para un cliente, "Seguros" solo
  // muestra Pólizas.
  const subTabsDeSeccion = SUB_TABS_POR_SECCION[seccionActiva] || null;
  const subTabs = subTabsDeSeccion
    ? subTabsDeSeccion.filter((t) => isAdmin || t.id === 'polizas')
    : null;

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
        {/* Fila 1: dos bloques y un solo espaciador elástico entre ellos.
            IZQUIERDA (pegada al logo, separación fija y corta): logo + mail,
            luego la navegación de secciones. DERECHA (contra el borde):
            Denuncia · Soporte, el contador de scoring, el badge de rol y
            Salir. El `ml-auto` del bloque derecho es el único espacio
            elástico; antes el `justify-between` lo metía en medio del nav y
            dejaba Denuncia/Soporte flotando.
            flex-wrap: si no entran las dos mitades en una sola línea
            (~<1024px), el bloque de la derecha pasa a su propia línea en vez
            de apretar el nav contra la pared. Los nav conservan
            overflow-x-auto + .nav-scroll como red de seguridad en viewports
            angostos. */}
        <div className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div data-testid="header-izquierda" className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">
              <h1 className="text-xl font-bold text-white leading-tight">AYMA</h1>
              {displayName && (
                <p className="text-[11px] text-white/60 leading-tight truncate max-w-[160px]">{displayName}</p>
              )}
            </div>

            <nav className="nav-scroll flex items-center gap-1 overflow-x-auto min-w-0">
              {SECCIONES_IZQUIERDA(isAdmin).map((item) =>
                item.divisor ? (
                  <div key={item.id} className="w-px self-stretch bg-slate-700/60 shrink-0 mx-1" />
                ) : (
                  <button
                    key={item.id}
                    onClick={() => onSeccionChange(item.id)}
                    className={tabButtonClass(seccionActiva === item.id)}
                  >
                    {item.label}
                  </button>
                )
              )}
            </nav>
          </div>

          <div data-testid="header-derecha" className="flex items-center gap-3 shrink-0 ml-auto">
            <nav className="nav-scroll flex items-center gap-1 overflow-x-auto min-w-0">
              {SECCIONES_DERECHA().map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSeccionChange(item.id)}
                  className={tabButtonClass(seccionActiva === item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
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

        {/* Fila 2: sub-menú de la sección activa (Mail, CRM o Seguros), en su
            propia línea. Fuera de esas secciones no se muestra nada. */}
        {subTabs && (
          <div className="border-t border-slate-700/60 py-2">
            <nav className="nav-scroll flex items-center gap-1 overflow-x-auto">
              {subTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={tabButtonClass(
                    tab.id === 'admin-siniestros'
                      ? activeTab === 'admin-siniestros' || activeTab === 'siniestros-resueltos'
                      : activeTab === tab.id
                  )}
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
