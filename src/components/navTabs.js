// Tabs del CRM (fila 2 del header), compartidos entre Header.jsx (para
// pintarlos) y App.jsx (para saber qué tabs cuentan como "del CRM" al
// persistir el último tab visitado). En un archivo aparte porque Header.jsx
// solo puede exportar el componente (react-refresh/only-export-components).
// Grupos (familiares/empresariales) NO son tabs de esta barra: son
// sub-pestañas dentro de Personas y Empresas (ver PersonasPanel/EmpresasPanel).
export const CRM_TABS = [
  { id: 'crm', label: 'Pipeline' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'personas', label: 'Personas' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'leads', label: 'Leads' },
  { id: 'recuperables', label: 'Recuperables' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'intelligence', label: 'Intelligence' },
];

export const CRM_TAB_IDS = CRM_TABS.map(t => t.id);

// Sub-pestañas del toggle "Siniestros" (fila 3 del header, cuando el toggle
// activo es Siniestros): "En curso" y "Resueltos" filtran la misma lista por
// estado (distinto de CERRADO / CERRADO); "Denunciar" reutiliza el mismo
// formulario de denuncia que el tab "siniestro" de la fila 1.
export const SINIESTROS_TABS = [
  { id: 'admin-siniestros', label: 'En curso' },
  { id: 'siniestros-resueltos', label: 'Resueltos' },
  { id: 'siniestro', label: 'Denunciar' },
];

export const SINIESTROS_TAB_IDS = SINIESTROS_TABS.map(t => t.id);

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
