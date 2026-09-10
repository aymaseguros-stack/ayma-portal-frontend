import React, { useState } from 'react';
import Modal from '../Modal';
import { cargarF931Art } from './artCarteraApi';

const labelClass = 'block text-slate-400 text-sm mb-1.5';
const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

const FORM_INICIAL = { masa_salarial: '', dotacion: '', periodo: '' };

// Modal "Cargar F.931" de la grilla de cotización -> POST
// /art/empresas/{id}/f931?dry_run=false.
//
// QUÉ SIGNIFICA CARGAR ESTO: el F.931 es la declaración jurada mensual de
// la empresa ante ARCA. Cargarlo hace que la masa salarial deje de
// estimarse y pase a confianza CONFIRMADA, y con ella todos los importes
// de la grilla. Es el dato que convierte una referencia en una cotización
// presentable, así que el aviso está a la vista en el formulario y no en
// un tooltip.
//
// Valida en el cliente las mismas reglas que el backend (masa y dotación
// > 0, período 'YYYY-MM') para dar feedback inmediato, pero el backend
// sigue siendo la fuente de verdad: cualquier 422 se muestra tal cual.
// Mismo patrón que ArtEstadoModal.jsx.
const ArtF931Modal = ({ token, empresaId, razonSocial, onClose, onCargado }) => {
  const [form, setForm] = useState(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const cambiar = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const validar = () => {
    const masa = Number(form.masa_salarial);
    if (!form.masa_salarial || !Number.isFinite(masa) || masa <= 0) {
      return 'La masa salarial mensual tiene que ser mayor a 0';
    }
    const dotacion = Number(form.dotacion);
    if (!form.dotacion || !Number.isInteger(dotacion) || dotacion <= 0) {
      return 'La dotación tiene que ser un número entero mayor a 0';
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.periodo)) {
      return "El período va en formato 'AAAA-MM' (por ejemplo 2026-07)";
    }
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
      await cargarF931Art(token, empresaId, {
        masa_salarial: Number(form.masa_salarial),
        dotacion: Number(form.dotacion),
        periodo: form.periodo,
      });
      onCargado();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Cargar F.931">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-400">
          Datos declarados por <span className="text-slate-200">{razonSocial}</span> en su F.931.
          Al guardarlos, la masa salarial deja de estimarse y toda la grilla pasa a
          confianza <span className="text-green-300">CONFIRMADA</span>.
        </p>

        <div>
          <label className={labelClass} htmlFor="f931-masa">Masa salarial mensual</label>
          <input
            id="f931-masa"
            type="number"
            step="0.01"
            min="0"
            value={form.masa_salarial}
            onChange={(e) => cambiar('masa_salarial', e.target.value)}
            className={inputClass}
            placeholder="Ej: 12500000"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="f931-dotacion">Dotación declarada</label>
          <input
            id="f931-dotacion"
            type="number"
            min="1"
            step="1"
            value={form.dotacion}
            onChange={(e) => cambiar('dotacion', e.target.value)}
            className={inputClass}
            placeholder="Ej: 40"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="f931-periodo">Período (AAAA-MM)</label>
          <input
            id="f931-periodo"
            type="text"
            value={form.periodo}
            onChange={(e) => cambiar('periodo', e.target.value)}
            className={inputClass}
            placeholder="2026-07"
          />
          <p className="text-xs text-slate-500 mt-1.5">
            De qué mes es la declaración. Sin período, la masa es un número sin fecha.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
          >
            {enviando ? 'Guardando...' : 'Guardar F.931'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ArtF931Modal;
