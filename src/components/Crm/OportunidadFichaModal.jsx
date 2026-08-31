import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import { Dato } from './FichaHelpers';
import { authHeader } from '../../utils/api';
import Timeline from './Timeline';
import {
  ESTADO_CRM_BADGE, CANALES_VALIDOS, MOTIVOS_PERDIDA_VALIDOS,
  formatMoneda,
} from './oportunidadConstants';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const FICHA_TABS = [
  { id: 'datos', label: 'Datos' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'tareas', label: 'Tareas' },
];

// Ficha de una oportunidad puntual: datos, timeline unificado (interacciones +
// tareas) y tareas propias, con acciones de registrar interacción y cerrar.
const OportunidadFichaModal = ({ token, oportunidadId, onClose, onChanged }) => {
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('datos');

  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  const [mostrarInteraccion, setMostrarInteraccion] = useState(false);
  const [interaccionForm, setInteraccionForm] = useState({ canal: 'LLAMADA', direccion: 'OUT', asunto: '', resumen: '' });
  const [guardandoInteraccion, setGuardandoInteraccion] = useState(false);
  const [puntosGanados, setPuntosGanados] = useState(null);

  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [cierreForm, setCierreForm] = useState({ resultado: 'GANADA', motivo_perdida: '', motivo_perdida_detalle: '', compania_ganadora: '' });
  const [guardandoCierre, setGuardandoCierre] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);

  const headers = { ...authHeader(token), 'Content-Type': 'application/json' };

  const cargarDetalle = async () => {
    const res = await fetch(`${API_URL}/api/v1/crm/oportunidades/${oportunidadId}`, { headers });
    if (!res.ok) throw new Error('Error ' + res.status);
    setDetalle(await res.json());
  };

  useEffect(() => {
    setLoading(true);
    cargarDetalle().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oportunidadId]);

  const registrarInteraccion = async (e) => {
    e.preventDefault();
    setGuardandoInteraccion(true);
    setErrorAccion(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/interacciones`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          oportunidad_id: oportunidadId,
          canal: interaccionForm.canal,
          direccion: interaccionForm.direccion,
          asunto: interaccionForm.asunto || null,
          resumen: interaccionForm.resumen || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo registrar la interacción');
      }
      const creada = await res.json();
      setPuntosGanados(Number(creada.puntos_scoring || 0));
      setMostrarInteraccion(false);
      setInteraccionForm({ canal: 'LLAMADA', direccion: 'OUT', asunto: '', resumen: '' });
      await cargarDetalle();
      setTimelineRefreshKey(k => k + 1);
      onChanged?.();
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setGuardandoInteraccion(false);
    }
  };

  const cerrarOportunidad = async (e) => {
    e.preventDefault();
    if (cierreForm.resultado === 'PERDIDA' && !cierreForm.motivo_perdida) {
      setErrorAccion('Elegí un motivo de pérdida');
      return;
    }
    setGuardandoCierre(true);
    setErrorAccion(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/oportunidades/${oportunidadId}/cerrar`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          resultado: cierreForm.resultado,
          motivo_perdida: cierreForm.resultado === 'PERDIDA' ? cierreForm.motivo_perdida : null,
          motivo_perdida_detalle: cierreForm.resultado === 'PERDIDA' ? (cierreForm.motivo_perdida_detalle || null) : null,
          compania_ganadora: cierreForm.resultado === 'GANADA' ? (cierreForm.compania_ganadora || null) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo cerrar la oportunidad');
      }
      setMostrarCierre(false);
      await cargarDetalle();
      onChanged?.();
    } catch (err) {
      setErrorAccion(err.message);
    } finally {
      setGuardandoCierre(false);
    }
  };

  const completarTarea = async (tareaId) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/tareas/${tareaId}/completar`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Error ' + res.status);
      await cargarDetalle();
      onChanged?.();
    } catch (err) {
      alert('No se pudo completar la tarea: ' + err.message);
    }
  };

  const cerrada = detalle && detalle.resultado !== 'EN_CURSO';

  return (
    <Modal
      title={loading ? 'Cargando...' : (detalle?.nombre_vinculado || detalle?.token || 'Oportunidad')}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      {loading || !detalle ? (
        <p className="text-slate-400 text-center py-8">Cargando ficha...</p>
      ) : (
        <div className="space-y-6">
          {/* Encabezado */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-blue-400">{detalle.token}</span>
            <span className="px-2 py-1 bg-slate-700 rounded text-xs font-medium">{detalle.track}</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${ESTADO_CRM_BADGE[detalle.estado_crm] || 'bg-slate-500/20 text-slate-400'}`}>
              {detalle.estado_crm}
            </span>
            {cerrada && (
              <span className={`px-2 py-1 rounded text-xs font-medium ${detalle.resultado === 'GANADA' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {detalle.resultado}
              </span>
            )}
            <span className="ml-auto font-semibold">{formatMoneda(detalle.prima_estimada)}</span>
          </div>

          {puntosGanados !== null && (
            <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-lg text-sm">
              +{puntosGanados} puntos de scoring por esta interacción
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1 overflow-x-auto">
              {FICHA_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                    tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setErrorAccion(null); setMostrarInteraccion(true); }}
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
              >
                <Icon name="chat-bubble" />
                Registrar interacción
              </button>
              {!cerrada && (
                <button
                  onClick={() => { setErrorAccion(null); setMostrarCierre(true); }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
                >
                  <Icon name="check-badge" />
                  Cerrar oportunidad
                </button>
              )}
            </div>
          </div>

          {tab === 'datos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Dato label="Etapa SAIDA" valor={detalle.etapa_saida} />
              <Dato label="Origen" valor={detalle.origen} />
              <Dato label="Probabilidad de cierre" valor={detalle.probabilidad_cierre !== null && detalle.probabilidad_cierre !== undefined ? `${detalle.probabilidad_cierre}%` : null} />
              <Dato label="Fecha de cierre estimada" valor={detalle.fecha_cierre_estimada} />
              <Dato label="Fecha de alta" valor={detalle.fecha_alta ? new Date(detalle.fecha_alta).toLocaleDateString('es-AR') : null} />
              {cerrada && (
                <>
                  <Dato label="Fecha de cierre real" valor={detalle.fecha_cierre_real} />
                  {detalle.resultado === 'PERDIDA' && <Dato label="Motivo de pérdida" valor={detalle.motivo_perdida} />}
                  {detalle.resultado === 'GANADA' && <Dato label="Compañía ganadora" valor={detalle.compania_ganadora} />}
                </>
              )}
              <Dato label="Notas" valor={detalle.notas} full />
            </div>
          )}

          {tab === 'timeline' && (
            <Timeline
              key={timelineRefreshKey}
              token={token}
              tipo="oportunidad"
              id={oportunidadId}
              destinatarioEmail={detalle.email}
              oportunidadId={oportunidadId}
            />
          )}

          {tab === 'tareas' && (
            detalle.tareas.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Sin tareas</p>
            ) : (
              <div className="space-y-2">
                {detalle.tareas.map((t) => (
                  <div key={t.id} className="bg-slate-700/30 rounded-lg p-3 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={t.estado === 'COMPLETADA'}
                      disabled={t.estado === 'COMPLETADA'}
                      onChange={() => completarTarea(t.id)}
                      className="w-4 h-4 mt-1 rounded shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium ${t.estado === 'COMPLETADA' ? 'line-through text-slate-500' : ''}`}>{t.titulo}</span>
                        <span className="text-slate-500 text-xs shrink-0">{new Date(t.fecha_programada).toLocaleString('es-AR')}</span>
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-slate-600 rounded text-xs">{t.prioridad}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Sub-modal: registrar interacción */}
      {mostrarInteraccion && (
        <Modal title="Registrar interacción" onClose={() => setMostrarInteraccion(false)} maxWidth="max-w-md">
          <form onSubmit={registrarInteraccion} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Canal</label>
                <select
                  value={interaccionForm.canal}
                  onChange={(e) => setInteraccionForm(prev => ({ ...prev, canal: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                >
                  {CANALES_VALIDOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Dirección</label>
                <select
                  value={interaccionForm.direccion}
                  onChange={(e) => setInteraccionForm(prev => ({ ...prev, direccion: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                >
                  <option value="OUT">Saliente</option>
                  <option value="IN">Entrante</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Asunto</label>
              <input
                type="text"
                value={interaccionForm.asunto}
                onChange={(e) => setInteraccionForm(prev => ({ ...prev, asunto: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Resumen</label>
              <textarea
                value={interaccionForm.resumen}
                onChange={(e) => setInteraccionForm(prev => ({ ...prev, resumen: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
              />
            </div>
            {errorAccion && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{errorAccion}</div>
            )}
            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => setMostrarInteraccion(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cancelar
              </button>
              <button type="submit" disabled={guardandoInteraccion} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition">
                {guardandoInteraccion ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Sub-modal: cerrar oportunidad */}
      {mostrarCierre && (
        <Modal title="Cerrar oportunidad" onClose={() => setMostrarCierre(false)} maxWidth="max-w-md">
          <form onSubmit={cerrarOportunidad} className="space-y-5">
            <div>
              <label className="block text-slate-400 text-sm mb-2">Resultado</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCierreForm(prev => ({ ...prev, resultado: 'GANADA' }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${cierreForm.resultado === 'GANADA' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  Ganada
                </button>
                <button
                  type="button"
                  onClick={() => setCierreForm(prev => ({ ...prev, resultado: 'PERDIDA' }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${cierreForm.resultado === 'PERDIDA' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  Perdida
                </button>
              </div>
            </div>

            {cierreForm.resultado === 'GANADA' ? (
              <div>
                <label className="block text-slate-400 text-sm mb-2">Compañía ganadora</label>
                <input
                  type="text"
                  value={cierreForm.compania_ganadora}
                  onChange={(e) => setCierreForm(prev => ({ ...prev, compania_ganadora: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Motivo *</label>
                  <select
                    value={cierreForm.motivo_perdida}
                    onChange={(e) => setCierreForm(prev => ({ ...prev, motivo_perdida: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                    required
                  >
                    <option value="">Elegí un motivo...</option>
                    {MOTIVOS_PERDIDA_VALIDOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Detalle</label>
                  <textarea
                    value={cierreForm.motivo_perdida_detalle}
                    onChange={(e) => setCierreForm(prev => ({ ...prev, motivo_perdida_detalle: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                  />
                </div>
              </>
            )}

            {errorAccion && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{errorAccion}</div>
            )}

            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => setMostrarCierre(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cancelar
              </button>
              <button type="submit" disabled={guardandoCierre} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition">
                {guardandoCierre ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
};

export default OportunidadFichaModal;
