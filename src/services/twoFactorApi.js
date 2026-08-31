import { authHeader, formatApiError } from '../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';
const BASE = API_URL + '/api/v1/auth';

const postJSON = async (path, body, token) => {
  const response = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(token)
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = new Error(await formatApiError(response));
    try { error.body = await response.clone().json(); } catch { /* sin body JSON */ }
    throw error;
  }
  return response.json();
};

// Login en dos pasos: si /auth/login devolvió requiere_2fa, este segundo
// paso valida el código (TOTP de 6 dígitos o código de recuperación) contra
// el token_temporal emitido por el primer paso.
export const verificarLogin2FA = (tokenTemporal, codigo) =>
  postJSON('/login/2fa', { token_temporal: tokenTemporal, codigo });

// Pantalla de Seguridad: estado actual del 2FA del usuario logueado.
export const obtenerEstado2FA = async (token) => {
  const response = await fetch(BASE + '/2fa/estado', {
    headers: { 'Content-Type': 'application/json', ...authHeader(token) }
  });
  if (!response.ok) throw new Error(await formatApiError(response));
  return response.json();
};

// Arranca la activación: el backend genera el secreto TOTP y devuelve la URI
// otpauth:// para armar el QR del lado del cliente (nunca se manda el
// secreto a un servicio externo de generación de QR).
export const iniciarActivacion2FA = (token) => postJSON('/2fa/iniciar-activacion', {}, token);

// Confirma la activación con el primer código de 6 dígitos generado por la
// app de autenticación. El backend devuelve los 10 códigos de recuperación.
export const confirmarActivacion2FA = (token, codigo) =>
  postJSON('/2fa/confirmar-activacion', { codigo }, token);

// Regenera los códigos de recuperación (invalida los anteriores).
export const regenerarCodigos2FA = (token) => postJSON('/2fa/regenerar-codigos', {}, token);

// Desactiva el 2FA. Requiere contraseña + un código vigente como doble
// confirmación.
export const desactivar2FA = (token, password, codigo) =>
  postJSON('/2fa/desactivar', { password, codigo }, token);
