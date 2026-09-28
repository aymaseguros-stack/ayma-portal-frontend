import React, { useState } from 'react';
import Modal from './Modal';

// C-9j: la confirmación de la app. Reemplaza al `window.confirm()` nativo,
// que bloquea la pestaña, no se puede estilar y deja trabado a cualquier
// agente que maneje el navegador.
//
// `onConfirmar` puede ser async. Mientras corre, los dos botones quedan
// deshabilitados (un doble click no manda dos PATCH). Si falla, el modal
// queda ABIERTO con el error: cerrarlo escondería que la acción no se hizo.
// Si sale bien, quien lo abrió lo cierra (en su `onConfirmar`).
//
// `zClass`: arriba de otro modal (la ficha) va un nivel más alto.
const ConfirmarModal = ({
  titulo = 'Confirmar',
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  onConfirmar,
  onCancelar,
  zClass = 'z-[60]',
}) => {
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState(null);

  const confirmar = async () => {
    setEnCurso(true);
    setError(null);
    try {
      await onConfirmar();
    } catch (err) {
      setError(err?.message || String(err));
      setEnCurso(false);
    }
  };

  return (
    <Modal title={titulo} onClose={enCurso ? () => {} : onCancelar} maxWidth="max-w-sm" zClass={zClass}>
      <div className="space-y-5" role="alertdialog" aria-label={titulo}>
        {mensaje && <p className="text-slate-300 text-sm">{mensaje}</p>}
        {error && (
          <div role="alert" className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}
        <div className="flex gap-3">
          <button
            type="button" onClick={onCancelar} disabled={enCurso}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg transition"
          >
            {textoCancelar}
          </button>
          <button
            type="button" onClick={confirmar} disabled={enCurso} autoFocus
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
          >
            {enCurso ? 'Guardando...' : textoConfirmar}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmarModal;
