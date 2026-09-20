// Cliente de los DIAGNÓSTICOS del sistema.
//
// Va aparte de direccionApi.js a propósito: estos endpoints NO cuelgan de
// /api/v1/direccion sino de /api/v1/admin (app/api/v1/admin.py). Comparten
// la exigencia de rol -require_admin, un EMPLEADO recibe 403- pero no el
// prefijo, y hacerlos entrar a la fuerza en el `pedir` de direccionApi
// obligaría a parametrizar el BASE de todo el módulo por un solo caso.
import { authHeader, formatApiError } from '../../utils/api';

export const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const BASE = '/api/v1/admin';

const pedir = async (token, ruta) => {
  const res = await fetch(`${API_URL}${BASE}${ruta}`, {
    method: 'GET',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(await formatApiError(res));
    err.status = res.status;
    throw err;
  }
  return res.json();
};

// GET /admin/drive/estado -> {credencial_ok, escritura_ok, client_id,
// service_account_email, usuario_impersonado, actuando_como,
// scopes_solicitados[], cuota{}, error, reason, ...}
//
// `probar_subida=true` (el default del backend) es LA prueba que importa:
// la credencial rota del 19-Sep autenticaba perfecto y no podía subir un
// byte. Se pide explícito para que se lea acá qué se está probando.
export const probarDrive = (token) => pedir(token, '/drive/estado?probar_subida=true');
