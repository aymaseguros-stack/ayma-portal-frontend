import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import { authHeader } from '../../utils/api';
import { TRACKS_VALIDOS, ETAPAS_SAIDA_VALIDAS } from './oportunidadConstants';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

// Alta rápida de una oportunidad, siempre vinculada a una entidad ya
// existente (persona, empresa o grupo). `preset` fija esa entidad -y,
// opcionalmente, el track- desde la ficha de origen (Personas/Empresas/
// Grupos, o el chip de "producto faltante"): { persona_id | empresa_id |
// grupo_id, nombre, track? }. Sin `preset` (alta desde el Pipeline) se
// busca la persona o empresa a mano.
const NuevaOportunidadModal = ({ token, preset = null, onClose, onCreated }) => {
  const [entidad, setEntidad] = useState(preset);
  const [buscarQuery, setBuscarQuery] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState({ personas: [], empresas: [] });

  const [form, setForm] = useState({
    track: preset?.track || '',
    etapa_saida: '',
    origen: '',
    prima_estimada: '',
    probabilidad_cierre: '',
    fecha_cierre_estimada: '',
    notas: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const headers = { ...authHeader(token), 'Content-Type': 'application/json' };

  const set = (campo) => (e) => setForm(prev => ({ ...prev, [campo]: e.target.value }));

  useEffect(() => {
    if (preset || !buscarQuery.trim()) { setResultados({ personas: [], empresas: [] }); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/crm/buscar?q=${encodeURIComponent(buscarQuery)}`, { headers: authHeader(token) });
        if (!res.ok) throw new Error('Error ' + res.status);
        const data = await res.json();
        setResultados({ personas: data.personas || [], empresas: data.empresas || [] });
      } catch (err) {
        console.error('Error buscando entidad:', err);
        setResultados({ personas: [], empresas: [] });
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscarQuery]);

  const elegirPersona = (p) => setEntidad({ persona_id: p.id, nombre: `${p.nombre} ${p.apellido || ''}`.trim() });
  const elegirEmpresa = (e) => setEntidad({ empresa_id: e.id, nombre: e.razon_social });

  const guardar = async (e) => {
    e.preventDefault();
    if (!entidad) {
      setError('Elegí una persona o empresa para vincular');
      return;
    }
    if (!form.track) {
      setError('Elegí un track');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const payload = {
        persona_id: entidad.persona_id || null,
        empresa_id: entidad.empresa_id || null,
        grupo_id: entidad.grupo_id || null,
        track: form.track,
        estado_crm: 'DATO',
        etapa_saida: form.etapa_saida || null,
        origen: form.origen || null,
        prima_estimada: form.prima_estimada === '' ? null : Number(form.prima_estimada),
        probabilidad_cierre: form.probabilidad_cierre === '' ? null : Number(form.probabilidad_cierre),
        fecha_cierre_estimada: form.fecha_cierre_estimada || null,
        notas: form.notas || null,
      };
      const res = await fetch(`${API_URL}/api/v1/crm/oportunidades`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo crear la oportunidad');
      }
      const creada = await res.json();
      onCreated?.(creada);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal title="Nueva oportunidad" onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={guardar} className="space-y-5">
        {preset ? (
          <div className="bg-slate-700/30 rounded-lg px-3 py-2 text-sm text-slate-300">
            Vinculada a <span className="font-medium">{preset.nombre}</span>
          </div>
        ) : (
          <div>
            <label className="block text-slate-400 text-sm mb-2">Vincular a *</label>
            {entidad ? (
              <div className="flex items-center justify-between bg-blue-600/20 border border-blue-500/40 rounded-lg px-3 py-2">
                <span className="text-sm">{entidad.nombre}</span>
                <button type="button" onClick={() => setEntidad(null)} className="text-slate-400 hover:text-white">
                  <Icon name="x-mark" size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Icon name="magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={buscarQuery}
                    onChange={(e) => setBuscarQuery(e.target.value)}
                    placeholder="Buscar persona o empresa..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                {buscarQuery.trim() && (
                  <div className="mt-2 max-h-48 overflow-y-auto border border-slate-700 rounded-lg divide-y divide-slate-700">
                    {buscando ? (
                      <p className="text-slate-500 text-sm p-3">Buscando...</p>
                    ) : resultados.personas.length === 0 && resultados.empresas.length === 0 ? (
                      <p className="text-slate-500 text-sm p-3">Sin resultados</p>
                    ) : (
                      <>
                        {resultados.personas.map((p) => (
                          <button type="button" key={`p-${p.id}`} onClick={() => elegirPersona(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700/60 transition">
                            <span className="font-medium">{p.nombre} {p.apellido || ''}</span>
                            <span className="text-slate-500 ml-2 text-xs">Persona</span>
                          </button>
                        ))}
                        {resultados.empresas.map((emp) => (
                          <button type="button" key={`e-${emp.id}`} onClick={() => elegirEmpresa(emp)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700/60 transition">
                            <span className="font-medium">{emp.razon_social}</span>
                            <span className="text-slate-500 ml-2 text-xs">Empresa</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div>
          <label className="block text-slate-400 text-sm mb-2">Track *</label>
          <select
            value={form.track}
            onChange={set('track')}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            required
          >
            <option value="">Elegí un track...</option>
            {TRACKS_VALIDOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-2">Etapa SAIDA</label>
          <select
            value={form.etapa_saida}
            onChange={set('etapa_saida')}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
          >
            <option value="">Sin especificar</option>
            {ETAPAS_SAIDA_VALIDAS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 text-sm mb-2">Prima estimada</label>
            <input
              type="number" min="0" step="0.01"
              value={form.prima_estimada}
              onChange={set('prima_estimada')}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-2">Probabilidad de cierre (%)</label>
            <input
              type="number" min="0" max="100"
              value={form.probabilidad_cierre}
              onChange={set('probabilidad_cierre')}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 text-sm mb-2">Fecha de cierre estimada</label>
            <input
              type="date"
              value={form.fecha_cierre_estimada}
              onChange={set('fecha_cierre_estimada')}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-2">Origen</label>
            <input
              type="text"
              value={form.origen}
              onChange={set('origen')}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-400 text-sm mb-2">Notas</label>
          <textarea
            value={form.notas}
            onChange={set('notas')}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
          />
        </div>

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
            disabled={guardando}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
          >
            {guardando ? 'Creando...' : 'Crear oportunidad'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default NuevaOportunidadModal;
