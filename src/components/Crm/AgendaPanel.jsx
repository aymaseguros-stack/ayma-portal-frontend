import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import { authHeader, formatApiError } from '../../utils/api';
import { TIPOS_TAREA_VALIDOS, PRIORIDADES_VALIDAS } from './oportunidadConstants';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const formatDia = (fechaISO) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (fechaISO === hoy) return 'Hoy';
  if (fechaISO === manana) return 'Mañana';
  return new Date(fechaISO + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
};

const TareaRow = ({ t, onCompletar, vencida }) => (
  <div className={`flex items-start gap-3 rounded-lg p-3 ${vencida ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-700/30'}`}>
    <input
      type="checkbox"
      checked={t.estado === 'COMPLETADA'}
      onChange={() => onCompletar(t.id)}
      className="w-4 h-4 mt-1 rounded shrink-0"
    />
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`font-medium ${t.estado === 'COMPLETADA' ? 'line-through text-slate-500' : ''}`}>{t.titulo}</span>
        <span className={`text-xs shrink-0 ${vencida ? 'text-red-400' : 'text-slate-500'}`}>
          {new Date(t.fecha_programada).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        {t.tipo && <span className="px-2 py-0.5 bg-slate-600 rounded text-xs">{t.tipo}</span>}
        <span className="px-2 py-0.5 bg-slate-600 rounded text-xs">{t.prioridad}</span>
      </div>
      {t.descripcion && <p className="text-slate-400 text-sm mt-1">{t.descripcion}</p>}
    </div>
  </div>
);

// Fila 2, tab "Agenda": vencidas arriba en rojo, después los próximos 7 días
// agrupados por día. GET /crm/tareas/agenda ya trae ambos bloques armados.
const AgendaPanel = ({ token }) => {
  const [agenda, setAgenda] = useState({ dias: {}, vencidas: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [nuevaForm, setNuevaForm] = useState({ tipo: '', titulo: '', descripcion: '', fecha_programada: '', prioridad: 'MEDIA' });
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);

  const headers = { ...authHeader(token), 'Content-Type': 'application/json' };

  const cargarAgenda = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/tareas/agenda`, { headers });
      if (!res.ok) throw new Error(await formatApiError(res));
      setAgenda(await res.json());
    } catch (err) {
      console.error('Error cargando agenda:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarAgenda(); }, []);

  const completarTarea = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/tareas/${id}/completar`, {
        method: 'PATCH', headers, body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await formatApiError(res));
      cargarAgenda();
    } catch (err) {
      alert('No se pudo completar la tarea: ' + err.message);
    }
  };

  const crearTarea = async (e) => {
    e.preventDefault();
    if (!nuevaForm.titulo.trim() || !nuevaForm.fecha_programada) {
      setErrorForm('Completá título y fecha');
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/tareas`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tipo: nuevaForm.tipo || null,
          titulo: nuevaForm.titulo,
          descripcion: nuevaForm.descripcion || null,
          fecha_programada: new Date(nuevaForm.fecha_programada).toISOString(),
          prioridad: nuevaForm.prioridad,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo crear la tarea');
      }
      setMostrarNueva(false);
      setNuevaForm({ tipo: '', titulo: '', descripcion: '', fecha_programada: '', prioridad: 'MEDIA' });
      cargarAgenda();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const diasOrdenados = Object.keys(agenda.dias || {}).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Agenda</h2>
        <button
          onClick={() => { setNuevaForm({ tipo: '', titulo: '', descripcion: '', fecha_programada: '', prioridad: 'MEDIA' }); setErrorForm(null); setMostrarNueva(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-medium"
        >
          <Icon name="plus" />
          Nueva tarea
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-slate-400 text-center py-8">Cargando agenda...</p>
      ) : (
        <div className="space-y-8">
          {agenda.vencidas.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Icon name="exclamation-triangle" />
                Vencidas ({agenda.vencidas.length})
              </h3>
              <div className="space-y-2">
                {agenda.vencidas.map((t) => <TareaRow key={t.id} t={t} onCompletar={completarTarea} vencida />)}
              </div>
            </div>
          )}

          {diasOrdenados.length === 0 && agenda.vencidas.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">Sin tareas próximas</p>
          ) : (
            diasOrdenados.map((dia) => (
              <div key={dia}>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 capitalize">
                  {formatDia(dia)}
                </h3>
                <div className="space-y-2">
                  {agenda.dias[dia].map((t) => <TareaRow key={t.id} t={t} onCompletar={completarTarea} />)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {mostrarNueva && (
        <Modal title="Nueva tarea" onClose={() => setMostrarNueva(false)} maxWidth="max-w-md">
          <form onSubmit={crearTarea} className="space-y-5">
            <div>
              <label className="block text-slate-400 text-sm mb-2">Título *</label>
              <input
                type="text"
                value={nuevaForm.titulo}
                onChange={(e) => setNuevaForm(prev => ({ ...prev, titulo: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Tipo</label>
                <select
                  value={nuevaForm.tipo}
                  onChange={(e) => setNuevaForm(prev => ({ ...prev, tipo: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                >
                  <option value="">Sin especificar</option>
                  {TIPOS_TAREA_VALIDOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Prioridad</label>
                <select
                  value={nuevaForm.prioridad}
                  onChange={(e) => setNuevaForm(prev => ({ ...prev, prioridad: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                >
                  {PRIORIDADES_VALIDAS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Fecha y hora *</label>
              <input
                type="datetime-local"
                value={nuevaForm.fecha_programada}
                onChange={(e) => setNuevaForm(prev => ({ ...prev, fecha_programada: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Descripción</label>
              <textarea
                value={nuevaForm.descripcion}
                onChange={(e) => setNuevaForm(prev => ({ ...prev, descripcion: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
              />
            </div>
            {errorForm && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{errorForm}</div>
            )}
            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => setMostrarNueva(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cancelar
              </button>
              <button type="submit" disabled={guardando} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition">
                {guardando ? 'Creando...' : 'Crear tarea'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default AgendaPanel;
