// Los cuatro vocabularios cerrados de la oportunidad (C-16) y el catálogo de
// compañías (backend PR #187).
//
// POR QUÉ DOS ENDPOINTS Y NO UNA CONSTANTE SOLA.
//
//   `origenes` / `resultados_loop` / `fuentes_alicuota` / `fuentes_ahorro`
//   SON constantes del backend, y la copia de acá abajo es la que dibuja el
//   desplegable sin esperar un request. `GET /crm/catalogos/origenes` existe
//   para poder COTEJAR esa copia sin leer el fuente del backend: si el
//   endpoint devuelve un origen que acá no está, la pantalla lo agrega al
//   final en vez de esconderlo -esconderlo sería exactamente el agujero que
//   C-16 cierra, con el operador pidiendo que le abran el campo de texto.
//
//   `companias` NO PUEDE ser una constante: son las filas de `proveedores`
//   (ASEGURADORA/ART, ACTIVO) que Dirección da de alta por API, y una copia
//   acá quedaría vieja el día que se suma una compañía. Se pide siempre.
import { authHeader, formatApiError } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

// Espejo de `OrigenOportunidad` (app/models/crm/oportunidad_catalogos.py).
// Los cuatro últimos los escribe la MÁQUINA: se muestran (hay oportunidades
// con ese origen) pero no se ofrecen para elegir a mano, porque elegirlos
// mentiría sobre quién generó la oportunidad -y `POST /srt/revertir-
// verificacion` BORRA por `origen`, así que un VERIFICACION_SRT puesto a mano
// es una fila que una limpieza se lleva puesta.
export const ORIGENES_DE_PERSONA = [
  'META_ADS', 'GOOGLE_ADS', 'FORMULARIO_WEB', 'QR_PUNTO_CONTACTO',
  'WHATSAPP_DIRECTO', 'REFERIDO', 'CONTACTO_PERSONAL', 'CARTERA_ART', 'OTRO',
];

export const ORIGENES_DE_MAQUINA = [
  'VERIFICACION_SRT', 'VENTANA_ANIVERSARIO_ART', 'MOTOR_OFERTA', 'RECUPERACION_CARTERA',
];

export const ORIGENES_VALIDOS = [...ORIGENES_DE_PERSONA, ...ORIGENES_DE_MAQUINA];

export const ORIGEN_LABEL = {
  META_ADS: 'Meta Ads',
  GOOGLE_ADS: 'Google Ads',
  FORMULARIO_WEB: 'Formulario web',
  QR_PUNTO_CONTACTO: 'QR / punto de contacto',
  WHATSAPP_DIRECTO: 'WhatsApp directo',
  REFERIDO: 'Referido',
  CONTACTO_PERSONAL: 'Contacto personal',
  CARTERA_ART: 'Cartera ART',
  OTRO: 'Otro',
  VERIFICACION_SRT: 'Verificación SRT (automático)',
  VENTANA_ANIVERSARIO_ART: 'Ventana de aniversario ART (automático)',
  MOTOR_OFERTA: 'Motor de oferta (automático)',
  RECUPERACION_CARTERA: 'Recuperación de cartera (automático)',
};

export const etiquetaOrigen = (valor) => (valor ? (ORIGEN_LABEL[valor] || valor) : '—');

export const RESULTADOS_LOOP = ['SIN_EFECTO', 'CON_EFECTO'];

export const RESULTADO_LOOP_LABEL = {
  SIN_EFECTO: 'Sin efecto',
  CON_EFECTO: 'Con efecto',
};

export const FUENTES_ALICUOTA = ['F931', 'SRT_VENTANILLA', 'DECLARADA_CLIENTE'];

export const FUENTE_ALICUOTA_LABEL = {
  F931: 'F.931 (declaración jurada)',
  SRT_VENTANILLA: 'Ventanilla electrónica SRT',
  DECLARADA_CLIENTE: 'Declarada por el cliente',
};

export const FUENTE_AHORRO_LABEL = {
  CALCULADO: 'Calculado por el sistema',
  DECLARADO: 'Declarado por una persona',
};

/**
 * GET /crm/catalogos/origenes -> {origenes[], resultados_loop[],
 * fuentes_alicuota[], fuentes_ahorro[]}
 */
export const catalogoOrigenes = async (token) => {
  const res = await fetch(`${API_URL}/api/v1/crm/catalogos/origenes`, { headers: authHeader(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

/**
 * GET /crm/catalogos/companias -> {total, companias:[{id,nombre,tipo,cuit}]}
 *
 * Es el MISMO conjunto contra el que el backend valida `compania_ganadora`
 * al cerrar: lo que no está acá es un 422 al confirmar la venta.
 */
export const catalogoCompanias = async (token) => {
  const res = await fetch(`${API_URL}/api/v1/crm/catalogos/companias`, { headers: authHeader(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

/**
 * GET /crm/metricas/ahorro-generado?desde&hasta
 *
 * La ventana se aplica sobre `updated_at` del lado del backend: mide cuándo
 * se DECLARÓ el resultado del LOOP, no cuándo nació la oportunidad.
 */
export const ahorroGenerado = async (token, { desde, hasta } = {}) => {
  const url = new URL(`${API_URL}/api/v1/crm/metricas/ahorro-generado`);
  if (desde) url.searchParams.set('desde', desde);
  if (hasta) url.searchParams.set('hasta', hasta);
  const res = await fetch(url.toString(), { headers: authHeader(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// El origen que trae el backend puede no estar en la copia de arriba (un
// valor viejo en minúsculas que todavía no se normalizó, o uno nuevo). Se
// AGREGA al final en vez de descartarse: un desplegable que no ofrece el
// valor que la fila ya tiene obliga a pisarlo para poder guardar cualquier
// otra cosa.
export const origenesParaElegir = (delBackend) => {
  const extras = (delBackend || []).filter(
    (o) => !ORIGENES_VALIDOS.includes(o) && !ORIGENES_DE_MAQUINA.includes(o),
  );
  return [...ORIGENES_DE_PERSONA, ...extras];
};

// C-15 - la patente se guarda y se busca NORMALIZADA (mayúsculas, sin
// espacios, guiones ni puntos). Espejo de `normalizar_patente` del backend.
//
// NO VALIDA EL FORMATO, a propósito: la lista de los cuatro formatos
// argentinos vive en el backend y repetirla acá sería tener dos definiciones
// de qué es una patente. Normalizar sin validar es además lo que permite
// BUSCAR una patente mal cargada, que es cómo se la encuentra para
// corregirla.
export const normalizarPatente = (valor) =>
  (valor || '').replace(/[\s\-.]+/g, '').toUpperCase();
