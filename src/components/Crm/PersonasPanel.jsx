import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import FieldForm from '../FieldForm';
import { PERSONA_FIELD_SECTIONS, PERSONA_INITIAL_FORM } from './personaFields';
import { Dato, ListaSimple } from './FichaHelpers';
import { normalizeList, formatApiError } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const FICHA_TABS = [
  { id: 'datos', label: 'Datos' },
  { id: 'empresas', label: 'Empresas' },
  { id: 'oportunidades', label: 'Oportunidades' },
  { id: 'polizas', label: 'Pólizas' },
  { id: 'actividad', label: 'Actividad' },
];

const PersonasPanel = ({ token, abrirFichaIdInicial, onFichaAbierta }) => {
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState(null);

  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [nuevaForm, setNuevaForm] = useState(PERSONA_INITIAL_FORM);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);

  const [fichaId, setFichaId] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [fichaLoading, setFichaLoading] = useState(false);
  const [fichaTab, setFichaTab] = useState('datos');
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState(PERSONA_INITIAL_FORM);

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { cargarPersonas(); }, []);

  // Navegación directa desde "Convertir en persona" (tab Leads)
  useEffect(() => {
    if (abrirFichaIdInicial) {
      abrirFicha(abrirFichaIdInicial);
      onFichaAbierta?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirFichaIdInicial]);

  // Buscador en vivo (debounced) contra GET /api/v1/crm/buscar?q=
  useEffect(() => {
    if (!query.trim()) { setResultadosBusqueda(null); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/crm/buscar?q=${encodeURIComponent(query)}`, { headers });
        if (!res.ok) throw new Error('Error ' + res.status);
        const data = await res.json();
        setResultadosBusqueda(data.personas || []);
      } catch (err) {
        console.error('Error buscando personas:', err);
        setResultadosBusqueda([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const cargarPersonas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/personas`, { headers });
      if (!res.ok) throw new Error(await formatApiError(res));
      setPersonas(normalizeList(await res.json()).items);
    } catch (err) {
      console.error('Error cargando personas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const crearPersona = async (e) => {
    e.preventDefault();
    if (!nuevaForm.nombre?.trim()) {
      setErrorForm('El nombre es obligatorio');
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(nuevaForm).map(([k, v]) => [k, v === '' ? null : v])
      );
      const res = await fetch(`${API_URL}/api/v1/crm/personas`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo crear la persona');
      }
      const creada = await res.json();
      setMostrarNueva(false);
      setNuevaForm(PERSONA_INITIAL_FORM);
      cargarPersonas();
      abrirFicha(creada.id);
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirFicha = async (id) => {
    setFichaId(id);
    setFichaTab('datos');
    setEditando(false);
    setFichaLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/personas/${id}/ficha`, { headers });
      if (!res.ok) throw new Error('Error ' + res.status);
      const data = await res.json();
      setFicha(data);
      setEditForm({ ...PERSONA_INITIAL_FORM, ...data });
    } catch (err) {
      console.error('Error cargando ficha:', err);
      alert('No se pudo cargar la ficha de la persona');
      setFichaId(null);
    } finally {
      setFichaLoading(false);
    }
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(editForm)
          .filter(([k]) => PERSONA_FIELD_SECTIONS.some(s => s.campos.some(c => c.name === k)))
          .map(([k, v]) => [k, v === '' ? null : v])
      );
      const res = await fetch(`${API_URL}/api/v1/crm/personas/${fichaId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo guardar');
      }
      const actualizada = await res.json();
      setFicha(prev => ({ ...prev, ...actualizada }));
      setEditando(false);
      cargarPersonas();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  // Si viene una fila desde /buscar, muestra esas; si no, la tabla normal.
  const filasVisibles = resultadosBusqueda !== null ? resultadosBusqueda : personas;
  const esModoBusqueda = resultadosBusqueda !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Personas</h2>
        <button
          onClick={() => { setNuevaForm(PERSONA_INITIAL_FORM); setErrorForm(null); setMostrarNueva(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-medium"
        >
          <Icon name="plus" />
          Nueva persona
        </button>
      </div>

      <div className="relative max-w-md">
        <Icon name="magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, documento, email, teléfono..."
          className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Nombre y apellido</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Documento</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Celular</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Localidad</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Empresas</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Oport. abiertas</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {(loading || buscando) ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Cargando...</td></tr>
              ) : error ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-red-400">{error}</td></tr>
              ) : filasVisibles.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  {esModoBusqueda ? 'Sin resultados para la búsqueda' : 'No hay personas cargadas'}
                </td></tr>
              ) : (
                filasVisibles.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => abrirFicha(p.id)}
                    className="hover:bg-slate-700/30 transition cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-medium">{p.nombre} {p.apellido || ''}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{p.numero_documento || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{p.celular || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{p.email || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{p.localidad || '-'}</td>
                    <td className="px-4 py-3 text-sm text-center">{esModoBusqueda ? '—' : p.empresas_count}</td>
                    <td className="px-4 py-3 text-sm text-center">{esModoBusqueda ? '—' : p.oportunidades_abiertas_count}</td>
                    <td className="px-4 py-3">
                      {esModoBusqueda ? (
                        <span className="text-slate-500 text-sm">—</span>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          p.activo ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Nueva persona */}
      {mostrarNueva && (
        <Modal title="Nueva persona" onClose={() => setMostrarNueva(false)} maxWidth="max-w-3xl">
          <form onSubmit={crearPersona} className="space-y-6">
            <FieldForm sections={PERSONA_FIELD_SECTIONS} values={nuevaForm} onChange={setNuevaForm} />
            {errorForm && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
                {errorForm}
              </div>
            )}
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setMostrarNueva(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
              >
                {guardando ? 'Guardando...' : 'Crear persona'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Ficha 360 */}
      {fichaId && (
        <Modal
          title={fichaLoading ? 'Cargando...' : `${ficha?.nombre || ''} ${ficha?.apellido || ''}`}
          onClose={() => { setFichaId(null); setFicha(null); }}
          maxWidth="max-w-4xl"
        >
          {fichaLoading || !ficha ? (
            <p className="text-slate-400 text-center py-8">Cargando ficha...</p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-1 overflow-x-auto">
                  {FICHA_TABS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setFichaTab(t.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                        fichaTab === t.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {fichaTab === 'datos' && !editando && (
                  <button
                    onClick={() => setEditando(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
                  >
                    <Icon name="pencil-square" />
                    Editar
                  </button>
                )}
              </div>

              {fichaTab === 'datos' && (
                editando ? (
                  <form onSubmit={guardarEdicion} className="space-y-6">
                    <FieldForm sections={PERSONA_FIELD_SECTIONS} values={editForm} onChange={setEditForm} />
                    <div className="flex gap-4 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditando(false)}
                        className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={guardando}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
                      >
                        {guardando ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <Dato label="Token" valor={ficha.token} mono />
                    <Dato label="Documento" valor={`${ficha.tipo_documento || ''} ${ficha.numero_documento || ''}`.trim()} />
                    <Dato label="Fecha de nacimiento" valor={ficha.fecha_nacimiento} />
                    <Dato label="Ocupación" valor={ficha.ocupacion} />
                    <Dato label="Teléfono" valor={ficha.telefono} />
                    <Dato label="Celular" valor={ficha.celular} />
                    <Dato label="Email" valor={ficha.email} />
                    <Dato label="Email alternativo" valor={ficha.email_alt} />
                    <Dato label="Domicilio" valor={[ficha.calle, ficha.numero, ficha.localidad, ficha.provincia].filter(Boolean).join(', ')} full />
                    <Dato label="Origen" valor={ficha.origen} />
                    <Dato label="Score" valor={ficha.score} />
                    <Dato label="Notas" valor={ficha.notas} full />
                  </div>
                )
              )}

              {fichaTab === 'empresas' && (
                <ListaSimple
                  items={ficha.empresas}
                  vacio="Sin empresas vinculadas"
                  render={(e) => (
                    <>
                      <span className="font-medium">{e.razon_social}</span>
                      <span className="text-slate-400 text-sm ml-2">{e.rol}</span>
                      {e.es_decisor && <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">Decisor</span>}
                      {e.es_contacto_principal && <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs">Contacto principal</span>}
                    </>
                  )}
                />
              )}

              {fichaTab === 'oportunidades' && (
                <ListaSimple
                  items={ficha.oportunidades}
                  vacio="Sin oportunidades"
                  render={(o) => (
                    <>
                      <span className="font-mono text-xs text-blue-400">{o.token}</span>
                      <span className="ml-2 font-medium">{o.track}</span>
                      <span className="ml-2 px-2 py-0.5 bg-slate-600 rounded text-xs">{o.estado_crm}</span>
                      <span className="ml-2 px-2 py-0.5 bg-slate-600 rounded text-xs">{o.resultado}</span>
                    </>
                  )}
                />
              )}

              {fichaTab === 'polizas' && (
                <ListaSimple
                  items={ficha.polizas}
                  vacio="Sin pólizas"
                  render={(p) => (
                    <>
                      <span className="font-medium">Póliza {p.numero_poliza}</span>
                      <span className="text-slate-400 text-sm ml-2">{p.compania} · {p.ramo}</span>
                      <span className="ml-2 px-2 py-0.5 bg-slate-600 rounded text-xs">{p.estado}</span>
                    </>
                  )}
                />
              )}

              {fichaTab === 'actividad' && (
                <ListaSimple
                  items={ficha.interacciones}
                  vacio="Sin actividad registrada"
                  render={(i) => (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{i.asunto || i.canal}</span>
                        <span className="text-slate-500 text-xs">{new Date(i.fecha).toLocaleString('es-AR')}</span>
                      </div>
                      {i.resumen && <p className="text-slate-400 text-sm mt-1">{i.resumen}</p>}
                    </div>
                  )}
                />
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default PersonasPanel;
