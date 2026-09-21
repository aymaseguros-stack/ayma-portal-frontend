import React, { useState } from 'react';
import { authHeader, formatApiError } from '../../utils/api';
import { normalizarPatente } from './oportunidadCatalogos';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

// C-15 - de qué riesgo estamos hablando.
//
// "¿Cuál era la oportunidad del HAC394?" se contestaba leyendo notas a mano.
// La patente y el número de solicitud de la compañía son dos campos propios,
// editables desde la ficha y buscables desde el listado.
//
// LA PATENTE SE NORMALIZA ACÁ ADEMÁS DE EN EL BACKEND (mayúsculas, sin
// espacios ni guiones) y NO es una duplicación ociosa: lo que se manda es lo
// que el operador ve confirmado en el campo, así que tipear "hac 394" y que
// el campo muestre HAC394 es la forma de que se entere de que el sistema las
// considera la misma. La VALIDACIÓN de formato la hace el backend, que es
// donde vive la lista de los cuatro formatos argentinos: repetir la regla acá
// sería tener dos definiciones de qué es una patente.
//
// EL NÚMERO DE SOLICITUD NO SE TOCA: el formato lo elige cada compañía
// ("4-18752305") y recortarle los guiones lo dejaría sin coincidir con lo que
// el operador lee en el extranet de ellos, que es el único lugar donde sirve.

const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';

const IdentificacionRiesgo = ({ token, oportunidad, onGuardado }) => {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    patente: oportunidad.patente || '',
    numero_solicitud_compania: oportunidad.numero_solicitud_compania || '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const abrir = () => {
    setForm({
      patente: oportunidad.patente || '',
      numero_solicitud_compania: oportunidad.numero_solicitud_compania || '',
    });
    setError(null);
    setEditando(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/oportunidades/${oportunidad.id}`, {
        method: 'PATCH',
        headers: { ...authHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patente: form.patente.trim() ? normalizarPatente(form.patente) : null,
          numero_solicitud_compania: form.numero_solicitud_compania.trim() || null,
        }),
      });
      // El 422 de una patente mal tipeada trae el motivo con los cuatro
      // formatos válidos escritos: se muestra TAL CUAL, que es lo que le dice
      // al operador qué corregir.
      if (!res.ok) throw new Error(await formatApiError(res));
      setEditando(false);
      onGuardado?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!editando) {
    return (
      <div className="md:col-span-2 bg-slate-700/20 rounded-lg p-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <p className="text-slate-500 text-xs">Patente</p>
          <p className="font-mono text-sm">{oportunidad.patente || '—'}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs">N° de solicitud de la compañía</p>
          <p className="font-mono text-sm">{oportunidad.numero_solicitud_compania || '—'}</p>
        </div>
        <button
          type="button"
          onClick={abrir}
          className="ml-auto text-blue-400 hover:text-blue-300 text-xs underline"
        >
          {oportunidad.patente || oportunidad.numero_solicitud_compania
            ? 'Editar identificación del riesgo'
            : 'Agregar patente / N° de solicitud'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={guardar} className="md:col-span-2 bg-slate-700/20 rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-400 text-xs mb-1" htmlFor="riesgo-patente">Patente</label>
          <input
            id="riesgo-patente"
            type="text"
            value={form.patente}
            onChange={(e) => setForm((p) => ({ ...p, patente: normalizarPatente(e.target.value) }))}
            placeholder="HAC394 · AB123CD"
            className={`${inputClass} font-mono`}
            disabled={guardando}
          />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1" htmlFor="riesgo-solicitud">
            N° de solicitud de la compañía
          </label>
          <input
            id="riesgo-solicitud"
            type="text"
            maxLength={50}
            value={form.numero_solicitud_compania}
            onChange={(e) => setForm((p) => ({ ...p, numero_solicitud_compania: e.target.value }))}
            placeholder="4-18752305"
            className={`${inputClass} font-mono`}
            disabled={guardando}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-3 py-2 rounded-lg text-xs">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-xs"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-xs font-semibold transition"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
};

export default IdentificacionRiesgo;
