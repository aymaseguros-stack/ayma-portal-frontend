// D-B8 - la forma, la validación y el cuerpo del pedido del NO con efecto.
//
// Va aparte del componente (DeclaracionLoop.jsx) porque ese archivo exporta
// un componente y nada más (react-refresh/only-export-components), pero
// además porque ESTO es lo que comparten las puertas a LOOP: el bloque de
// campos se dibuja una vez y estas tres funciones son las que hacen que los
// dos formularios -la transición y el cierre PERDIDA- manden exactamente el
// mismo cuerpo. Es el criterio del `DatosLoopMixin` del backend.

export const FORM_LOOP_VACIO = {
  resultado_loop: '',
  alicuota_previa: '',
  alicuota_posterior: '',
  alicuota_posterior_fuente: '',
  prima_previa: '',
  prima_posterior: '',
  ahorro_anual_generado: '',
};

const numeroOnull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/**
 * Valida del lado del navegador lo mismo que la máquina de estados del
 * backend, y con el mismo criterio. NO reemplaza al 409: lo evita, que es
 * distinto. Un 409 evitable es una pantalla que hace perder el texto que la
 * persona ya escribió.
 *
 * Devuelve el mensaje de error, o null si está todo.
 */
export const validarLoop = (form) => {
  if (!form.resultado_loop) {
    return 'Declará si el NO dejó efecto: es obligatorio y no tiene valor por defecto.';
  }
  if (form.resultado_loop !== 'CON_EFECTO') return null;

  if (form.alicuota_previa === '' || form.alicuota_posterior === '') {
    return 'Con efecto hay que declarar las dos alícuotas: la previa y la posterior.';
  }
  if (!form.alicuota_posterior_fuente) {
    return 'Indicá de dónde salió la alícuota posterior.';
  }
  // ESTRICTO, no `<=`: si no bajó no hubo efecto, y un ahorro de cero
  // contando como valor generado es peor que no tener el dato.
  if (!(Number(form.alicuota_posterior) < Number(form.alicuota_previa))) {
    return 'La alícuota posterior tiene que ser MENOR que la previa: si no bajó, no hubo efecto.';
  }
  return null;
};

/** Los campos del mixin, listos para el cuerpo del pedido. */
export const payloadLoop = (form) => ({
  resultado_loop: form.resultado_loop || null,
  alicuota_previa: numeroOnull(form.alicuota_previa),
  alicuota_posterior: numeroOnull(form.alicuota_posterior),
  alicuota_posterior_fuente: form.alicuota_posterior_fuente || null,
  prima_previa: numeroOnull(form.prima_previa),
  prima_posterior: numeroOnull(form.prima_posterior),
  ahorro_anual_generado: numeroOnull(form.ahorro_anual_generado),
});
