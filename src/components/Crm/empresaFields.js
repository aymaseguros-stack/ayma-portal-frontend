// Campos del formulario de Empresa, agrupados por sección.
// Coinciden 1:1 con EmpresaCreate/EmpresaUpdate del backend.
export const EMPRESA_FIELD_SECTIONS = [
  {
    titulo: 'Datos generales',
    campos: [
      { name: 'razon_social', label: 'Razón social', type: 'text', required: true },
      { name: 'nombre_fantasia', label: 'Nombre de fantasía', type: 'text' },
      { name: 'cuit', label: 'CUIT', type: 'text', placeholder: 'XX-XXXXXXXX-X' },
      { name: 'condicion_iva', label: 'Condición IVA', type: 'text' },
      { name: 'cantidad_empleados', label: 'Cantidad de empleados', type: 'number' },
      { name: 'facturacion_anual_estimada', label: 'Facturación anual estimada', type: 'number' },
    ],
  },
  {
    titulo: 'Actividad (CIIU)',
    campos: [
      { name: 'ciiu_codigo', label: 'Código CIIU', type: 'text' },
      { name: 'ciiu_descripcion', label: 'Descripción CIIU', type: 'text' },
      { name: 'ciiu_seccion', label: 'Sección CIIU', type: 'text' },
    ],
  },
  {
    titulo: 'Domicilio fiscal',
    campos: [
      { name: 'domicilio_fiscal_calle', label: 'Calle', type: 'text' },
      { name: 'domicilio_fiscal_numero', label: 'Número', type: 'text' },
      { name: 'domicilio_fiscal_codigo_postal', label: 'Código postal', type: 'text' },
      { name: 'domicilio_fiscal_localidad', label: 'Localidad', type: 'text' },
      { name: 'domicilio_fiscal_provincia', label: 'Provincia', type: 'text' },
    ],
  },
  {
    titulo: 'Domicilio de planta (opcional)',
    campos: [
      { name: 'domicilio_planta_calle', label: 'Calle', type: 'text' },
      { name: 'domicilio_planta_numero', label: 'Número', type: 'text' },
      { name: 'domicilio_planta_codigo_postal', label: 'Código postal', type: 'text' },
      { name: 'domicilio_planta_localidad', label: 'Localidad', type: 'text' },
      { name: 'domicilio_planta_provincia', label: 'Provincia', type: 'text' },
    ],
  },
  {
    titulo: 'Contacto',
    campos: [
      { name: 'telefono', label: 'Teléfono', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'web', label: 'Sitio web', type: 'text' },
    ],
  },
  {
    titulo: 'Otros',
    campos: [
      { name: 'origen', label: 'Origen', type: 'text' },
      { name: 'notas', label: 'Notas', type: 'textarea' },
    ],
  },
];

export const EMPRESA_INITIAL_FORM = EMPRESA_FIELD_SECTIONS
  .flatMap(s => s.campos)
  .reduce((acc, c) => ({ ...acc, [c.name]: '' }), {});
