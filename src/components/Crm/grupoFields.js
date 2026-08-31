// Campos del formulario de Grupo, agrupados por sección.
// Coinciden 1:1 con GrupoCreate/GrupoUpdate del backend (TIPOS_GRUPO_VALIDOS
// en app/schemas/crm_v2.py).
export const TIPO_GRUPO_OPCIONES = [
  { value: 'FAMILIAR', label: 'Familiar' },
  { value: 'CONSORCIO', label: 'Consorcio' },
  { value: 'FLOTA', label: 'Flota' },
  { value: 'SOCIEDAD_HECHO', label: 'Sociedad de hecho' },
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

// GruposPanel se reutiliza para dos vistas (Grupos = FAMILIAR, Grupos
// Empresariales = CONSORCIO/FLOTA/SOCIEDAD_HECHO): el selector de Tipo del
// alta/edición debe limitarse a los tipos de la vista activa.
export const seccionesGrupoParaTipos = (tiposPermitidos) => GRUPO_FIELD_SECTIONS.map((seccion) => ({
  ...seccion,
  campos: seccion.campos.map((campo) => (
    campo.name === 'tipo'
      ? { ...campo, options: TIPO_GRUPO_OPCIONES.filter(o => tiposPermitidos.includes(o.value)), required: true }
      : campo
  )),
}));

export const formularioGrupoInicial = (tipoDefault) => ({ ...GRUPO_INITIAL_FORM, tipo: tipoDefault || '' });
