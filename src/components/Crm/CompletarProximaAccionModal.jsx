import React, { useState } from 'react';
import Modal from '../Modal';
import ProximaAccionForm from './ProximaAccionForm';
import { useProximaAccionForm } from './useProximaAccion';
import { completarTarea } from './proximaAccion';

// C-9d - completar una tarea de próxima acción (`origen=PROXIMA_ACCION`).
// El backend exige la siguiente con el MISMO contrato que al cerrar un toque,
// así que el formulario es el mismo. Se abre desde la Agenda y desde
// "Próximas acciones" en Seguimientos de hoy.
//
// Un 422 deja el modal abierto con el texto del backend: cerrarlo haría
// perder lo que la persona ya eligió.
//
// `tarea`: { id, titulo, oportunidad_id, track? }. El track viene en la fila
// de "Próximas acciones"; desde la Agenda no, y se lee al elegir LOOP.
// `zClass`: desde la ficha (que ya es un modal) va un nivel más arriba.
const CompletarProximaAccionModal = ({ token, tarea, onCerrar, onCompletada, zClass }) => {
  const estado = useProximaAccionForm({
    token, oportunidadId: tarea.oportunidad_id, trackConocido: tarea.track || null,
  });
  const [resultado, setResultado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const confirmar = async (e) => {
    e.preventDefault();
    const problema = estado.validar();
    if (problema) { setError(problema); return; }
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await completarTarea(token, tarea.id, {
        resultado: resultado.trim() || null,
        proxima_accion: estado.payload(),
      });
      await onCompletada(respuesta);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal title={`Completar · ${tarea.titulo || 'Próxima acción'}`} onClose={onCerrar} maxWidth="max-w-lg" zClass={zClass}>
      <form onSubmit={confirmar} className="space-y-5">
        <div>
          <label className="block text-slate-400 text-sm mb-2" htmlFor="pa-completar-resultado">
            Qué pasó (opcional)
          </label>
          <textarea
            id="pa-completar-resultado" rows={2} value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
          />
        </div>

        <ProximaAccionForm estado={estado} idPrefijo="pa-completar" deshabilitado={guardando} />

        {error && (
          <div role="alert" className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex gap-4 pt-2">
          <button type="button" onClick={onCerrar} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
            Cancelar
          </button>
          <button
            type="submit" disabled={guardando || !estado.form.tipo}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
          >
            {guardando ? 'Guardando...' : 'Completar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CompletarProximaAccionModal;
