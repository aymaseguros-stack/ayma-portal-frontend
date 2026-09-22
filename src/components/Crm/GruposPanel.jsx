import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import FieldForm from '../FieldForm';
import {
  TIPO_GRUPO_OPCIONES, seccionesGrupoParaTipos, formularioGrupoInicial,
} from './grupoFields';
import { Dato, ListaSimple } from './FichaHelpers';
import { normalizeList, formatApiError, authHeader } from '../../utils/api';
import NuevaOportunidadModal from './NuevaOportunidadModal';
import OportunidadFichaModal from './OportunidadFichaModal';
import OfertasSugeridas from './OfertasSugeridas';
import Timeline from './Timeline';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const FICHA_TABS = [
  { id: 'datos', label: 'Datos' },
  { id: 'miembros', label: 'Miembros' },
  { id: 'cartera', label: 'Cartera' },
  { id: 'oportunidades', label: 'Oportunidades' },
  { id: 'actividad', label: 'Actividad' },
];

const ROLES_MIEMBRO = ['TITULAR_PRINCIPAL', 'CONYUGE', 'HIJO', 'FAMILIAR', 'MIEMBRO', 'OTRO'];

const tipoLabel = (tipo) => TIPO_GRUPO_OPCIONES.find(o => o.value === tipo)?.label || tipo || '-';

const formatMoneda = (valor) => {
  if (valor === null || valor === undefined || valor === '') return '-';
  const numero = Number(valor);
  if (Number.isNaN(numero)) return valor;
  return numero.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
};

// Vista genérica de Grupos, parametrizada por `tipos`: se reutiliza tanto
// para "Grupos" (FAMILIAR) como para "Grupos Empresariales" (CONSORCIO,
// FLOTA, SOCIEDAD_HECHO) sin duplicar el componente.
const GruposPanel = ({
  token, tipos, titulo = 'Grupos', tipoDefault, abrirFichaIdInicial, onFichaAbierta, encabezado,
}) => {
  const tipoInicial = tipoDefault || tipos[0];
  const secciones = useMemo(() => seccionesGrupoParaTipos(tipos), [tipos]);

  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [nuevaForm, setNuevaForm] = useState(() => formularioGrupoInicial(tipoInicial));
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);

  const [fichaId, setFichaId] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [fichaLoading, setFichaLoading] = useState(false);
  const [fichaTab, setFichaTab] = useState('datos');
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState(() => formularioGrupoInicial());

  // Agregar miembro
  const [mostrarAgregar, setMostrarAgregar] = useState(false);
  const [buscarQuery, setBuscarQuery] = useState('');
  const [buscarResultados, setBuscarResultados] = useState([]);
  const [buscandoPersona, setBuscandoPersona] = useState(false);
  const [personaElegida, setPersonaElegida] = useState(null);
  const [rolElegido, setRolElegido] = useState('MIEMBRO');
  const [esDecisor, setEsDecisor] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [errorAgregar, setErrorAgregar] = useState(null);

  const [mostrarNuevaOportunidad, setMostrarNuevaOportunidad] = useState(false);
  const [trackPreseleccionado, setTrackPreseleccionado] = useState(null);
  const [oportunidadAbierta, setOportunidadAbierta] = useState(null);

  const headers = { ...authHeader(token), 'Content-Type': 'application/json' };

  useEffect(() => { cargarGrupos(); }, []);

  // Navegación directa desde la ficha de Persona ("ver grupo")
  useEffect(() => {
    if (abrirFichaIdInicial) {
      abrirFicha(abrirFichaIdInicial);
      onFichaAbierta?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirFichaIdInicial]);

  useEffect(() => {
    if (!buscarQuery.trim()) { setBuscarResultados([]); return; }
    setBuscandoPersona(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/crm/buscar?q=${encodeURIComponent(buscarQuery)}`, { headers });
        if (!res.ok) throw new Error('Error ' + res.status);
        const data = await res.json();
        setBuscarResultados(data.personas || []);
      } catch (err) {
        console.error('Error buscando personas:', err);
        setBuscarResultados([]);
      } finally {
        setBuscandoPersona(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [buscarQuery]);

  const cargarGrupos = async () => {
    setLoading(true);
    setError(null);
    try {
      // El backend solo filtra por un tipo exacto (?tipo=X); para vistas con
      // varios tipos (Grupos Empresariales) se trae todo y se filtra acá.
      const url = tipos.length === 1
        ? `${API_URL}/api/v1/crm/grupos?tipo=${tipos[0]}`
        : `${API_URL}/api/v1/crm/grupos?limit=200`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(await formatApiError(res));
      const items = normalizeList(await res.json()).items;
      setGrupos(tipos.length === 1 ? items : items.filter(g => tipos.includes(g.tipo)));
    } catch (err) {
      console.error('Error cargando grupos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const crearGrupo = async (e) => {
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
      const res = await fetch(`${API_URL}/api/v1/crm/grupos`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo crear el grupo');
      }
      const creado = await res.json();
      setMostrarNueva(false);
      setNuevaForm(formularioGrupoInicial(tipoInicial));
      cargarGrupos();
      abrirFicha(creado.id);
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  // Trae (o refresca) la ficha sin tocar la pestaña/edición actual.
  const cargarFicha = async (id) => {
    const res = await fetch(`${API_URL}/api/v1/crm/grupos/${id}/ficha`, { headers });
    if (!res.ok) throw new Error('Error ' + res.status);
    const data = await res.json();
    setFicha(data);
    setEditForm({ ...formularioGrupoInicial(), ...data });
    return data;
  };

  const abrirFicha = async (id) => {
    setFichaId(id);
    setFichaTab('datos');
    setEditando(false);
    setFichaLoading(true);
    try {
      await cargarFicha(id);
    } catch (err) {
      console.error('Error cargando ficha:', err);
      alert('No se pudo cargar la ficha del grupo');
      setFichaId(null);
    } finally {
      setFichaLoading(false);
    }
  };

  const refrescarFichaActual = async () => {
    if (!fichaId) return;
    try {
      await cargarFicha(fichaId);
    } catch (err) {
      console.error('Error refrescando ficha:', err);
    }
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(editForm)
          .filter(([k]) => secciones.some(s => s.campos.some(c => c.name === k)))
          .map(([k, v]) => [k, v === '' ? null : v])
      );
      const res = await fetch(`${API_URL}/api/v1/crm/grupos/${fichaId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo guardar');
      }
      const actualizado = await res.json();
      setFicha(prev => ({ ...prev, ...actualizado }));
      setEditando(false);
      cargarGrupos();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirAgregarMiembro = () => {
    setBuscarQuery('');
    setBuscarResultados([]);
    setPersonaElegida(null);
    setRolElegido('MIEMBRO');
    setEsDecisor(false);
    setErrorAgregar(null);
    setMostrarAgregar(true);
  };

  const agregarMiembro = async (e) => {
    e.preventDefault();
    if (!personaElegida) {
      setErrorAgregar('Elegí una persona para agregar');
      return;
    }
    setAgregando(true);
    setErrorAgregar(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/grupos/${fichaId}/miembros`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          persona_id: personaElegida.id,
          rol: rolElegido,
          es_decisor: esDecisor,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo agregar el miembro');
      }
      setMostrarAgregar(false);
      await refrescarFichaActual();
      cargarGrupos();
    } catch (err) {
      setErrorAgregar(err.message);
    } finally {
      setAgregando(false);
    }
  };

  const abrirNuevoGrupo = () => {
    setNuevaForm(formularioGrupoInicial(tipoInicial));
    setErrorForm(null);
    setMostrarNueva(true);
  };

  return (
    <div className="space-y-6">
      {/* Personas y Empresas embeben este panel como sub-pestaña (Grupos
          familiares / Grupos empresariales) y ya traen su propio título +
          switcher de sub-pestañas; `encabezado` les permite reemplazar esta
          fila por la suya sin duplicar la lógica de alta de grupo. */}
      {encabezado ? encabezado(abrirNuevoGrupo) : (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">{titulo}</h2>
          <button
            onClick={abrirNuevoGrupo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-medium"
          >
            <Icon name="plus" />
            Nuevo grupo
          </button>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Tipo</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Miembros</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Vehículos</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Pólizas vigentes</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Prima anual total</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Localidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Cargando...</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-red-400">{error}</td></tr>
              ) : grupos.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No hay grupos cargados</td></tr>
              ) : (
                grupos.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => abrirFicha(g.id)}
                    className="hover:bg-slate-700/30 transition cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-medium">{g.nombre}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{tipoLabel(g.tipo)}</td>
                    <td className="px-4 py-3 text-sm text-center">{g.miembros_count}</td>
                    <td className="px-4 py-3 text-sm text-center">{g.vehiculos_count}</td>
                    <td className="px-4 py-3 text-sm text-center">{g.polizas_vigentes_count}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatMoneda(g.prima_anual_total)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{g.localidad || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Nuevo grupo */}
      {mostrarNueva && (
        <Modal title="Nuevo grupo" onClose={() => setMostrarNueva(false)} maxWidth="max-w-3xl">
          <form onSubmit={crearGrupo} className="space-y-6">
            <FieldForm sections={secciones} values={nuevaForm} onChange={setNuevaForm} />
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
                {guardando ? 'Guardando...' : 'Crear grupo'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Ficha 360 */}
      {fichaId && (
        <Modal
          title={fichaLoading ? 'Cargando...' : ficha?.nombre || ''}
          onClose={() => { setFichaId(null); setFicha(null); }}
          maxWidth="max-w-4xl"
        >
          {fichaLoading || !ficha ? (
            <p className="text-slate-400 text-center py-8">Cargando ficha...</p>
          ) : (
            <div className="space-y-6">
              {/* Alertas: la razón de existir de esta vista. Oportunidades que se
                  pierden al mirar personas sueltas, así que van arriba de todo. */}
              {ficha.alertas && ficha.alertas.length > 0 && (
                <div className="bg-orange-500/15 border border-orange-500/50 rounded-lg p-4 space-y-2">
                  {ficha.alertas.map((a, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-orange-200 text-sm">
                      <Icon name="exclamation-triangle" className="text-orange-400 shrink-0 mt-0.5" />
                      <span>{typeof a === 'string' ? a : a.mensaje}</span>
                    </div>
                  ))}
                </div>
              )}

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
                {fichaTab === 'miembros' && (
                  <button
                    onClick={abrirAgregarMiembro}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
                  >
                    <Icon name="link" />
                    Agregar miembro
                  </button>
                )}
                {fichaTab === 'oportunidades' && (
                  <button
                    onClick={() => { setTrackPreseleccionado(null); setMostrarNuevaOportunidad(true); }}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
                  >
                    <Icon name="plus" />
                    Nueva oportunidad
                  </button>
                )}
              </div>

              {fichaTab === 'datos' && (
                editando ? (
                  <form onSubmit={guardarEdicion} className="space-y-6">
                    <FieldForm sections={secciones} values={editForm} onChange={setEditForm} />
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
                    <Dato label="Tipo" valor={tipoLabel(ficha.tipo)} />
                    <Dato label="Localidad" valor={ficha.localidad} />
                    <Dato label="Notas" valor={ficha.notas} full />
                  </div>
                )
              )}

              {fichaTab === 'miembros' && (
                <ListaSimple
                  items={ficha.miembros}
                  vacio="Sin miembros en el grupo"
                  render={(m) => (
                    <>
                      <span className="font-medium">{m.nombre} {m.apellido || ''}</span>
                      <span className="text-slate-400 text-sm ml-2">{m.rol}</span>
                      {m.rol === 'TITULAR_PRINCIPAL' && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">Titular principal</span>
                      )}
                      {m.es_decisor && (
                        <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs">Decisor</span>
                      )}
                    </>
                  )}
                />
              )}

              {fichaTab === 'cartera' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                      <p className="text-slate-500 text-xs uppercase tracking-wide">Vehículos</p>
                      <p className="text-2xl font-bold mt-1">{ficha.vehiculos?.length ?? 0}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                      <p className="text-slate-500 text-xs uppercase tracking-wide">Pólizas vigentes</p>
                      <p className="text-2xl font-bold mt-1">
                        {ficha.polizas?.filter(p => p.estado === 'VIGENTE').length ?? ficha.polizas?.length ?? 0}
                      </p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-4 text-center">
                      <p className="text-slate-500 text-xs uppercase tracking-wide">Prima anual total</p>
                      <p className="text-2xl font-bold mt-1">{formatMoneda(ficha.prima_anual_total)}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Vehículos</h4>
                    <ListaSimple
                      items={ficha.vehiculos}
                      vacio="Sin vehículos registrados"
                      render={(v) => (
                        <>
                          <span className="font-medium">{v.marca} {v.modelo}</span>
                          {v.anio && <span className="text-slate-400 text-sm ml-2">{v.anio}</span>}
                          {v.patente && <span className="text-slate-500 text-sm ml-2">{v.patente}</span>}
                        </>
                      )}
                    />
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Pólizas</h4>
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
                  </div>
                </div>
              )}

              {fichaTab === 'oportunidades' && (
                <div className="space-y-6">
                  <ListaSimple
                    items={ficha.oportunidades}
                    vacio="Sin oportunidades"
                    render={(o) => (
                      <button type="button" onClick={() => setOportunidadAbierta(o.id)} className="w-full text-left">
                        <span className="font-mono text-xs text-blue-400">{o.token}</span>
                        <span className="ml-2 font-medium">{o.track}</span>
                        <span className="ml-2 px-2 py-0.5 bg-slate-600 rounded text-xs">{o.estado_crm}</span>
                        <span className="ml-2 px-2 py-0.5 bg-slate-600 rounded text-xs">{o.resultado}</span>
                      </button>
                    )}
                  />

                  <OfertasSugeridas
                    token={token}
                    tipo="grupo"
                    id={ficha.id}
                    ofertas={ficha.ofertas_sugeridas}
                    onOportunidadCreada={async (creada) => { await refrescarFichaActual(); setOportunidadAbierta(creada.id); }}
                    onVerOportunidad={setOportunidadAbierta}
                  />
                </div>
              )}

              {fichaTab === 'actividad' && (
                <Timeline token={token} tipo="grupo" id={ficha.id} />
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Modal: Agregar miembro */}
      {mostrarAgregar && (
        <Modal title="Agregar miembro" onClose={() => setMostrarAgregar(false)} maxWidth="max-w-lg">
          <form onSubmit={agregarMiembro} className="space-y-5">
            <div>
              <label className="block text-slate-400 text-sm mb-2">Buscar persona</label>
              <div className="relative">
                <Icon name="magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={buscarQuery}
                  onChange={(e) => { setBuscarQuery(e.target.value); setPersonaElegida(null); }}
                  placeholder="Nombre, documento, email..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {personaElegida ? (
                <div className="mt-2 flex items-center justify-between bg-blue-600/20 border border-blue-500/40 rounded-lg px-3 py-2">
                  <span className="text-sm">{personaElegida.nombre} {personaElegida.apellido || ''}</span>
                  <button type="button" onClick={() => setPersonaElegida(null)} className="text-slate-400 hover:text-white">
                    <Icon name="x-mark" size={14} />
                  </button>
                </div>
              ) : buscarQuery.trim() && (
                <div className="mt-2 max-h-48 overflow-y-auto border border-slate-700 rounded-lg divide-y divide-slate-700">
                  {buscandoPersona ? (
                    <p className="text-slate-500 text-sm p-3">Buscando...</p>
                  ) : buscarResultados.length === 0 ? (
                    <p className="text-slate-500 text-sm p-3">Sin resultados</p>
                  ) : (
                    buscarResultados.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setPersonaElegida(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700/60 transition"
                      >
                        <span className="font-medium">{p.nombre} {p.apellido || ''}</span>
                        <span className="text-slate-500 ml-2 text-xs">{p.email || p.numero_documento || ''}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-2">Rol</label>
              <select
                value={rolElegido}
                onChange={(e) => setRolElegido(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
              >
                {ROLES_MIEMBRO.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition">
              <input type="checkbox" checked={esDecisor} onChange={(e) => setEsDecisor(e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm">Es decisor</span>
            </label>

            {errorAgregar && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
                {errorAgregar}
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setMostrarAgregar(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={agregando}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
              >
                {agregando ? 'Agregando...' : 'Agregar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {mostrarNuevaOportunidad && ficha && (
        <NuevaOportunidadModal
          token={token}
          preset={{ grupo_id: ficha.id, nombre: ficha.nombre, track: trackPreseleccionado }}
          onClose={() => setMostrarNuevaOportunidad(false)}
          onCreated={async () => { setMostrarNuevaOportunidad(false); await refrescarFichaActual(); cargarGrupos(); }}
        />
      )}

      {oportunidadAbierta && (
        <OportunidadFichaModal
          token={token}
          oportunidadId={oportunidadAbierta}
          onClose={() => setOportunidadAbierta(null)}
          onChanged={refrescarFichaActual}
        />
      )}
    </div>
  );
};

export default GruposPanel;
