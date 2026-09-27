import React from 'react';
import DeclaracionLoop from './DeclaracionLoop';
import {
  TIPO_LOOP, MOTIVO_OTRO, TRACK_CON_ALICUOTA, DIAS_RAPIDOS_ACCION, DIAS_RAPIDOS_RECONTACTO,
  MAX_NOTA, CANAL_LABEL, etiquetaTipoAccion, etiquetaLoopMotivo, hoyAr, sumarDias,
} from './proximaAccion';

// C-9d - el formulario ÚNICO de la próxima acción. Lo dibujan el modal de
// "Registrar toque" y el de completar una tarea de próxima acción: el
// backend pide el mismo contrato en las dos puertas y dos copias del
// formulario es cómo una se queda sin el campo que se agregue mañana.
//
// Es controlado: el estado, el catálogo y el track los maneja
// `useProximaAccionForm` en el modal. Nada del vocabulario está escrito acá.
//
// NINGUNA DECISIÓN TIENE DEFAULT: ni "¿hubo respuesta?", ni el tipo, ni la
// fecha, ni `resultado_loop`. Sí lo tienen el canal (WhatsApp) y la hora
// (10:00), que no deciden nada.

const chip = (activo) => `px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
  activo ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
}`;
const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';

const SelectorFecha = ({
  etiqueta, valor, onChange, dias, plazoMax, idPrefijo, deshabilitado, hoy,
}) => {
  const min = sumarDias(hoy, 1);
  const max = sumarDias(hoy, plazoMax);
  const rapida = dias.find((d) => sumarDias(hoy, d) === valor);
  const [otra, setOtra] = React.useState(Boolean(valor) && !rapida);
  return (
    <div>
      <span className="block text-slate-400 text-sm mb-2">{etiqueta} *</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={etiqueta}>
        {dias.filter((d) => d <= plazoMax).map((d) => (
          <button
            key={d} type="button" disabled={deshabilitado}
            aria-pressed={!otra && rapida === d}
            onClick={() => { setOtra(false); onChange(sumarDias(hoy, d)); }}
            className={chip(!otra && rapida === d)}
          >
            {d} días
          </button>
        ))}
        <button
          type="button" disabled={deshabilitado} aria-pressed={otra}
          onClick={() => { setOtra(true); onChange(''); }}
          className={chip(otra)}
        >
          Otra fecha
        </button>
      </div>
      {otra && (
        <input
          id={`${idPrefijo}-otra`} type="date" aria-label={`${etiqueta}: otra fecha`}
          min={min} max={max} value={valor} disabled={deshabilitado}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} mt-2`}
        />
      )}
      {valor && (
        <p className="text-slate-500 text-xs mt-1">
          {valor.split('-').reverse().join('/')} · máximo {plazoMax} días
        </p>
      )}
    </div>
  );
};

const AvisoTrack = ({ estado, onReintentar }) => {
  if (estado === 'cargando') {
    return <p className="text-slate-400 text-xs">Leyendo el ramo de la oportunidad...</p>;
  }
  if (estado !== 'error') return null;
  return (
    <p className="text-amber-300 text-xs flex items-center gap-2 flex-wrap">
      No se pudo leer el ramo de la oportunidad. El LOOP se puede declarar "Sin efecto"; para
      "Con efecto" hace falta reintentar.
      <button type="button" onClick={onReintentar} className="underline hover:text-amber-200">
        Reintentar
      </button>
    </p>
  );
};

/**
 * Props:
 *   estado: el objeto que devuelve `useProximaAccionForm`.
 *   toque (opcional): { huboRespuesta, onHuboRespuesta, canal, onCanal } -
 *     sólo en el modal de un toque.
 *   mostrarAccion: si se dibuja el bloque de la próxima acción. En los
 *     toques 1 y 2 sin respuesta NO (el backend la rechaza).
 */
const ProximaAccionForm = ({
  estado, toque = null, mostrarAccion = true, idPrefijo = 'pa', deshabilitado = false,
}) => {
  const {
    form, set, catalogo, catalogoError, reintentarCatalogo, track, trackEstado, reintentarTrack,
  } = estado;
  const hoy = hoyAr();
  const esLoop = form.tipo === TIPO_LOOP;
  const canales = catalogo?.canales_toque || [];

  return (
    <div className="space-y-5">
      {toque && (
        <>
          <div>
            <span className="block text-slate-400 text-sm mb-2">¿Hubo respuesta? *</span>
            <div className="flex gap-3" role="radiogroup" aria-label="¿Hubo respuesta?">
              {[[true, 'Sí'], [false, 'No']].map(([valor, texto]) => (
                <button
                  key={texto} type="button" role="radio" disabled={deshabilitado}
                  aria-checked={toque.huboRespuesta === valor}
                  onClick={() => toque.onHuboRespuesta(valor)}
                  className={`flex-1 py-2.5 ${chip(toque.huboRespuesta === valor)}`}
                >
                  {texto}
                </button>
              ))}
            </div>
          </div>
          {canales.length > 0 && (
            <div>
              <span className="block text-slate-400 text-sm mb-2">Canal</span>
              <div className="flex gap-3" role="radiogroup" aria-label="Canal">
                {canales.map((c) => (
                  <button
                    key={c} type="button" role="radio" disabled={deshabilitado}
                    aria-checked={toque.canal === c}
                    onClick={() => toque.onCanal(c)}
                    className={`flex-1 py-2.5 ${chip(toque.canal === c)}`}
                  >
                    {CANAL_LABEL[c] || c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {catalogoError && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm flex items-center gap-3 flex-wrap">
          <span className="flex-1">No se pudieron cargar las opciones de próxima acción: {catalogoError}</span>
          <button type="button" onClick={reintentarCatalogo} className="underline">Reintentar</button>
        </div>
      )}

      {mostrarAccion && !catalogo && !catalogoError && (
        <p className="text-slate-400 text-sm">Cargando opciones...</p>
      )}

      {mostrarAccion && catalogo && (
        <div className="space-y-5 border-t border-slate-700 pt-4">
          <div>
            <span className="block text-slate-400 text-sm mb-2">Próxima acción *</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Próxima acción">
              {catalogo.tipos.map((t) => (
                <button
                  key={t} type="button" role="radio" disabled={deshabilitado}
                  aria-checked={form.tipo === t}
                  onClick={() => set('tipo', t)}
                  className={`py-3 ${t === TIPO_LOOP ? 'col-span-2 sm:col-span-3' : ''} ${
                    form.tipo === t
                      ? (t === TIPO_LOOP ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white')
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  } rounded-lg text-sm font-semibold transition disabled:opacity-50`}
                >
                  {etiquetaTipoAccion(t)}
                </button>
              ))}
            </div>
          </div>

          {form.tipo && !esLoop && (
            <>
              <SelectorFecha
                key="accion" etiqueta="Cuándo" valor={form.fecha} onChange={(v) => set('fecha', v)}
                dias={DIAS_RAPIDOS_ACCION} plazoMax={catalogo.plazo_max_accion_dias}
                idPrefijo={`${idPrefijo}-fecha`} deshabilitado={deshabilitado} hoy={hoy}
              />
              <div>
                <label className="block text-slate-400 text-sm mb-2" htmlFor={`${idPrefijo}-hora`}>
                  Hora (Argentina)
                </label>
                <input
                  id={`${idPrefijo}-hora`} type="time" value={form.hora} disabled={deshabilitado}
                  onChange={(e) => set('hora', e.target.value)} className={`${inputClass} max-w-[10rem]`}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2" htmlFor={`${idPrefijo}-nota`}>
                  Nota (opcional)
                </label>
                <textarea
                  id={`${idPrefijo}-nota`} rows={2} maxLength={MAX_NOTA} value={form.nota}
                  disabled={deshabilitado} onChange={(e) => set('nota', e.target.value)}
                  className={inputClass}
                />
                <p className="text-slate-500 text-xs mt-1 text-right">{form.nota.length}/{MAX_NOTA}</p>
              </div>
            </>
          )}

          {esLoop && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2" htmlFor={`${idPrefijo}-motivo`}>
                  Motivo del LOOP *
                </label>
                <select
                  id={`${idPrefijo}-motivo`} value={form.loop_motivo} disabled={deshabilitado}
                  onChange={(e) => set('loop_motivo', e.target.value)} className={inputClass}
                >
                  <option value="">Elegí el motivo...</option>
                  {catalogo.loop_motivos.map((m) => (
                    <option key={m} value={m}>{etiquetaLoopMotivo(m)}</option>
                  ))}
                </select>
              </div>
              {form.loop_motivo === MOTIVO_OTRO && (
                <div>
                  <label className="block text-slate-400 text-sm mb-2" htmlFor={`${idPrefijo}-detalle`}>
                    Detalle del motivo *
                  </label>
                  <textarea
                    id={`${idPrefijo}-detalle`} rows={2} maxLength={MAX_NOTA}
                    value={form.loop_motivo_detalle} disabled={deshabilitado}
                    onChange={(e) => set('loop_motivo_detalle', e.target.value)} className={inputClass}
                  />
                </div>
              )}
              <SelectorFecha
                key="recontacto" etiqueta="Recontacto" valor={form.fecha_recontacto}
                onChange={(v) => set('fecha_recontacto', v)}
                dias={DIAS_RAPIDOS_RECONTACTO} plazoMax={catalogo.plazo_max_recontacto_dias}
                idPrefijo={`${idPrefijo}-recontacto`} deshabilitado={deshabilitado} hoy={hoy}
              />
              <AvisoTrack estado={trackEstado} onReintentar={reintentarTrack} />
              <DeclaracionLoop
                form={form} onChange={set} idPrefijo={`${idPrefijo}-loop`}
                deshabilitado={deshabilitado}
                conAlicuotas={trackEstado === 'ok' && track === TRACK_CON_ALICUOTA}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProximaAccionForm;
