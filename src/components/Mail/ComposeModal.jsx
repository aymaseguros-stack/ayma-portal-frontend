import React, { useState } from 'react';
import Modal from '../Modal';
import { enviarEmail } from './mailApi';

// Compositor de correo compartido: se abre tanto desde "Responder" en la
// bandeja como desde "Redactar" en el timeline de una ficha del CRM. Cuando
// se abre desde una oportunidad, se manda oportunidad_id para que el backend
// deje el token en el asunto (ver instrucciones del módulo Mail).
const ComposeModal = ({
  token, destinatarioInicial = '', asuntoInicial = '', respondeAId = null,
  tipoEntidad = null, entidadId = null, oportunidadId = null,
  onClose, onEnviado,
}) => {
  const [form, setForm] = useState({
    destinatario: destinatarioInicial || '',
    asunto: asuntoInicial || '',
    cuerpo: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.destinatario.trim()) {
      setError('Ingresá al menos un destinatario');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const data = await enviarEmail(token, {
        destinatario: form.destinatario.trim(),
        asunto: form.asunto || null,
        cuerpo: form.cuerpo,
        responde_a_id: respondeAId || null,
        tipo_entidad: tipoEntidad || null,
        entidad_id: entidadId || null,
        oportunidad_id: oportunidadId || null,
      });
      onEnviado?.(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal title={respondeAId ? 'Responder' : 'Redactar correo'} onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-400 text-sm mb-2">Para</label>
          <input
            type="text"
            value={form.destinatario}
            onChange={(e) => setForm(prev => ({ ...prev, destinatario: e.target.value }))}
            placeholder="destinatario@email.com"
            className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-2">Asunto</label>
          <input
            type="text"
            value={form.asunto}
            onChange={(e) => setForm(prev => ({ ...prev, asunto: e.target.value }))}
            className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-2">Mensaje</label>
          <textarea
            value={form.cuerpo}
            onChange={(e) => setForm(prev => ({ ...prev, cuerpo: e.target.value }))}
            rows={8}
            className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {oportunidadId && (
          <p className="text-xs text-slate-500">Se enviará vinculado a la oportunidad; el token quedará incluido en el asunto.</p>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-4 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
          >
            {enviando ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ComposeModal;
