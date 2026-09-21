import React, { useState } from 'react';
import Modal from '../Modal';
import { hoyISO } from '../../utils/fechas';
import { pedirTransicion } from './pipelineApi';
import {
  MOTIVOS_BAJA_VALIDOS, MOTIVO_BAJA_LABEL, MOTIVO_NO_COLOCABLE_PENDIENTE,
} from './oportunidadConstants';
import DeclaracionLoop from './DeclaracionLoop';
import { FORM_LOOP_VACIO, payloadLoop, validarLoop } from './declaracionLoop';

// LOOP y RECUPERABLE: las dos únicas transiciones que se piden a mano, cada una
// con sus campos obligatorios.
//
//   LOOP        - `fecha_recontacto`. Un LOOP sin fecha de recontacto es un
//                 dato que nadie vuelve a tocar.
//   RECUPERABLE - `fecha_baja`, `motivo_baja` y `fecha_recontacto`, y sólo se
//                 llega desde CLIENTE (es la baja de un cliente que se tenía).
//
// Desde el backend PR #187 LOOP exige además `resultado_loop` (D-B8): sin él,
// TODA entrada a LOOP desde el portal era un 409. El bloque que lo declara es
// `DeclaracionLoop`, el MISMO que usa el cierre PERDIDA - ver el comentario de
// cabecera de ese archivo sobre por qué no está copiado en cada puerta.
//
// Los campos los exige también el backend (409 con el motivo); pedirlos acá es
// para no perder el texto ya escrito en un 409 evitable.
const TransicionEstadoModal = ({ token, oportunidad, destino, onCerrar, onAplicada }) => {
  const esRecuperable = destino === 'RECUPERABLE';
  const [form, setForm] = useState({
    fecha_recontacto: '',
    fecha_baja: esRecuperable ? hoyISO() : '',
    motivo_baja: '',
    nota: '',
    ...FORM_LOOP_VACIO,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const set = (campo) => (e) => setForm((prev) => ({ ...prev, [campo]: e.target.value }));
  const setValor = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const confirmar = async (e) => {
    e.preventDefault();
    if (!form.fecha_recontacto) { setError('Indicá la fecha de recontacto'); return; }
    if (esRecuperable && !form.fecha_baja) { setError('Indicá la fecha de baja'); return; }
    if (esRecuperable && !form.motivo_baja) { setError('Elegí el motivo de la baja'); return; }
    // RECUPERABLE no declara resultado del LOOP: es la baja de un cliente que
    // se tenía, no el cierre de una gestión ante otra compañía.
    if (!esRecuperable) {
      const problema = validarLoop(form);
      if (problema) { setError(problema); return; }
    }

    setGuardando(true);
    setError(null);
    try {
      const respuesta = await pedirTransicion(token, oportunidad.id, {
        estado_crm: destino,
        fecha_recontacto: form.fecha_recontacto,
        fecha_baja: esRecuperable ? form.fecha_baja : null,
        motivo_baja: esRecuperable ? form.motivo_baja : null,
        nota: form.nota.trim() || null,
        loop: esRecuperable ? null : payloadLoop(form),
      });
      onAplicada(respuesta);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';

  return (
    <Modal
      title={esRecuperable ? 'Baja de cliente (RECUPERABLE)' : 'Pasar a LOOP'}
      onClose={onCerrar}
      maxWidth={esRecuperable ? 'max-w-md' : 'max-w-lg'}
      zClass="z-[60]"
    >
      <form onSubmit={confirmar} className="space-y-5">
        <p className="text-slate-400 text-sm">
          {esRecuperable
            ? 'La baja de un cliente que ya se tenía. Se registra con el compromiso de volver: por eso la fecha de recontacto es obligatoria.'
            : 'El prospecto no avanza ahora. Queda con fecha de recontacto para volver a trabajarlo; no cuenta como pérdida.'}
        </p>

        {esRecuperable && (
          <>
            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor="tr-fecha-baja">Fecha de baja *</label>
              <input id="tr-fecha-baja" type="date" value={form.fecha_baja} onChange={set('fecha_baja')} className={inputClass} required />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor="tr-motivo">Motivo de la baja *</label>
              <select id="tr-motivo" value={form.motivo_baja} onChange={set('motivo_baja')} className={inputClass} required>
                <option value="">Elegí un motivo...</option>
                {MOTIVOS_BAJA_VALIDOS.map((m) => (
                  <option key={m} value={m}>{MOTIVO_BAJA_LABEL[m] || m}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {!esRecuperable && (
          <DeclaracionLoop
            form={form}
            onChange={setValor}
            idPrefijo="tr"
            deshabilitado={guardando}
          />
        )}

        <div>
          <label className="block text-slate-400 text-sm mb-2" htmlFor="tr-recontacto">Fecha de recontacto *</label>
          <input
            id="tr-recontacto" type="date" value={form.fecha_recontacto}
            onChange={set('fecha_recontacto')} min={hoyISO()} className={inputClass} required
          />
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-2" htmlFor="tr-nota">Nota</label>
          <textarea id="tr-nota" rows={3} value={form.nota} onChange={set('nota')} className={inputClass} />
          {!esRecuperable && (
            // Ver MOTIVO_NO_COLOCABLE_PENDIENTE en oportunidadConstants.js: el
            // motivo del LOOP no tiene columna todavía, así que se pide acá en
            // vez de mandar un `motivo_baja` que el backend rechaza con 422.
            <p className="text-slate-500 text-xs mt-1">
              Dejá el motivo escrito. Si el riesgo no era colocable (ninguna compañía lo toma),
              escribilo como <span className="font-mono text-slate-400">{MOTIVO_NO_COLOCABLE_PENDIENTE}</span>:
              todavía no es un motivo tipificado del backend y se reporta a mano.
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex gap-4 pt-2">
          <button type="button" onClick={onCerrar} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
            Cancelar
          </button>
          <button
            type="submit" disabled={guardando}
            className={`flex-1 py-3 disabled:opacity-50 rounded-lg font-semibold transition ${
              esRecuperable ? 'bg-orange-600 hover:bg-orange-700' : 'bg-yellow-600 hover:bg-yellow-700'
            }`}
          >
            {guardando ? 'Aplicando...' : `Confirmar ${destino}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default TransicionEstadoModal;
