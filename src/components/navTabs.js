// Tabs del CRM (fila 2 del header), compartidos entre Header.jsx (para
// pintarlos) y App.jsx (para saber qué tabs cuentan como "del CRM" al
// persistir el último tab visitado). En un archivo aparte porque Header.jsx
// solo puede exportar el componente (react-refresh/only-export-components).
// Grupos (familiares/empresariales) NO son tabs de esta barra: son
// sub-pestañas dentro de Personas y Empresas (ver PersonasPanel/EmpresasPanel).
export const CRM_TABS = [
  { id: 'crm', label: 'Pipeline' },
  { id: 'oportunidades', label: 'Oportunidades' },
  { id: 'agenda', label: 'Agenda' },
  // Seguimientos de hoy (backend PR #176): la cadencia +24 h / +72 h / +7 d
  // desde la cotización entregada. Va pegado a Agenda porque es lo mismo que
  // se mira a la mañana, y es una PESTAÑA del CRM: la navegación está
  // congelada, no se suma una ruta nueva.
  { id: 'seguimientos', label: 'Seguimientos de hoy' },
  { id: 'personas', label: 'Personas' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'leads', label: 'Leads' },
  { id: 'recuperables', label: 'Recuperables' },
  { id: 'marketing', label: 'Marketing' },
  // PUNTOS DE CONTACTO (C-12B). Son SUB-PESTAÑAS del CRM, no una entrada
  // nueva de la barra superior (decisión D-C12-1): el CRM es el módulo
  // comercial y esta fila es su sub-menú. Van pegadas a Marketing y Leads
  // porque son la misma pregunta -de dónde viene el negocio-, sólo que
  // medida por una entidad nuestra y no por un utm_source que el navegador
  // pierde en el primer reenvío por WhatsApp.
  { id: 'puntos-contacto', label: 'Puntos de contacto' },
  { id: 'comisiones-referido', label: 'Comisiones de referido' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'intelligence', label: 'Intelligence' },
];

export const CRM_TAB_IDS = CRM_TABS.map(t => t.id);

// Sub-pestañas propias de la vista "Siniestros" (fila 1): "En curso" y
// "Resueltos" filtran la misma lista por estado (distinto de CERRADO /
// CERRADO). Se renderizan dentro de la vista misma, igual que las
// sub-pestañas de Pólizas, no en la fila 3 del header.
export const SINIESTROS_TABS = [
  { id: 'admin-siniestros', label: 'En curso' },
  { id: 'siniestros-resueltos', label: 'Resueltos' },
];

// Sub-pestañas del toggle "Mail" (fila 3 del header, cuando el toggle activo
// es Mail): bandeja general, correos sin vincular a una ficha del CRM,
// "ruido" (correos marcados como no relevantes, con la herramienta de
// limpieza masiva por remitente), enviados, y estado de las cuentas conectadas.
export const MAIL_TABS = [
  { id: 'mail-bandeja', label: 'Bandeja' },
  { id: 'mail-sin-vincular', label: 'Sin vincular' },
  { id: 'mail-ruido', label: 'Ruido' },
  { id: 'mail-enviados', label: 'Enviados' },
  { id: 'mail-cuentas', label: 'Cuentas' },
];

export const MAIL_TAB_IDS = MAIL_TABS.map(t => t.id);

// Sub-menú de la entrada superior "Seguros" (D-NAV-1): Pólizas y Siniestros
// dejan de estar sueltos en la barra superior y pasan a colgar de acá.
// Siniestros conserva sus propias sub-pestañas dentro de la vista
// (SINIESTROS_TABS).
export const SEGUROS_TABS = [
  { id: 'polizas', label: 'Pólizas' },
  { id: 'admin-siniestros', label: 'Siniestros' },
];

export const SEGUROS_TAB_IDS = ['polizas', 'admin-siniestros', 'siniestros-resueltos'];

// Sub-menú de la entrada superior "Dirección" (ADMIN-only). Módulo de
// gobierno interno: el tablero de la empresa, la ficha de cada gerencia, el
// padrón de proveedores y el estado de seguridad. Es aditivo: no toca las
// secciones ni los tabs que ya existían.
export const DIRECCION_TABS = [
  { id: 'direccion-tablero', label: 'Tablero' },
  { id: 'direccion-gerencias', label: 'Gerencias' },
  { id: 'direccion-proveedores', label: 'Proveedores' },
  // FINANZAS (F-11): presupuesto, gastos y comisiones liquidadas. Va entre
  // Proveedores y Seguridad porque lee del padrón de proveedores (el costo
  // mensual de cada uno es el gasto recurrente del mes).
  { id: 'direccion-finanzas', label: 'Finanzas' },
  { id: 'direccion-seguridad', label: 'Seguridad' },
];

export const DIRECCION_TAB_IDS = DIRECCION_TABS.map(t => t.id);

// Única fuente de verdad de "qué ítem superior está activo": se deriva del
// activeTab, no de un estado paralelo. Antes había dos estados
// independientes (panelPrincipal + activeTab) y por eso, estando en
// Siniestros, CRM seguía resaltado y su submenú seguía visible.
export const SECCIONES = ['dashboard', 'mail', 'crm', 'clientes', 'seguros', 'direccion', 'denuncia', 'soporte'];

export const seccionDeTab = (tab) => {
  if (tab === 'dashboard') return 'dashboard';
  if (MAIL_TAB_IDS.includes(tab)) return 'mail';
  if (CRM_TAB_IDS.includes(tab)) return 'crm';
  if (tab === 'clientes') return 'clientes';
  if (SEGUROS_TAB_IDS.includes(tab)) return 'seguros';
  if (DIRECCION_TAB_IDS.includes(tab)) return 'direccion';
  if (tab === 'siniestro') return 'denuncia';
  if (tab === 'soporte') return 'soporte';
  return null; // 'datos', 'seguridad': no pertenecen a la barra superior
};

// Sub-menú de fila 2 por sección activa. Dashboard, Clientes, Denuncia y
// Soporte no tienen sub-menú.
export const SUB_TABS_POR_SECCION = {
  mail: MAIL_TABS,
  crm: CRM_TABS,
  seguros: SEGUROS_TABS,
  direccion: DIRECCION_TABS,
};
