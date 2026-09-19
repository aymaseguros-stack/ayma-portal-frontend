import React, { useMemo, useState } from 'react';
import Modal from '../Modal';
import { validarSeleccion, formatBytes } from './adjuntosApi';
import { registrarCotizacionEntregada, nuevaIdempotencyKey } from './pipelineApi';

// "Registrar cotización entregada": compañía, premio y el PDF, en UNA llamada.
//
// Al confirmar, el backend registra el acto COTIZACION, mueve la oportunidad a
// POTENCIAL, suma los 13 puntos y programa el toque 1 a +24 h. El estado NO se
// elige en este formulario y no hay campo para elegirlo: POTENCIAL es la
// consecuencia de haber entregado la cotización.
//
// LA IDEMPOTENCY-KEY SE GENERA UNA SOLA VEZ, AL ABRIR EL MODAL (useMemo con
// deps vacías), no por request. Si el fetch se corta y la persona vuelve a
// apretar "Confirmar", la clave tiene que ser LA MISMA para que el backend
// devuelva la cotización que ya registró. Una clave nueva por intento entrega
// la misma cotización dos veces: 26 puntos y dos cadencias de seguimiento
// corriendo sobre el mismo prospecto.
const CotizacionEntregadaModal = ({ token, oportunidad, onCerrar, onRegistrada }) => {
  const [form, setForm] = useState({ compania: '', premio: '', vehiculo: '', resumen: '' });
  const [archivo, setArchivo] = useState(null);
  const [errorArchivo, setErrorArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const idempotencyKey = useMemo(() => nuevaIdempotencyKey(), []);

  const set = (campo) => (e) => setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  // Las mismas reglas que valida el backend (tipo real por firma de bytes,
  // 10 MB), antes de subir: deja mostrar el motivo exacto del rechazo sin
  // gastar el viaje ni la Idempotency-Key.
  const elegirArchivo = async (e) => {
    const nuevos = Array.from(e.target.files || []);
    setErrorArchivo(null);
    if (nuevos.length === 0) { setArchivo(null); return; }
    const { aceptados, errores } = await validarSeleccion(nuevos.slice(0, 1), []);
    if (errores.length > 0 || aceptados.length === 0) {
      setErrorArchivo(errores.join('; ') || 'No se pudo leer el archivo');
      setArchivo(null);
      return;
    }
    setArchivo(aceptados[0]);
  };

  const confirmar = async (e) => {
    e.preventDefault();
    const premio = Number(String(form.premio).replace(',', '.'));
    if (!form.compania.trim()) { setError('Indicá la compañía'); return; }
    if (!Number.isFinite(premio) || premio <= 0) { setError('El premio tiene que ser un número mayor a cero'); return; }

    setGuardando(true);
    setError(null);
    try {
      const respuesta = await registrarCotizacionEntregada(
        token,
        oportunidad.id,
        {
          compania: form.compania.trim(),
          premio,
          vehiculo: form.vehiculo.trim() || null,
          resumen: form.resumen.trim() || null,
          archivo: archivo ? archivo.archivo : null,
        },
        idempotencyKey,
      );
      onRegistrada(respuesta);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';

  return (
    <Modal title="Registrar cotización entregada" onClose={onCerrar} maxWidth="max-w-md" zClass="z-[60]">
      <form onSubmit={confirmar} className="space-y-5">
        <p className="text-slate-400 text-sm">
          Al confirmar, la oportunidad pasa a <span className="text-blue-300 font-medium">POTENCIAL</span> y
          queda programado el primer seguimiento para dentro de 24 h. El estado no se elige: lo deriva el acto.
        </p>

        <div>
          <label className="block text-slate-400 text-sm mb-2" htmlFor="cot-compania">Compañía *</label>
          <input id="cot-compania" type="text" value={form.compania} onChange={set('compania')} className={inputClass} required />
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-2" htmlFor="cot-premio">Premio *</label>
          <input
            id="cot-premio" type="number" step="0.01" min="0" inputMode="decimal"
            value={form.premio} onChange={set('premio')} className={inputClass} required
          />
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-2" htmlFor="cot-vehiculo">Vehículo</label>
          <input
            id="cot-vehiculo" type="text" value={form.vehiculo} onChange={set('vehiculo')}
            placeholder="Ford Focus 2019" className={inputClass}
          />
          <p className="text-slate-500 text-xs mt-1">Va en el mensaje de los seguimientos.</p>
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-2" htmlFor="cot-archivo">PDF de la cotización</label>
          <input
            id="cot-archivo" type="file" accept="application/pdf,image/png,image/jpeg"
            onChange={elegirArchivo} disabled={guardando}
            className="w-full text-sm text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-200"
          />
          {archivo && (
            <p className="text-slate-400 text-xs mt-1">
              {archivo.nombre} · {formatBytes(archivo.tamano)}
            </p>
          )}
          {errorArchivo && <p className="text-red-300 text-xs mt-1">{errorArchivo}</p>}
          <p className="text-slate-500 text-xs mt-1">
            Opcional. Si Drive falla, la cotización se registra igual y el aviso lo dice.
          </p>
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-2" htmlFor="cot-resumen">Resumen</label>
          <textarea id="cot-resumen" rows={2} value={form.resumen} onChange={set('resumen')} className={inputClass} />
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex gap-4 pt-2">
          <button type="button" onClick={onCerrar} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition">
            {guardando ? 'Registrando...' : 'Confirmar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CotizacionEntregadaModal;
