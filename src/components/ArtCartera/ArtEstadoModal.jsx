import React, { useState } from 'react';
import Modal from '../Modal';
import { registrarEstadoArt } from './artCarteraApi';
import { TIPOS_ESTADO_ART, MOTIVOS_RECHAZO_ART, aseguradoraLabel } from './artCarteraConstants';

const labelClass = 'block text-slate-400 text-sm mb-1.5';
const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

const FORM_INICIAL = {
  tipo: '',
  alicuota: '',
  motivo: '',
  productor_bloqueante: '',
  fecha_evento: '',
  dias_vigencia: '',
  dias_sla: '',
  nota: '',
};

// Modal "Registrar respuesta" de una celda de la matriz -> POST /art/estado.
// Valida en el cliente las mismas reglas que el backend (app/api/v1/art_consultas.py
// crear_estado_art) para dar feedback inmediato, pero el backend sigue siendo
// la fuente de verdad: cualquier 422 que devuelva se muestra tal cual.
const ArtEstadoModal = ({ token, cuit, aseguradora, onClose, onRegistrado }) => {
  const [form, setForm] = useState(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const cambiar = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const validar = () => {
    if (!form.tipo) return 'Elegí un tipo de estado';
    if (form.tipo === 'ALICUOTA') {
      const n = Number(form.alicuota);
      if (!form.alicuota || Number.isNaN(n) || n <= 0 || n > 10) return 'La alícuota debe estar entre 0 y 10';
    }
    if (form.tipo === 'RECHAZADA' && !form.motivo) return 'Elegí un motivo de rechazo';
    if (form.tipo === 'BLOQUEADA' && !form.productor_bloqueante.trim()) return 'Indicá el productor bloqueante';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const mensajeValidacion = validar();
    if (mensajeValidacion) {
      setError(mensajeValidacion);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const payload = {
        cuit,
        aseguradora,
        tipo: form.tipo,
        fuente: 'MANUAL',
        alicuota: form.tipo === 'ALICUOTA' ? Number(form.alicuota) : undefined,
        motivo: form.tipo === 'RECHAZADA' ? form.motivo : undefined,
        productor_bloqueante: form.tipo === 'BLOQUEADA' ? form.productor_bloqueante.trim() : undefined,
        fecha_evento: form.fecha_evento || undefined,
        dias_vigencia: form.dias_vigencia !== '' ? Number(form.dias_vigencia) : undefined,
        dias_sla: form.tipo === 'TECNICA' && form.dias_sla !== '' ? Number(form.dias_sla) : undefined,
        nota: form.nota.trim() || undefined,
      };
      const respuesta = await registrarEstadoArt(token, payload);
      onRegistrado(respuesta);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal title={`Registrar respuesta · ${aseguradoraLabel(aseguradora)}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Tipo de estado *</label>
          <select value={form.tipo} onChange={(e) => cambiar('tipo', e.target.value)} className={inputClass} required>
            <option value="">Seleccionar...</option>
            {TIPOS_ESTADO_ART.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {form.tipo === 'ALICUOTA' && (
          <div>
            <label className={labelClass}>Alícuota (0-10) *</label>
            <input
              type="number" step="0.001" min="0.001" max="10"
              value={form.alicuota}
              onChange={(e) => cambiar('alicuota', e.target.value)}
              className={inputClass}
              required
            />
          </div>
        )}

        {form.tipo === 'RECHAZADA' && (
          <div>
            <label className={labelClass}>Motivo *</label>
            <select value={form.motivo} onChange={(e) => cambiar('motivo', e.target.value)} className={inputClass} required>
              <option value="">Seleccionar...</option>
              {MOTIVOS_RECHAZO_ART.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}

        {form.tipo === 'BLOQUEADA' && (
          <div>
            <label className={labelClass}>Productor bloqueante *</label>
            <input
              type="text"
              value={form.productor_bloqueante}
              onChange={(e) => cambiar('productor_bloqueante', e.target.value)}
              className={inputClass}
              required
            />
          </div>
        )}

        {form.tipo === 'TECNICA' && (
          <div>
            <label className={labelClass}>Días de SLA (opcional)</label>
            <input
              type="number" min="1"
              value={form.dias_sla}
              onChange={(e) => cambiar('dias_sla', e.target.value)}
              placeholder="Default del parámetro dias_sla_tecnica_default"
              className={inputClass}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fecha del evento</label>
            <input
              type="date"
              value={form.fecha_evento}
              onChange={(e) => cambiar('fecha_evento', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Días de vigencia (override)</label>
            <input
              type="number" min="1"
              value={form.dias_vigencia}
              onChange={(e) => cambiar('dias_vigencia', e.target.value)}
              placeholder="Default por tipo/motivo"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Nota (opcional)</label>
          <textarea
            value={form.nota}
            onChange={(e) => cambiar('nota', e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>

        {error && (
          <div className="bg-red-500/15 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition"
          >
            {enviando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ArtEstadoModal;
