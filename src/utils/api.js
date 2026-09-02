// Evento global disparado cuando cualquier request autenticado devuelve 401.
// App.jsx se suscribe para limpiar la sesión y volver a la pantalla de login.
export const SESSION_EXPIRED_EVENT = 'ayma:session-expired';

// Arma el header de Authorization solo si hay token; nunca "Bearer null",
// "Bearer undefined" ni "Bearer " vacío.
export const authHeader = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

// Instala un interceptor global sobre window.fetch (una sola vez, al arrancar
// la app) para no depender de que cada vista maneje el 401 por su cuenta.
// Solo actúa sobre requests que ya llevaban Authorization: si ese request
// vuelve con 401, la sesión se venció (o el token es inválido), así que se
// limpia el storage y se avisa vía SESSION_EXPIRED_EVENT. El login (que no
// manda Authorization) nunca dispara esto: un 401 ahí es "credenciales
// inválidas", no "sesión vencida".
let interceptorInstalado = false;
export const installAuthInterceptor = () => {
  if (interceptorInstalado || typeof window === 'undefined' || !window.fetch) return;
  interceptorInstalado = true;
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await fetchOriginal(input, init);
    if (response.status === 401) {
      const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined);
      const teniaAuth = headers instanceof Headers
        ? headers.has('Authorization')
        : !!(headers && (headers['Authorization'] || headers['authorization']));
      if (teniaAuth) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
    }
    return response;
  };
};

// Normaliza respuestas de listado del backend, que a veces devuelve un
// array plano [...] y a veces un objeto paginado {items: [...], total: N}.
// Usarlo en TODAS las vistas que consumen listas para no depender de qué
// forma eligió cada endpoint.
export const normalizeList = (data) => {
  const items = Array.isArray(data) ? data : (data?.items ?? []);
  const total = Array.isArray(data) ? data.length : (data?.total ?? items.length);
  return { items, total };
};

// Extrae un número seguro de un campo de API que debería ser numérico pero
// no tiene un schema Pydantic estricto detrás (ej. /srt/estado,
// /crm/scoring/resumen: dicts armados a mano en el backend, a diferencia de
// /art/* que sí están tipados). Cualquier otra cosa (string, object, array,
// NaN, null/undefined) se trata como "sin dato": nunca se debe terminar
// renderizando un objeto crudo en JSX (React error #31).
export const numeroSeguro = (valor) => (typeof valor === 'number' && Number.isFinite(valor) ? valor : null);

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
