import React, { useState } from 'react';
import Modal from '../Modal';
import { MOTIVOS_BAJA, MOTIVO_OTRO, PALABRA_BAJA } from './bajaApi';

// El diálogo de baja, UNO para oportunidad y persona (C-6l puntos 2 y 3).
//
// POR QUÉ COMPARTIDO: el backend valida el MISMO vocabulario de motivo en
// los dos DELETE y devuelve 409 legible en los dos casos (datos de emisión
// sin purgar de un lado, oportunidades vivas del otro). Dos diálogos con el
// mismo contrato son dos lugares donde agregar el motivo que mañana se
// sume, y el segundo es el que se olvida.
//
// UN POST POR CLIC: `enviando` es guarda de reentrada (H-66). Sin ella el
// doble clic manda dos DELETE, y el segundo se cruza con la recarga que
// dispara el primero.
const BajaModal = ({
  titulo, aviso, extra, enviando, error, onConfirmar, onCerrar,
}) => {
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errorLocal, setErrorLocal] = useState(null);

  const pideDetalle = motivo === MOTIVO_OTRO;
  // EL MOTIVO NO TIENE DEFAULT, y eso es deliberado (mismo criterio que
  // `resultado` en el cierre y que `resultado_loop`): abrir con "Prueba"
  // marcada haría que el que da de baja un duplicado lo asiente como una
  // prueba sin haberlo elegido, y el dato queda mintiendo en el padrón.
  const listo = !!motivo
    && !(pideDetalle && !detalle.trim())
    && confirmacion.trim().toUpperCase() === PALABRA_BAJA;

  const confirmar = () => {
    if (enviando) return;
    if (!motivo) { setErrorLocal('Elegí el motivo de la baja.'); return; }
    if (pideDetalle && !detalle.trim()) {
      setErrorLocal('Con motivo "Otro" hay que decir por qué se da de baja.');
      return;
    }
    setErrorLocal(null);
    onConfirmar({ motivo, detalle: detalle.trim() });
  };

  return (
    <Modal title={titulo} onClose={onCerrar} maxWidth="max-w-lg">
      <div className="space-y-5">
        <div className="bg-red-500/10 border border-red-500/40 text-red-100 px-4 py-3 rounded-lg text-sm">
          {aviso}
        </div>

        {extra}

        <div>
          <label className="block text-slate-400 text-sm mb-2">Motivo de la baja</label>
          <div className="grid grid-cols-2 gap-2">
            {MOTIVOS_BAJA.map((m) => (
              <button
                key={m.valor}
                type="button"
                onClick={() => setMotivo(m.valor)}
                aria-pressed={motivo === m.valor}
                disabled={enviando}
                className={`py-2.5 rounded-lg text-sm font-medium transition ${
                  motivo === m.valor ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {pideDetalle && (
          <div>
            <label className="block text-slate-400 text-sm mb-2" htmlFor="baja-detalle">
              Detalle (obligatorio con motivo &quot;Otro&quot;)
            </label>
            <textarea
              id="baja-detalle"
              rows={2}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              disabled={enviando}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-slate-400 text-sm mb-2" htmlFor="baja-confirmacion">
            Escribí {PALABRA_BAJA} para confirmar
          </label>
          <input
            id="baja-confirmacion"
            type="text"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            disabled={enviando}
            autoComplete="off"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
          />
        </div>

        {(errorLocal || error) && (
          <div role="alert" className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm whitespace-pre-line">
            {errorLocal || error}
          </div>
        )}

        <div className="flex gap-4 pt-2">
          <button type="button" onClick={onCerrar} disabled={enviando} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={enviando || !listo}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold transition"
          >
            {enviando ? 'Dando de baja...' : 'Confirmar baja'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BajaModal;
