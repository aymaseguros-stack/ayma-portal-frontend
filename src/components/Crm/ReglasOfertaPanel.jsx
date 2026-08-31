import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import { authHeader, formatApiError, normalizeList } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const REGLA_INICIAL = {
  producto_codigo: '',
  producto_nombre: '',
  tipo_condicion: '',
  operador: '',
  valor: '',
  prioridad: '',
  motivo: '',
};

// Sub-tab "Reglas" de la vista Oportunidades: administración del motor de
// oferta sin tocar código. `motivo` es el texto que termina leyendo el
// cliente, así que se lo destaca (textarea ancha, no un input de una línea).
const ReglasOfertaPanel = ({ token }) => {
  const [reglas, setReglas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filtroProducto, setFiltroProducto] = useState('');
  const [filtroTipoCondicion, setFiltroTipoCondicion] = useState('');

  const [mostrarForm, setMostrarForm] = useState(false);
  const [reglaEditando, setReglaEditando] = useState(null);
  const [form, setForm] = useState(REGLA_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);

  const headers = { ...authHeader(token), 'Content-Type': 'application/json' };

  const cargarReglas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/reglas-oferta`, { headers });
      if (!res.ok) throw new Error(await formatApiError(res));
      setReglas(normalizeList(await res.json()).items);
    } catch (err) {
      console.error('Error cargando reglas de oferta:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarReglas(); }, []);

  const productosDisponibles = useMemo(() => {
    const set = new Map();
    reglas.forEach((r) => { if (r.producto_codigo) set.set(r.producto_codigo, r.producto_nombre || r.producto_codigo); });
    return Array.from(set.entries());
  }, [reglas]);

  const tiposCondicionDisponibles = useMemo(
    () => Array.from(new Set(reglas.map(r => r.tipo_condicion).filter(Boolean))),
    [reglas],
  );

  const reglasFiltradas = useMemo(() => {
    return reglas
      .filter(r => !filtroProducto || r.producto_codigo === filtroProducto)
      .filter(r => !filtroTipoCondicion || r.tipo_condicion === filtroTipoCondicion);
  }, [reglas, filtroProducto, filtroTipoCondicion]);

  const abrirNueva = () => {
    setReglaEditando(null);
    setForm(REGLA_INICIAL);
    setErrorForm(null);
    setMostrarForm(true);
  };

  const abrirEdicion = (regla) => {
    setReglaEditando(regla);
    setForm({ ...REGLA_INICIAL, ...regla });
    setErrorForm(null);
    setMostrarForm(true);
  };

  const set = (campo) => (e) => setForm(prev => ({ ...prev, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.producto_codigo?.trim() || !form.tipo_condicion?.trim() || !form.operador?.trim() || !form.motivo?.trim()) {
      setErrorForm('Completá producto, tipo de condición, operador y motivo');
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      const payload = {
        producto_codigo: form.producto_codigo,
        producto_nombre: form.producto_nombre || null,
        tipo_condicion: form.tipo_condicion,
        operador: form.operador,
        valor: form.valor === '' ? null : form.valor,
        prioridad: form.prioridad === '' ? null : Number(form.prioridad),
        motivo: form.motivo,
      };
      const url = reglaEditando
        ? `${API_URL}/api/v1/crm/reglas-oferta/${reglaEditando.id}`
        : `${API_URL}/api/v1/crm/reglas-oferta`;
      const res = await fetch(url, {
        method: reglaEditando ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await formatApiError(res));
      setMostrarForm(false);
      cargarReglas();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const toggleActiva = async (regla) => {
    // El backend desactiva por DELETE (no borra el registro); reactivar es
    // un PATCH {activa: true} sobre el mismo id.
    const snapshot = reglas;
    setReglas(prev => prev.map(r => r.id === regla.id ? { ...r, activa: !r.activa } : r));
    try {
      if (regla.activa) {
        const res = await fetch(`${API_URL}/api/v1/crm/reglas-oferta/${regla.id}`, { method: 'DELETE', headers });
        if (!res.ok) throw new Error(await formatApiError(res));
      } else {
        const res = await fetch(`${API_URL}/api/v1/crm/reglas-oferta/${regla.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ activa: true }),
        });
        if (!res.ok) throw new Error(await formatApiError(res));
      }
    } catch (err) {
      console.error('Error cambiando estado de la regla:', err);
      setReglas(snapshot);
      alert('No se pudo cambiar el estado de la regla: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Reglas de oferta</h2>
        <button
          onClick={abrirNueva}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-medium"
        >
          <Icon name="plus" />
          Nueva regla
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filtroProducto}
          onChange={(e) => setFiltroProducto(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm"
        >
          <option value="">Todos los productos</option>
          {productosDisponibles.map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>)}
        </select>
        <select
          value={filtroTipoCondicion}
          onChange={(e) => setFiltroTipoCondicion(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm"
        >
          <option value="">Todos los tipos de condición</option>
          {tiposCondicionDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-slate-400 text-center py-8">Cargando reglas...</p>
      ) : reglasFiltradas.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Sin reglas con estos filtros</p>
      ) : (
        <div className="overflow-x-auto border border-slate-700 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-left">Condición</th>
                <th className="px-4 py-3 text-left">Operador</th>
                <th className="px-4 py-3 text-left">Valor</th>
                <th className="px-4 py-3 text-left">Prioridad</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-center">Activa</th>
                <th className="px-4 py-3 text-right">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {reglasFiltradas.map((r) => (
                <tr key={r.id} className={`hover:bg-slate-800/30 ${!r.activa ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">{r.producto_nombre || r.producto_codigo}</td>
                  <td className="px-4 py-3 text-slate-400">{r.tipo_condicion}</td>
                  <td className="px-4 py-3 text-slate-400">{r.operador}</td>
                  <td className="px-4 py-3 text-slate-400">{r.valor ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-400">{r.prioridad ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-300 max-w-md">{r.motivo}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggleActiva(r)}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition ${
                        r.activa ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-slate-600/40 text-slate-400 hover:bg-slate-600/60'
                      }`}
                    >
                      {r.activa ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => abrirEdicion(r)}
                      className="text-slate-400 hover:text-white"
                      title="Editar regla"
                    >
                      <Icon name="pencil-square" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mostrarForm && (
        <Modal title={reglaEditando ? 'Editar regla' : 'Nueva regla'} onClose={() => setMostrarForm(false)} maxWidth="max-w-lg">
          <form onSubmit={guardar} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Código de producto *</label>
                <input
                  type="text"
                  value={form.producto_codigo}
                  onChange={set('producto_codigo')}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Nombre de producto</label>
                <input
                  type="text"
                  value={form.producto_nombre}
                  onChange={set('producto_nombre')}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Tipo de condición *</label>
                <input
                  type="text"
                  value={form.tipo_condicion}
                  onChange={set('tipo_condicion')}
                  placeholder="Ej: EDAD_VEHICULO"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Operador *</label>
                <input
                  type="text"
                  value={form.operador}
                  onChange={set('operador')}
                  placeholder="Ej: MAYOR_IGUAL"
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Valor</label>
                <input
                  type="text"
                  value={form.valor}
                  onChange={set('valor')}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Prioridad</label>
                <input
                  type="number"
                  value={form.prioridad}
                  onChange={set('prioridad')}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-2">
                Motivo * <span className="text-slate-500 font-normal">(el texto que va a leer el cliente)</span>
              </label>
              <textarea
                value={form.motivo}
                onChange={set('motivo')}
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
                required
              />
            </div>

            {errorForm && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{errorForm}</div>
            )}

            <div className="flex gap-4 pt-2">
              <button type="button" onClick={() => setMostrarForm(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cancelar
              </button>
              <button type="submit" disabled={guardando} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition">
                {guardando ? 'Guardando...' : reglaEditando ? 'Guardar cambios' : 'Crear regla'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ReglasOfertaPanel;
