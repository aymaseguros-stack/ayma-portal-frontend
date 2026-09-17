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
