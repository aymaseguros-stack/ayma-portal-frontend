// El vocabulario de la subida a Drive de un adjunto, en UN SOLO lugar
// (backend: crm_adjuntos.subida_estado, C-6h punto 3 y C-6n).
//
// POR QUÉ NO VIVE EN emisionApi.js. Nació ahí porque el primer emisor de
// archivos en vuelo fue el formulario público de QR-EMI, pero la columna es
// de `crm_adjuntos` y la leen DOS pantallas: el detalle de la solicitud y la
// pestaña "Documentos" de la ficha. Dos copias del mismo vocabulario es cómo
// una pantalla aprende a decir "falló" y la otra sigue mostrando el archivo
// muerto con su tamaño y su botón de descarga, que es exactamente el bug de
// C-6q. `emisionApi.js` lo REEXPORTA para no romper a quien ya lo importaba
// de ahí.
//
// `en_drive` NO alcanza para decidir: su false quería decir tres cosas a la
// vez ("no se despachó", "viajando", "falló"). Quien decide es
// `subida_estado`; `en_drive` sólo dice si hay binario que bajar.
export const SUBIDA_PENDIENTE = 'PENDIENTE';
export const SUBIDA_EN_CURSO = 'EN_CURSO';
export const SUBIDA_OK = 'OK';
export const SUBIDA_FALLIDA = 'FALLIDA';
export const ESTADOS_SUBIDA_EN_VUELO = [SUBIDA_PENDIENTE, SUBIDA_EN_CURSO];

// Una fila vieja -anterior a la migración- no trae la columna: se la da por
// subida, que es lo que es (todo el resto del sistema sube EN LÍNEA dentro
// del pedido, así que una fila que existe es una fila subida).
export const estadoSubida = (a) => a?.subida_estado || SUBIDA_OK;

export const estaEnVuelo = (a) => ESTADOS_SUBIDA_EN_VUELO.includes(estadoSubida(a));
export const fallo = (a) => estadoSubida(a) === SUBIDA_FALLIDA;

// El binario está en Drive y se puede pedir. Un FALLIDA con tamaño en
// pantalla NO es descargable: el tamaño es metadato que se escribió en línea
// dentro del pedido; el archivo nunca llegó.
export const sePuedeDescargar = (a) => estadoSubida(a) === SUBIDA_OK && !a?.purgado_en;

// El texto NO es decorativo: la salida depende del estado. En vuelo se
// espera; FALLIDA no llega sola y hay que reintentarla o volver a pedir el
// archivo con "Observar" + link nuevo, que es lo que el backend contesta en
// su 409.
export const SUBIDA_TEXTO = {
  [SUBIDA_PENDIENTE]: 'Todavía subiendo. Actualizá en unos segundos.',
  [SUBIDA_EN_CURSO]: 'Todavía subiendo. Actualizá en unos segundos.',
  [SUBIDA_FALLIDA]: 'La subida falló: el archivo no está guardado y no va a llegar solo.',
};

// Lo que bloquea "Aprobar" del lado del backend. Acá se usa para CONTAR y
// nombrar, nunca para deshabilitar el botón: el que decide es el backend con
// su 409, y un botón apagado sin explicación se lee como pantalla colgada.
export const adjuntosQueBloquean = (adjuntos = []) =>
  adjuntos.filter((a) => !a?.purgado_en && (estaEnVuelo(a) || fallo(a)));
