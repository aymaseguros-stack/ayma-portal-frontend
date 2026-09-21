// Catálogo de diagnósticos y saneo de la respuesta.
//
// Vive aparte de DireccionDiagnosticos.jsx porque ese archivo exporta un
// componente y nada más (regla react-refresh/only-export-components), pero
// además porque ES el punto de extensión: sumar el diagnóstico de salud o el
// de migraciones es agregar una entrada acá, sin tocar la pantalla.
import { probarDrive } from './diagnosticosApi';
import {
  backfillResultadoLoop, backfillRiesgo, normalizarListasCerradas,
} from './migracionesApi';

// --- Saneo: el bloque crudo NUNCA muestra un secreto ---------------------
//
// Hoy ninguna respuesta trae uno -el backend devuelve client_id y
// client_email, que son públicos y hay que dárselos a Google para delegar, y
// la private key no sale por ningún lado-. El recorte es la red por si
// MAÑANA un diagnóstico nuevo devuelve algo que sí lo es: la pantalla imprime
// la respuesta ENTERA sin leerla, así que la defensa tiene que estar del lado
// de la pantalla y no de la confianza en cada endpoint.
//
// `client_id` y `service_account_email` quedan a propósito: son los dos
// identificadores que se pegan en la pantalla de delegación del Admin
// Console, y esconderlos obligaría a abrir el JSON de la credencial, que es
// justo donde sí está el secreto.
const CLAVE_SENSIBLE = /(secret|password|passwd|token|private_key|credential|api_?key|authorization|^key$|_key$)/i;
export const OCULTO = '«oculto en pantalla»';

export const sanear = (valor) => {
  if (Array.isArray(valor)) return valor.map(sanear);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, CLAVE_SENSIBLE.test(k) ? OCULTO : sanear(v)]),
    );
  }
  return valor;
};

// --- Registro de diagnósticos --------------------------------------------
// Un diagnóstico declara: cómo se llama, qué prueba, cómo se ejecuta y qué
// tres o cuatro campos de su respuesta hay que poner grandes.
export const DIAGNOSTICOS = [
  {
    id: 'drive',
    titulo: 'Google Drive',
    descripcion: 'Autentica la credencial, dice con qué usuario actúa y sube un archivo de 2 bytes que borra en el acto.',
    boton: 'Probar Google Drive',
    ejecutar: probarDrive,
    // El veredicto: true/false/null. null = ni se llegó a intentar escribir
    // porque la credencial no autenticó.
    veredicto: (r) => r?.escritura_ok,
    destacados: (r) => [
      { label: 'escritura_ok', valor: r?.escritura_ok },
      { label: 'credencial_ok', valor: r?.credencial_ok },
      { label: 'client_id', valor: r?.client_id },
      { label: 'service_account_email', valor: r?.service_account_email },
      { label: 'usuario_impersonado', valor: r?.usuario_impersonado },
      { label: 'actuando_como', valor: r?.actuando_como },
      { label: 'scopes_solicitados', valor: r?.scopes_solicitados },
    ],
  },
];

// --- Registro de migraciones de datos ------------------------------------
//
// MISMO PUNTO DE EXTENSIÓN, OTRA FORMA DE CORRER. Un diagnóstico es una
// lectura: un botón, una respuesta, listo. Una migración de datos ESCRIBE en
// producción, así que su tarjeta tiene dos pasos (simular / ejecutar en
// firme) y una confirmación escrita; por eso la dibuja MigracionDatosCard y
// no TarjetaDiagnostico. Lo que comparten -y por eso viven en el mismo
// archivo- es que las dos listas son el lugar donde se agrega una entrada sin
// tocar la pantalla.
//
// Las tres son endpoints admin del backend PR #187 y NO corren en el
// arranque, a propósito: el mapeo de `origen` toca todas las oportunidades y
// un mapeo mal decidido no se deshace con un redeploy.
export const MIGRACIONES_DATOS = [
  {
    id: 'normalizar-listas-cerradas',
    titulo: 'Normalizar listas cerradas (C-16)',
    descripcion:
      '`origen` y `compania_ganadora` a su valor canónico. Devuelve las dos tablas de mapeo y, '
      + 'aparte, lo que NO tiene mapeo declarado: eso no se reclasifica y lo decide una persona.',
    ejecutar: normalizarListasCerradas,
  },
  {
    id: 'backfill-riesgo',
    titulo: 'Identificación del riesgo (C-15)',
    descripcion:
      'Patente y número de solicitud de los casos DECLARADOS uno por uno. No recorre la tabla '
      + 'buscando patentes en las notas, y un valor ya cargado no se pisa.',
    ejecutar: backfillRiesgo,
  },
  {
    id: 'backfill-resultado-loop',
    titulo: 'Resultado de los LOOP existentes (D-B8)',
    descripcion:
      'Los LOOP que ya existían pasan a SIN_EFECTO. Es la afirmación conservadora: un CON_EFECTO '
      + 'exige dos alícuotas y una fuente que nadie registró en su momento, así que reconstruirlo '
      + 'sería inventarlo.',
    ejecutar: backfillResultadoLoop,
  },
];
