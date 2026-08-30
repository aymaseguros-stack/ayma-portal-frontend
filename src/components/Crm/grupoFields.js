// Campos del formulario de Grupo, agrupados por sección.
// Coinciden 1:1 con GrupoCreate/GrupoUpdate del backend.
export const TIPO_GRUPO_OPCIONES = [
  { value: 'FAMILIAR', label: 'Familiar' },
  { value: 'CORPORATIVO', label: 'Corporativo' },
  { value: 'OTRO', label: 'Otro' },
];

export const GRUPO_FIELD_SECTIONS = [
  {
    titulo: 'Datos generales',
    campos: [
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'tipo', label: 'Tipo', type: 'select', options: TIPO_GRUPO_OPCIONES },
      { name: 'localidad', label: 'Localidad', type: 'text' },
    ],
  },
  {
    titulo: 'Otros',
    campos: [
      { name: 'notas', label: 'Notas', type: 'textarea' },
    ],
  },
];

export const GRUPO_INITIAL_FORM = GRUPO_FIELD_SECTIONS
  .flatMap(s => s.campos)
  .reduce((acc, c) => ({ ...acc, [c.name]: '' }), {});
