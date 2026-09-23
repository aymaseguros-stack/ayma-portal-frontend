import { authHeader, formatApiError } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

// PATCH /api/v1/leads/{lead_id}/anular - baja LÓGICA del lead: el backend
// deja estado = "anulado" y escribe "ANULADO: {motivo}" en notas; la fila
// sigue existiendo, por eso la UI la marca en vez de sacarla de la lista.
// OJO: `motivo` es un query param en el backend (no va en el body).
export const anularLead = async (token, leadId, motivo) => {
  const url = new URL(`${API_URL}/api/v1/leads/${encodeURIComponent(leadId)}/anular`);
  if (motivo) url.searchParams.set('motivo', motivo);
  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) }
  });
  if (!response.ok) {
    throw new Error(await formatApiError(response));
  }
  return response.json();
};

// L-2 / L-1: el listado con visibilidad y filtro de estado.
//
// `estado` es la VISIBILIDAD ('activos' | 'inactivos' | 'anulados' | 'todos')
// y `estado_lead` es el estado del lead. El backend acepta los dos y resuelve
// el doble sentido del `estado` viejo por valor, pero desde acá se mandan
// siempre separados: apoyarse en esa compatibilidad es cómo el parámetro
// vuelve a significar dos cosas.
export const listarLeads = async (token, { visibilidad, estadoLead } = {}) => {
  const url = new URL(`${API_URL}/api/v1/leads/`);
  if (visibilidad && visibilidad !== 'activos') url.searchParams.set('estado', visibilidad);
  if (estadoLead) url.searchParams.set('estado_lead', estadoLead);
  const res = await fetch(url.toString(), { headers: authHeader(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

/**
 * GET /leads/estados — el CENSO de la columna, no un enum.
 *
 * `leads.estado` es un VARCHAR libre por el que pasaron tres vocabularios
 * distintos, así que una constante copiada del front dejaría fuera del filtro
 * a los leads reales que tienen otro valor - y un filtro que devuelve vacío se
 * lee como "no hay leads así". El desplegable se arma con lo que la base
 * tiene de verdad.
 */
export const estadosDeLead = async (token) => {
  const res = await fetch(`${API_URL}/api/v1/leads/estados`, { headers: authHeader(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};
