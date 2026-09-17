// Fuente única del rol de usuario en el frontend.
//
// El backend no es consistente sobre el nombre del campo ("role" en
// /api/v1/dashboard/, "tipo_usuario" en el usuario guardado en localStorage)
// ni sobre su formato: un str-enum de Python serializado con str() llega como
// "TipoUsuario.ADMIN" en vez de "ADMIN". Además, un fallback puede traer un
// valor basura (un id, un objeto stringificado, un rol viejo que ya no existe)
// y quedarse con él significaba degradar a un admin a usuario común sin
// ninguna señal.
//
// Los roles canónicos son los tres de TipoUsuario en el backend
// (app/models/usuario.py): ADMIN, EMPLEADO, CLIENTE. "ADMINISTRADOR" no
// existe y ninguna fila puede tenerlo.
export const ROLES_VALIDOS = ['ADMIN', 'EMPLEADO', 'CLIENTE'];

// Normaliza un valor suelto a rol canónico, o null si no lo es.
// Quita el prefijo "TIPOUSUARIO." que deja str(TipoUsuario.X) en Python.
export const normalizarRol = (valor) => {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim().toUpperCase().replace(/^TIPOUSUARIO\./, '');
  return ROLES_VALIDOS.includes(texto) ? texto : null;
};

// Devuelve el primer valor que normalice a un rol válido. Un valor presente
// pero no reconocido NO corta la búsqueda: se avisa por consola y se sigue
// al siguiente fallback.
export const extraerRol = (...fuentes) => {
  for (const fuente of fuentes) {
    if (fuente === null || fuente === undefined || fuente === '') continue;
    const rol = normalizarRol(fuente);
    if (rol) return rol;
    console.warn('[roles] Valor de rol no reconocido, se ignora:', fuente);
  }
  return null;
};

export const esRolAdmin = (rol) => normalizarRol(rol) === 'ADMIN';
