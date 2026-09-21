// Las tres escrituras de datos de C-15 / C-16 / D-B8 (backend PR #187).
//
// POR QUÉ ESTÁN EN PANTALLA Y NO EN UNA CONSOLA. Son endpoints admin con
// `dry_run=true` por default, y hasta ahora la única forma de correrlos era
// un JWT pegado a mano en un curl. Un procedimiento que sólo se puede correr
// desde la consola no lo corre nadie -o peor, lo corre alguien con un token
// que se quedó dando vueltas. Acá corren con LA SESIÓN del admin que está
// mirando, que es la misma decisión que tomó el FE #65 con los diagnósticos.
//
// `dry_run` VA EN LA QUERY STRING, no en el cuerpo (app/api/dry_run.py). El
// default del backend es `true`: acá se manda SIEMPRE explícito igual, porque
// el parámetro que decide si esto escribe en producción no puede depender de
// un default que no se lee en el call site.
import { authHeader, formatApiError } from '../../utils/api';

export const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const BASE = '/api/v1/admin/crm/oportunidades';

const correr = async (token, ruta, dryRun) => {
  const res = await fetch(`${API_URL}${BASE}${ruta}?dry_run=${dryRun ? 'true' : 'false'}`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(await formatApiError(res));
    err.status = res.status;
    throw err;
  }
  return res.json();
};

// Las tres devuelven la MISMA forma: {dry_run, operacion, filas_afectadas,
// detalle, verificacion}. La corrida en seco recorre exactamente el mismo
// camino -UPDATE incluidos- y termina en rollback, así que sus conteos y sus
// tablas de mapeo son los reales.
export const normalizarListasCerradas = (token, dryRun) =>
  correr(token, '/normalizar-listas-cerradas', dryRun);

export const backfillRiesgo = (token, dryRun) =>
  correr(token, '/backfill-riesgo', dryRun);

export const backfillResultadoLoop = (token, dryRun) =>
  correr(token, '/backfill-resultado-loop', dryRun);
