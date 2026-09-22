// Los datos de cobro, en castellano (C-6i punto 1).
//
// EL DETALLE MOSTRABA `{"marca":"Visa","ultimos4":"1234",...}` TAL CUAL.
// Quien revisa una emisión tiene que poder leer de un vistazo con qué se
// paga, y un JSON crudo en una ficha obliga a descifrarlo a ojo - que es
// exactamente cómo se lee mal un último dígito y se manda mal el débito.
//
// LO QUE NO HAY ACÁ, Y NO ES UN OLVIDO: el número de tarjeta y el CVV no
// existen en el modelo (`emision_pii.CAMPOS_TARJETA_PROHIBIDOS` los
// descarta antes de cifrar nada), así que esta función NO tiene ningún caso
// que los contemple. Del CBU se muestran los últimos 4 por la misma razón
// por la que de la tarjeta se guardan sólo esos: identificar la cuenta no
// pide mostrarla entera en una pantalla que alguien puede tener abierta al
// lado de otra persona. El valor completo sigue estando en `datos` para
// quien lo necesite copiar.

// El backend normaliza la tarjeta a un objeto anidado de cuatro campos
// (`emision_pii.normalizar_tarjeta`), pero el catálogo del formulario
// declara los campos PLANOS (`tarjeta_marca`, `tarjeta_ultimos4`, …). Se
// leen los dos: la landing es un cliente que no se deploya con el backend y
// cuál de las dos formas mande no puede decidir si el dato se ve o no.
const TARJETA_PLANOS = {
  marca: 'tarjeta_marca',
  ultimos4: 'tarjeta_ultimos4',
  titular: 'tarjeta_titular',
  vencimiento: 'tarjeta_vencimiento',
};

const texto = (valor) => {
  if (valor === null || valor === undefined) return '';
  const limpio = String(valor).trim();
  return limpio;
};

export const tarjetaDe = (datos = {}) => {
  const anidada = datos?.tarjeta && typeof datos.tarjeta === 'object' ? datos.tarjeta : {};
  const salida = {};
  Object.entries(TARJETA_PLANOS).forEach(([campo, plano]) => {
    const valor = texto(anidada[campo]) || texto(datos?.[plano]);
    if (valor) salida[campo] = valor;
  });
  return Object.keys(salida).length ? salida : null;
};

// Los últimos cuatro de un CBU de 22 dígitos. Un ALIAS (`ayma.seguros.ars`)
// no se enmascara: no es un número de cuenta, es un apodo público de ella y
// recortarlo lo vuelve inútil para verificar que es el que corresponde.
export const cuentaLegible = (valor) => {
  const bruto = texto(valor);
  if (!bruto) return '';
  const soloDigitos = bruto.replace(/[\s-]/g, '');
  if (!/^\d{6,}$/.test(soloDigitos)) return bruto;
  return `****${soloDigitos.slice(-4)}`;
};

const conPartes = (partes) => partes.filter(Boolean).join(' · ');

// Devuelve una línea legible, o null si no hay NADA de cobro cargado.
// Null y "—" no son lo mismo: la pantalla decide si dice "sin datos de
// cobro", que es una afirmación sobre la solicitud y no un guion suelto.
export const cobroLegible = (datos = {}) => {
  if (!datos || typeof datos !== 'object') return null;

  const tarjeta = tarjetaDe(datos);
  const medio = texto(datos.medio).toUpperCase();
  const cuenta = texto(datos.cbu_o_alias);
  const titularCuenta = texto(datos.titular_cuenta);

  // LA TARJETA GANA cuando está cargada, aunque `medio` diga otra cosa: el
  // medio lo elige la persona de un desplegable y los cuatro campos de la
  // tarjeta los tipeó. Un `medio=DEBITO` con tarjeta cargada y sin CBU es
  // alguien que se equivocó de opción, y mostrar "Débito ·" sin cuenta
  // sería esconder el único dato que sí está.
  if (tarjeta && !(cuenta && !tarjeta.ultimos4)) {
    return conPartes([
      `Tarjeta ${tarjeta.marca || '(sin marca)'}${tarjeta.ultimos4 ? ` terminada en ${tarjeta.ultimos4}` : ''}`,
      tarjeta.titular,
      tarjeta.vencimiento ? `vence ${tarjeta.vencimiento}` : '',
    ]);
  }

  if (cuenta) {
    const etiqueta = medio && medio !== 'DEBITO' && medio !== 'DÉBITO'
      ? medio.charAt(0) + medio.slice(1).toLowerCase()
      : 'Débito';
    return conPartes([etiqueta, `CBU ${cuentaLegible(cuenta)}`, titularCuenta]);
  }

  if (medio) return medio.charAt(0) + medio.slice(1).toLowerCase();
  return null;
};

// Los campos que `cobroLegible` ya resumió: la ficha no los repite abajo en
// la lista cruda. Si mañana el formulario suma un campo de cobro, aparece
// en la lista y se ve - que es el modo de falla correcto: se muestra de
// más, nunca de menos.
export const CAMPOS_COBRO = [
  'medio', 'cbu_o_alias', 'titular_cuenta', 'tarjeta',
  ...Object.values(TARJETA_PLANOS),
];
