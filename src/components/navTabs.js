// Tabs del CRM (fila 2 del header), compartidos entre Header.jsx (para
// pintarlos) y App.jsx (para saber qué tabs cuentan como "del CRM" al
// persistir el último tab visitado). En un archivo aparte porque Header.jsx
// solo puede exportar el componente (react-refresh/only-export-components).
export const CRM_TABS = [
  { id: 'crm', label: 'Pipeline' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'personas', label: 'Personas' },
  { id: 'grupos', label: 'Grupos' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'grupos-empresariales', label: 'Grupos Empresariales' },
  { id: 'leads', label: 'Leads' },
  { id: 'recuperables', label: 'Recuperables' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'intelligence', label: 'Intelligence' },
];

export const CRM_TAB_IDS = CRM_TABS.map(t => t.id);
