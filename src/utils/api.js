// Normaliza respuestas de listado del backend, que a veces devuelve un
// array plano [...] y a veces un objeto paginado {items: [...], total: N}.
// Usarlo en TODAS las vistas que consumen listas para no depender de qué
// forma eligió cada endpoint.
export const normalizeList = (data) => {
  const items = Array.isArray(data) ? data : (data?.items ?? []);
  const total = Array.isArray(data) ? data.length : (data?.total ?? items.length);
  return { items, total };
};

// Arma un mensaje de error legible con el status HTTP real y, si el backend
// lo mandó, su detalle (FastAPI: {detail: "..."} o {detail: [{msg: "..."}]}).
// Nunca dejar un texto genérico: sin el status/detalle no se puede diagnosticar.
export const formatApiError = async (res) => {
  let detail = '';
  try {
    const body = await res.json();
    if (Array.isArray(body?.detail)) {
      detail = body.detail.map((d) => d?.msg || JSON.stringify(d)).join('; ');
    } else if (typeof body?.detail === 'string') {
      detail = body.detail;
    } else if (typeof body?.message === 'string') {
      detail = body.message;
    }
  } catch {
    // el cuerpo no era JSON o ya se consumió; nos quedamos solo con el status
  }
  return `Error ${res.status}${detail ? ': ' + detail : ''}`;
};
