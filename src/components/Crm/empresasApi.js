// Nombre de una empresa por id, con caché de módulo.
//
// Por qué hace falta: en una oportunidad de empresa con contacto de
// referencia, el backend manda `nombre_vinculado` = la persona (su
// `_nombre_vinculado` prioriza persona sobre empresa) y no manda la razón
// social. Para mostrar "Empresa · ref.: Persona" el nombre de la empresa se
// resuelve acá, una sola vez por id (GET /crm/empresas/{id} devuelve
// EmpresaResponse, no la ficha completa).
import { authHeader } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const cache = new Map();

export const nombreDeEmpresa = async (token, empresaId) => {
  if (!empresaId) return null;
  if (cache.has(empresaId)) return cache.get(empresaId);
  try {
    const res = await fetch(`${API_URL}/api/v1/crm/empresas/${empresaId}`, { headers: authHeader(token) });
    if (!res.ok) return null;
    const data = await res.json();
    const nombre = data?.razon_social || null;
    cache.set(empresaId, nombre);
    return nombre;
  } catch {
    return null;
  }
};

// Personas ya vinculadas a una empresa: son las primeras sugerencias del
// campo "Contacto de referencia".
export const contactosDeEmpresa = async (token, empresaId) => {
  if (!empresaId) return [];
  try {
    const res = await fetch(`${API_URL}/api/v1/crm/empresas/${empresaId}/contactos`, { headers: authHeader(token) });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : []).map((c) => ({
      id: c.persona_id, nombre: c.nombre, apellido: c.apellido, rol: c.rol,
    }));
  } catch {
    return [];
  }
};

// Etiqueta de una oportunidad que tiene empresa titular y persona de
// referencia. Sin los dos datos, se cae al nombre que ya venía.
export const etiquetaTitularConReferencia = (nombreEmpresa, nombrePersona) => {
  if (nombreEmpresa && nombrePersona) return `${nombreEmpresa} · ref.: ${nombrePersona}`;
  return nombreEmpresa || nombrePersona || null;
};

export const limpiarCacheEmpresas = () => cache.clear();
