// Catálogo de diagnósticos y saneo de la respuesta.
//
// Vive aparte de DireccionDiagnosticos.jsx porque ese archivo exporta un
// componente y nada más (regla react-refresh/only-export-components), pero
// además porque ES el punto de extensión: sumar el diagnóstico de salud o el
// de migraciones es agregar una entrada acá, sin tocar la pantalla.
import { probarDrive } from './diagnosticosApi';

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
