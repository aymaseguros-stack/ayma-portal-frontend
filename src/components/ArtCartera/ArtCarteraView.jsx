import React, { useState } from 'react';
import ArtCarteraListado from './ArtCarteraListado';
import ArtEmpresaFicha from './ArtEmpresaFicha';
import ArtGrillaCotizacion from './ArtGrillaCotizacion';
import ArtPropuestaDetalle from './ArtPropuestaDetalle';
import ArtDesbloqueosBoard from './ArtDesbloqueosBoard';
import ArtTecnicaVencidaBoard from './ArtTecnicaVencidaBoard';
import ArtReferencialTarifasBoard from './ArtReferencialTarifasBoard';
import ArtLeadsCalientesBoard from './ArtLeadsCalientesBoard';
import ArtAnalisisBoard from './ArtAnalisisBoard';
import ArtMercadoBoard from './ArtMercadoBoard';
import ArtRelevamientoAlicuotas from './ArtRelevamientoAlicuotas';
import ArtPerformanceBoard from './ArtPerformanceBoard';
import ArtAccionComercialView from './ArtAccionComercialView';

const SUB_TABS = [
  { id: 'cartera', label: 'Universo' },
  { id: 'accion-comercial', label: 'Acción comercial' },
  { id: 'desbloqueos', label: 'Desbloqueos' },
  { id: 'tecnica-vencida', label: 'Técnica vencida' },
  { id: 'referencial-tarifas', label: 'Referencial de Tarifas' },
  { id: 'leads-calientes', label: 'Leads Calientes' },
  { id: 'relevamiento', label: 'Relevamiento Tarifa' },
  { id: 'analisis', label: 'Análisis' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'performance', label: 'Performance' },
];

const subTabButtonClass = (active) =>
  `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
    active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
  }`;

// Bloques 5, 6b y 7 del módulo ART: vista de cartera y matriz empresa × 12
// aseguradoras (GET /art/empresas, GET /art/empresas/{cuit}, GET
// /art/desbloqueos, GET /art/tecnica-vencida, GET /art/leads-sin-cobertura -
// app/api/v1/art_consultas.py) más el tablero de gestión (GET
// /art/referencial-tarifas, /art/analisis, /art/mercado -
// app/api/v1/art_dashboard.py). "Referencial de Tarifas" reemplaza a la
// vieja pestaña "Embudo" (BLOQUE 7 - corrección conceptual del director):
// esa mezclaba el embudo comercial de este ciclo con la referencia
// histórica de la planilla en una sola vista; GET /art/embudo sigue
// existiendo y correcto en el backend (da 0 mientras AYMA no cargó ninguna
// cotización propia todavía - ver app/services/art_dashboard.py), pero ya
// no tiene vista propia acá. La app no usa un router de URLs (todo el
// resto del portal navega por estado de pestaña, ver App.jsx), así que la
// ficha de empresa se abre/cierra con estado local en vez de una ruta
// /art/:cuit real. "Relevamiento" (BLOQUE 8) es aparte: Modo Relevamiento
// de carga rápida de alícuotas por teléfono (GET /art/cola-alicuotas, POST
// /art/alicuotas/carga-rapida - ver ArtRelevamientoAlicuotas.jsx).
// "Performance" (BLOQUE 2) es un sub-tab más de esta misma pantalla, no una
// ruta ni un ítem de menú nuevo: GET /art/performance-companias y su
// drill-down por compañía (app/api/v1/art_performance.py). Su detalle abre
// la MISMA ficha de empresa que la cartera, con el `abrirFicha` de acá.
// "Acción comercial" (BLOQUE 3, paso 3) es OTRO sub-tab de esta misma
// sección, por el mismo motivo: la navegación está congelada y no se agregan
// ítems de menú. GET /art/accion-comercial/lista
// (app/api/v1/art_accion_comercial.py) - a quién llamar hoy, con el detalle
// de empresa en modal sobre la lista y no en pantalla propia, para no perder
// la fila siguiente mientras se llama. Adentro tiene su propia sub-pestaña
// "Cotizaciones" (OPERACIONES-0008, ArtAccionComercialView.jsx).
// `encabezado` lo inyecta EmpresasPanel (título "Empresas" + sus
// sub-pestañas) porque este módulo pasó a ser la sub-pestaña "Universo ART"
// de CRM > Empresas (D-NAV-1): dejó de tener un ítem propio en la barra
// superior. Los ids de sub-tab NO cambian; solo sus etiquetas
// ("Cartera" -> "Universo", "Relevamiento" -> "Relevamiento Tarifa").
const ArtCarteraView = ({ token, encabezado = null }) => {
  const [subTab, setSubTab] = useState('cartera');
  const [cuitFicha, setCuitFicha] = useState(null);
  // Grilla de cotización (BLOQUE 1.2): un nivel MÁS ADENTRO de la ficha,
  // no un sub-tab. Se abre con el `id` de la empresa (la grilla va por id,
  // no por CUIT) y al volver se cae a la ficha que quedó abierta detrás,
  // sin perderla. Mismo mecanismo de estado local que la ficha: la app no
  // usa router de URLs (ver el comentario de arriba).
  const [empresaIdGrilla, setEmpresaIdGrilla] = useState(null);
  // Propuesta abierta desde la LISTA de la ficha (BLOQUE 1.3). La que se
  // abre recién armada desde la grilla vive adentro de ArtGrillaCotizacion,
  // porque al volver tiene que caer en la grilla y no en la ficha: son dos
  // caminos de entrada distintos a la misma pantalla.
  const [propuestaIdFicha, setPropuestaIdFicha] = useState(null);

  const abrirFicha = (cuit) => setCuitFicha(cuit);
  const volverACartera = () => setCuitFicha(null);
  const abrirGrilla = (empresaId) => setEmpresaIdGrilla(empresaId);
  const volverALaFicha = () => setEmpresaIdGrilla(null);
  const abrirPropuesta = (propuestaId) => setPropuestaIdFicha(propuestaId);

  if (propuestaIdFicha) {
    return (
      <ArtPropuestaDetalle
        token={token}
        propuestaId={propuestaIdFicha}
        onVolver={() => setPropuestaIdFicha(null)}
        volverLabel="Volver a la ficha"
      />
    );
  }

  if (empresaIdGrilla) {
    return (
      <ArtGrillaCotizacion token={token} empresaId={empresaIdGrilla} onVolver={volverALaFicha} />
    );
  }

  if (cuitFicha) {
    return (
      <ArtEmpresaFicha
        token={token}
        cuit={cuitFicha}
        onVolver={volverACartera}
        onAbrirGrilla={abrirGrilla}
        onAbrirPropuesta={abrirPropuesta}
      />
    );
  }

  return (
    <div className="space-y-6">
      {encabezado}
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
      {subTab === 'accion-comercial' && <ArtAccionComercialView token={token} />}
      {subTab === 'desbloqueos' && <ArtDesbloqueosBoard token={token} onAbrirFicha={abrirFicha} />}
      {subTab === 'tecnica-vencida' && <ArtTecnicaVencidaBoard token={token} onAbrirFicha={abrirFicha} />}
      {subTab === 'referencial-tarifas' && <ArtReferencialTarifasBoard token={token} />}
      {subTab === 'leads-calientes' && <ArtLeadsCalientesBoard token={token} onAbrirFicha={abrirFicha} />}
      {subTab === 'relevamiento' && <ArtRelevamientoAlicuotas token={token} />}
      {subTab === 'analisis' && <ArtAnalisisBoard token={token} />}
      {subTab === 'mercado' && <ArtMercadoBoard token={token} />}
      {subTab === 'performance' && <ArtPerformanceBoard token={token} onAbrirFicha={abrirFicha} />}
    </div>
  );
};

export default ArtCarteraView;
