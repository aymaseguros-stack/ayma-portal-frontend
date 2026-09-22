// El rol de la sesión, leíble desde CUALQUIER componente (C-6l punto 1).
//
// POR QUÉ EXISTE. `esAdmin` venía bajando por props de pantalla en pantalla
// desde App.jsx (`esAdmin={isAdmin()}`), y la ficha de una oportunidad se
// abre desde SEIS lugares: Pipeline, Oportunidades, Personas, Empresas,
// Grupos y Seguimientos. El Pipeline era el que no lo pasaba, así que a un
// ADMIN la ficha abierta desde el Kanban le escondía "Eliminar oportunidad"
// -y el modo de falla es silencioso: no hay error, falta un botón-. Una
// cadena de props que hay que acordarse de completar en cada nuevo call site
// es una cadena que el séptimo va a romper igual.
//
// NO ES UN CONTROL DE ACCESO. Lo que el rol decide acá es qué se DIBUJA; el
// permiso lo sigue aplicando el backend (`require_admin`), y un localStorage
// editado a mano sólo consigue ver un botón que después se come un 403.
import { useEffect, useState } from 'react';
import { esRolAdmin, extraerRol } from './roles';
import { SESSION_EXPIRED_EVENT } from './api';

// Clave propia, y no `user.role`, porque la fuente más confiable del rol es
// la respuesta de /api/v1/dashboard/ (así lo dice isAdmin() en App.jsx) y esa
// respuesta no se guardaba en ninguna parte: vivía en el estado de App. Acá
// se asienta, con el mismo orden de preferencia.
export const CLAVE_ROL = 'ayma_rol';

const leerLocal = (clave) => {
  try { return localStorage.getItem(clave); } catch { return null; }
};

// Guarda el primer valor que normalice a un rol canónico. Devuelve el rol
// guardado, o null si ninguna fuente servía (y entonces NO pisa lo anterior:
// un dashboard que no contestó no degrada a un admin).
export const guardarRolDeSesion = (...fuentes) => {
  const rol = extraerRol(...fuentes);
  if (!rol) return null;
  try { localStorage.setItem(CLAVE_ROL, rol); } catch { /* localStorage no disponible */ }
  return rol;
};

export const limpiarRolDeSesion = () => {
  try { localStorage.removeItem(CLAVE_ROL); } catch { /* localStorage no disponible */ }
};

// El rol de la sesión, o null. El fallback a `user` de localStorage es lo que
// mantiene viva una sesión abierta ANTES de este deploy: sin él, un admin ya
// logueado vería la ficha sin el botón hasta volver a entrar.
export const rolDeSesion = () => {
  let guardado = null;
  try { guardado = JSON.parse(leerLocal('user') || '{}'); } catch { guardado = {}; }
  return extraerRol(leerLocal(CLAVE_ROL), guardado?.role, guardado?.tipo_usuario);
};

export const esAdminDeSesion = () => esRolAdmin(rolDeSesion());

// Hook para los componentes. Se relee al montar -un modal se monta cuando se
// abre- y ante SESSION_EXPIRED_EVENT, que es el único evento que cambia de
// usuario sin recargar la página.
export const useEsAdmin = () => {
  const [esAdmin, setEsAdmin] = useState(esAdminDeSesion);
  useEffect(() => {
    const revisar = () => setEsAdmin(esAdminDeSesion());
    revisar();
    window.addEventListener(SESSION_EXPIRED_EVENT, revisar);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, revisar);
  }, []);
  return esAdmin;
};
