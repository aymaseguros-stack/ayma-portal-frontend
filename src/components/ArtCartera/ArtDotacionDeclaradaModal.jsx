import React, { useState } from 'react';
import Modal from '../Modal';
import { declararDotacion } from './artCotizacionesApi';
import { numeroAr } from './artCarteraConstants';

const labelClass = 'block text-slate-400 text-xs mb-1';
const inputClass = 'w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';

const Foto = ({ titulo, foto }) => (
  <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm space-y-1">
    <p className="text-xs text-slate-400 uppercase">{titulo}</p>
    <p>{foto?.dotacion === null || foto?.dotacion === undefined ? 'Sin dato' : numeroAr(foto.dotacion)}</p>
    <p className="text-xs text-slate-400">
      fuente {foto?.dotacion_fuente || '—'} · confianza {foto?.dotacion_confianza_lectura || foto?.dotacion_confianza || '—'}
    </p>
  </div>
);

// Ajuste de dotación desde "Armar tanda": POST /art/empresas/{id}/dotacion
// con fuente DECLARADA. Mismo circuito que la tanda: primero dry_run (el
// backend devuelve antes/después sin escribir) y recién después la
// confirmación. 409 = la empresa tiene F.931 y un dato declarado no lo
// pisa: se muestra tal cual.
const ArtDotacionDeclaradaModal = ({ token, empresa, onCerrar, onGuardada }) => {
  const [dotacion, setDotacion] = useState(empresa?.dotacion ? String(empresa.dotacion) : '');
  const [nota, setNota] = useState('');
  const [previa, setPrevia] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const valor = Number(String(dotacion).trim());
  const valido = Number.isInteger(valor) && valor > 0;

  const previsualizar = async (e) => {
    e.preventDefault();
    if (!valido) { setError('La dotación tiene que ser un entero mayor a 0.'); return; }
    setEnviando(true);
    setError(null);
    try {
      setPrevia({ dotacion: valor, nota, respuesta: await declararDotacion(token, empresa.empresa_id, { dotacion: valor, nota }, { dryRun: true }) });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const r = await declararDotacion(token, empresa.empresa_id, { dotacion: previa.dotacion, nota: previa.nota }, { dryRun: false });
      onGuardada?.(r);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal title={`Ajustar dotación · ${empresa?.razon_social || empresa?.cuit || ''}`} onClose={onCerrar}>
      <div className="space-y-4">
        {!previa && (
          <form onSubmit={previsualizar} className="space-y-3" aria-label="Dotación declarada">
            <div>
              <label className={labelClass} htmlFor="dot-valor">Dotación declarada (trabajadores)</label>
              <input id="dot-valor" className={inputClass} inputMode="numeric" value={dotacion} onChange={(e) => setDotacion(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="dot-nota">Nota (de dónde sale el número)</label>
              <input id="dot-nota" className={inputClass} value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} />
            </div>
            <p className="text-xs text-slate-500">Fuente DECLARADA · confianza MEDIA. No toca masa salarial ni el F.931.</p>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onCerrar} className="px-3 py-2 rounded-lg bg-slate-700 text-sm">Cancelar</button>
              <button type="submit" disabled={enviando} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-50">
                {enviando ? 'Consultando…' : 'Previsualizar'}
              </button>
            </div>
          </form>
        )}
        {previa && (
          <div className="space-y-3">
            <p className="text-sm text-amber-300">Previsualización (no se escribió nada). Confirmá para guardar.</p>
            <div className="grid grid-cols-2 gap-3">
              <Foto titulo="Antes" foto={previa.respuesta?.antes} />
              <Foto titulo="Después" foto={previa.respuesta?.despues} />
            </div>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={enviando} onClick={() => { setPrevia(null); setError(null); }} className="px-3 py-2 rounded-lg bg-slate-700 text-sm">
                Volver a editar
              </button>
              <button type="button" disabled={enviando} onClick={confirmar} className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium disabled:opacity-50">
                {enviando ? 'Guardando…' : 'Confirmar dotación'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ArtDotacionDeclaradaModal;
