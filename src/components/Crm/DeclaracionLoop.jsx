import React from 'react';
import {
  RESULTADOS_LOOP, RESULTADO_LOOP_LABEL, FUENTES_ALICUOTA, FUENTE_ALICUOTA_LABEL,
} from './oportunidadCatalogos';

// El bloque de campos del NO con efecto (D-B8). La forma, la validación y el
// cuerpo del pedido viven en declaracionLoop.js, al lado.
//
// POR QUÉ UN BLOQUE COMPARTIDO Y NO EL FORMULARIO COPIADO EN CADA PUERTA. A
// LOOP se entra por tres pedidos con cuerpo -`POST /transicion`,
// `PATCH /estado` y el cierre PERDIDA- y el backend exige `resultado_loop` en
// los tres (409 con el motivo). Tres copias del mismo formulario es cómo una
// de las tres se queda sin el campo que se agregue mañana, y esa es justo la
// puerta por la que se va a perder el dato. Es el mismo criterio que el
// `DatosLoopMixin` del backend.
//
// LA CUARTA PUERTA NO TIENE FORMULARIO: `DELETE /oportunidades/{id}` escribe
// SIN_EFECTO del lado del backend y no acepta cuerpo. Es correcto que no lo
// pregunte -una baja no intervino ante ninguna compañía- y por eso acá no hay
// nada que dibujar para ese camino.
//
// `resultado_loop` NO tiene valor por defecto, ni acá ni en el backend: un
// default SIN_EFECTO haría que el caso que este paquete existe para medir se
// perdiera cada vez que alguien apura el formulario, y se perdería en
// silencio.

const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';

/**
 * El bloque de campos. `form` y `onChange(campo, valor)` los maneja el modal
 * que lo usa: así el mismo bloque sirve en el de transición y en el de
 * cierre sin que ninguno tenga que adoptar el estado del otro.
 */
const DeclaracionLoop = ({ form, onChange, idPrefijo = 'loop', deshabilitado = false }) => {
  const conEfecto = form.resultado_loop === 'CON_EFECTO';
  const set = (campo) => (e) => onChange(campo, e.target.value);

  return (
    <div className="space-y-4">
      <div>
        <span className="block text-slate-400 text-sm mb-2">¿El NO dejó efecto? *</span>
        <div className="flex gap-3" role="radiogroup" aria-label="Resultado del LOOP">
          {RESULTADOS_LOOP.map((valor) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={form.resultado_loop === valor}
              disabled={deshabilitado}
              onClick={() => onChange('resultado_loop', valor)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                form.resultado_loop === valor
                  ? (valor === 'CON_EFECTO' ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white')
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {RESULTADO_LOOP_LABEL[valor]}
            </button>
          ))}
        </div>
        <p className="text-slate-500 text-xs mt-2">
          <strong>Con efecto</strong>: le llevó nuestra cotización a su compañía y ésta le bajó la
          tarifa para retenerlo. No hay venta, pero el cliente paga menos por nuestra intervención
          y eso es valor generado. <strong>Sin efecto</strong>: el NO no movió nada.
        </p>
      </div>

      {conEfecto && (
        <div className="space-y-4 border-l-2 border-emerald-600/40 pl-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor={`${idPrefijo}-alic-previa`}>
                Alícuota previa (%) *
              </label>
              <input
                id={`${idPrefijo}-alic-previa`} type="number" min="0" max="100" step="0.01"
                value={form.alicuota_previa} onChange={set('alicuota_previa')}
                className={inputClass} disabled={deshabilitado}
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor={`${idPrefijo}-alic-post`}>
                Alícuota posterior (%) *
              </label>
              <input
                id={`${idPrefijo}-alic-post`} type="number" min="0" max="100" step="0.01"
                value={form.alicuota_posterior} onChange={set('alicuota_posterior')}
                className={inputClass} disabled={deshabilitado}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-2" htmlFor={`${idPrefijo}-fuente`}>
              ¿De dónde salió la alícuota posterior? *
            </label>
            <select
              id={`${idPrefijo}-fuente`} value={form.alicuota_posterior_fuente}
              onChange={set('alicuota_posterior_fuente')} className={inputClass} disabled={deshabilitado}
            >
              <option value="">Elegí la fuente...</option>
              {FUENTES_ALICUOTA.map((f) => (
                <option key={f} value={f}>{FUENTE_ALICUOTA_LABEL[f] || f}</option>
              ))}
            </select>
            <p className="text-slate-500 text-xs mt-1">
              Un F.931 es una declaración jurada; lo que el cliente cuenta por teléfono no lo es.
              La diferencia queda escrita al lado del número.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor={`${idPrefijo}-prima-previa`}>
                Prima previa
              </label>
              <input
                id={`${idPrefijo}-prima-previa`} type="number" min="0" step="0.01"
                value={form.prima_previa} onChange={set('prima_previa')}
                className={inputClass} disabled={deshabilitado}
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor={`${idPrefijo}-prima-post`}>
                Prima posterior
              </label>
              <input
                id={`${idPrefijo}-prima-post`} type="number" min="0" step="0.01"
                value={form.prima_posterior} onChange={set('prima_posterior')}
                className={inputClass} disabled={deshabilitado}
              />
            </div>
          </div>
          <p className="text-slate-500 text-xs">
            Las primas son para los ramos sin alícuota (AUTO, INTEGRAL). Son opcionales.
          </p>

          <div>
            <label className="block text-slate-400 text-sm mb-2" htmlFor={`${idPrefijo}-ahorro`}>
              Ahorro anual generado (declarado)
            </label>
            <input
              id={`${idPrefijo}-ahorro`} type="number" min="0" step="0.01"
              value={form.ahorro_anual_generado} onChange={set('ahorro_anual_generado')}
              className={inputClass} disabled={deshabilitado}
            />
            {/* EL AHORRO NUNCA SE ESTIMA. Si la empresa tiene masa salarial
                DECLARADA (F.931 o la histórica), el backend lo calcula solo y
                lo marca CALCULADO; dejando este campo vacío se toma ése. Si
                no la tiene, el backend NO la estima -estimar una masa para
                multiplicarla por una diferencia de alícuota da un número que
                nadie puede defender delante del cliente- y el ahorro lo pone
                una persona acá, con `ahorro_fuente = DECLARADO`. Lo que se
                escriba acá GANA sobre el cálculo. */}
            <p className="text-slate-500 text-xs mt-1">
              Dejalo vacío si la empresa tiene masa salarial declarada: el sistema lo calcula y lo
              marca <strong>CALCULADO</strong>. Sin masa declarada no se estima nada, así que el
              número lo ponés acá y queda como <strong>DECLARADO</strong>. Lo que escribas gana
              sobre el cálculo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeclaracionLoop;
