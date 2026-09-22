// La baja con motivo, de los dos lados (C-6l / backend C-6k d587144).
//
// LOS DOS DELETE PIDEN `motivo_baja` EN LA QUERY STRING y `detalle` cuando
// el motivo es OTRO. Sin motivo el backend contesta 422: "una baja sin
// motivo es indistinguible de un borrado". Un duplicado, una carga de
// prueba y un error de carga se veían idénticos, o sea no se veían.
//
// LA BAJA NO ES UN NO DEL CLIENTE. Antes del PR #192 el DELETE mandaba la
// oportunidad a LOOP con `resultado=PERDIDA`, así que una prueba quedaba en
// la columna "hay que recontactar" del Kanban sumando su prima al total.
// Ahora escribe una MARCA: la fila no se borra, sale del pipeline y de las
// métricas, y el estado comercial no se inventa.
import { authHeader, formatApiError } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

// Espejo de app/models/crm/oportunidad_catalogos.py::MotivoBajaOportunidad.
// EL MISMO vocabulario para oportunidad y persona: el backend usa uno solo.
export const MOTIVO_OTRO = 'OTRO';
export const MOTIVOS_BAJA = [
  { valor: 'PRUEBA', label: 'Prueba' },
  { valor: 'DUPLICADO', label: 'Duplicado' },
  { valor: 'ERROR_CARGA', label: 'Error de carga' },
  { valor: MOTIVO_OTRO, label: 'Otro' },
];

// La palabra que hay que tipear. Mismo criterio que la purga: un botón rojo
// no es una confirmación, es un botón.
export const PALABRA_BAJA = 'ELIMINAR';

const leer = async (res) => {
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

const queryBaja = ({ motivo, detalle }) => {
  const params = new URLSearchParams({ motivo_baja: motivo });
  if (detalle && detalle.trim()) params.set('detalle', detalle.trim());
  return params.toString();
};

export const darDeBajaOportunidad = (token, oportunidadId, { motivo, detalle } = {}) =>
  fetch(`${API_URL}/api/v1/crm/oportunidades/${oportunidadId}?${queryBaja({ motivo, detalle })}`, {
    method: 'DELETE', headers: authHeader(token),
  }).then(leer);

export const darDeBajaPersona = (token, personaId, { motivo, detalle } = {}) =>
  fetch(`${API_URL}/api/v1/crm/personas/${personaId}?${queryBaja({ motivo, detalle })}`, {
    method: 'DELETE', headers: authHeader(token),
  }).then(leer);
