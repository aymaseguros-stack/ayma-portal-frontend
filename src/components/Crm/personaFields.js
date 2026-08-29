// Campos del formulario de Persona, agrupados por sección.
// Coinciden 1:1 con PersonaCreate/PersonaUpdate del backend.
export const PERSONA_FIELD_SECTIONS = [
  {
    titulo: 'Datos personales',
    campos: [
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'apellido', label: 'Apellido', type: 'text' },
      { name: 'tipo_documento', label: 'Tipo de documento', type: 'text', placeholder: 'DNI, CUIT...' },
      { name: 'numero_documento', label: 'Número de documento', type: 'text' },
      { name: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date' },
      { name: 'sexo', label: 'Sexo', type: 'text' },
      { name: 'estado_civil', label: 'Estado civil', type: 'text' },
      { name: 'cantidad_hijos', label: 'Cantidad de hijos', type: 'number' },
      { name: 'ocupacion', label: 'Ocupación', type: 'text' },
    ],
  },
  {
    titulo: 'Contacto',
    campos: [
      { name: 'telefono', label: 'Teléfono', type: 'text' },
      { name: 'celular', label: 'Celular', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'email_alt', label: 'Email alternativo', type: 'email' },
    ],
  },
  {
    titulo: 'Domicilio',
    campos: [
      { name: 'calle', label: 'Calle', type: 'text' },
      { name: 'numero', label: 'Número', type: 'text' },
      { name: 'piso', label: 'Piso', type: 'text' },
      { name: 'departamento', label: 'Depto.', type: 'text' },
      { name: 'codigo_postal', label: 'Código postal', type: 'text' },
      { name: 'localidad', label: 'Localidad', type: 'text' },
      { name: 'provincia', label: 'Provincia', type: 'text' },
      { name: 'pais', label: 'País', type: 'text' },
    ],
  },
  {
    titulo: 'Otros',
    campos: [
      { name: 'origen', label: 'Origen', type: 'text', placeholder: 'landing, referido...' },
      { name: 'notas', label: 'Notas', type: 'textarea' },
    ],
  },
];

export const PERSONA_INITIAL_FORM = PERSONA_FIELD_SECTIONS
  .flatMap(s => s.campos)
  .reduce((acc, c) => ({ ...acc, [c.name]: '' }), {});
