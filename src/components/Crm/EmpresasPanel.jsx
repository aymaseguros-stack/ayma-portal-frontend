import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import FieldForm from '../FieldForm';
import { EMPRESA_FIELD_SECTIONS, EMPRESA_INITIAL_FORM } from './empresaFields';
import { Dato, ListaSimple } from './FichaHelpers';
import { esCuitValido, formatearCuit } from '../../utils/cuit';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const FICHA_TABS = [
  { id: 'datos', label: 'Datos' },
  { id: 'contactos', label: 'Contactos' },
  { id: 'oportunidades', label: 'Oportunidades' },
  { id: 'polizas', label: 'Pólizas' },
  { id: 'actividad', label: 'Actividad' },
];

const ROLES = ['TITULAR', 'GERENTE', 'RRHH', 'CONTADOR', 'COMPRAS', 'OTRO'];

const EmpresasPanel = ({ token }) => {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [nuevaForm, setNuevaForm] = useState(EMPRESA_INITIAL_FORM);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);
  const [cuitInvalido, setCuitInvalido] = useState(false);

  const [fichaId, setFichaId] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [fichaLoading, setFichaLoading] = useState(false);
  const [fichaTab, setFichaTab] = useState('datos');
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState(EMPRESA_INITIAL_FORM);
  const [editCuitInvalido, setEditCuitInvalido] = useState(false);

  // Vincular persona
  const [mostrarVincular, setMostrarVincular] = useState(false);
  const [vincularQuery, setVincularQuery] = useState('');
  const [vincularResultados, setVincularResultados] = useState([]);
  const [buscandoPersona, setBuscandoPersona] = useState(false);
  const [personaElegida, setPersonaElegida] = useState(null);
  const [rolElegido, setRolElegido] = useState('TITULAR');
  const [esDecisor, setEsDecisor] = useState(false);
  const [esContactoPrincipal, setEsContactoPrincipal] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [errorVinculo, setErrorVinculo] = useState(null);

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => { cargarEmpresas(); }, []);

  useEffect(() => {
    if (!vincularQuery.trim()) { setVincularResultados([]); return; }
    setBuscandoPersona(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/crm/buscar?q=${encodeURIComponent(vincularQuery)}`, { headers });
        if (!res.ok) throw new Error('Error ' + res.status);
        const data = await res.json();
        setVincularResultados(data.personas || []);
      } catch (err) {
        console.error('Error buscando personas:', err);
        setVincularResultados([]);
      } finally {
        setBuscandoPersona(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [vincularQuery]);

  const cargarEmpresas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/empresas`, { headers });
      if (!res.ok) throw new Error('Error ' + res.status);
      setEmpresas(await res.json());
    } catch (err) {
      console.error('Error cargando empresas:', err);
      setError('No se pudieron cargar las empresas');
    } finally {
      setLoading(false);
    }
  };

  const handleCuitChange = (form, setForm, setInvalido) => (values) => {
    setForm(values);
    const cuit = values.cuit;
    if (!cuit || !cuit.trim()) { setInvalido(false); return; }
    setInvalido(!esCuitValido(cuit));
  };

  const crearEmpresa = async (e) => {
    e.preventDefault();
    if (!nuevaForm.razon_social?.trim()) {
      setErrorForm('La razón social es obligatoria');
      return;
    }
    if (nuevaForm.cuit && !esCuitValido(nuevaForm.cuit)) {
      setErrorForm('El CUIT ingresado no es válido (dígito verificador incorrecto)');
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(nuevaForm).map(([k, v]) => {
          if (k === 'cuit' && v) return [k, formatearCuit(v)];
          return [k, v === '' ? null : v];
        })
      );
      const res = await fetch(`${API_URL}/api/v1/crm/empresas`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo crear la empresa');
      }
      const creada = await res.json();
      setMostrarNueva(false);
      setNuevaForm(EMPRESA_INITIAL_FORM);
      cargarEmpresas();
      abrirFicha(creada.id);
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  // Trae (o refresca) la ficha sin tocar la pestaña/edición actual.
  const cargarFicha = async (id) => {
    const res = await fetch(`${API_URL}/api/v1/crm/empresas/${id}/ficha`, { headers });
    if (!res.ok) throw new Error('Error ' + res.status);
    const data = await res.json();
    setFicha(data);
    setEditForm({ ...EMPRESA_INITIAL_FORM, ...data });
    return data;
  };

  const abrirFicha = async (id) => {
    setFichaId(id);
    setFichaTab('datos');
    setEditando(false);
    setEditCuitInvalido(false);
    setFichaLoading(true);
    try {
      await cargarFicha(id);
    } catch (err) {
      console.error('Error cargando ficha:', err);
      alert('No se pudo cargar la ficha de la empresa');
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
    if (editForm.cuit && !esCuitValido(editForm.cuit)) {
      alert('El CUIT ingresado no es válido (dígito verificador incorrecto)');
      return;
    }
    setGuardando(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(editForm)
          .filter(([k]) => EMPRESA_FIELD_SECTIONS.some(s => s.campos.some(c => c.name === k)))
          .map(([k, v]) => {
            if (k === 'cuit' && v) return [k, formatearCuit(v)];
            return [k, v === '' ? null : v];
          })
      );
      const res = await fetch(`${API_URL}/api/v1/crm/empresas/${fichaId}`, {
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
      cargarEmpresas();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirVincular = () => {
    setVincularQuery('');
    setVincularResultados([]);
    setPersonaElegida(null);
    setRolElegido('TITULAR');
    setEsDecisor(false);
    setEsContactoPrincipal(false);
    setErrorVinculo(null);
    setMostrarVincular(true);
  };

  const vincularPersona = async (e) => {
    e.preventDefault();
    if (!personaElegida) {
      setErrorVinculo('Elegí una persona para vincular');
      return;
    }
    setVinculando(true);
    setErrorVinculo(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/vinculos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          persona_id: personaElegida.id,
          empresa_id: fichaId,
          rol: rolElegido,
          es_decisor: esDecisor,
          es_contacto_principal: esContactoPrincipal,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'No se pudo vincular la persona');
      }
      setMostrarVincular(false);
      await refrescarFichaActual();
      cargarEmpresas();
    } catch (err) {
      setErrorVinculo(err.message);
    } finally {
      setVinculando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Empresas</h2>
        <button
          onClick={() => { setNuevaForm(EMPRESA_INITIAL_FORM); setErrorForm(null); setCuitInvalido(false); setMostrarNueva(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-medium"
        >
          <Icon name="plus" />
          Nueva empresa
        </button>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Razón social</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">CUIT</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">CIIU</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Empleados</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Localidad</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Contactos</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Oport. abiertas</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Cargando...</td></tr>
              ) : error ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-red-400">{error}</td></tr>
              ) : empresas.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No hay empresas cargadas</td></tr>
              ) : (
                empresas.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => abrirFicha(emp.id)}
                    className="hover:bg-slate-700/30 transition cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-medium">{emp.razon_social}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{emp.cuit || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{emp.ciiu_codigo || '-'}</td>
                    <td className="px-4 py-3 text-sm text-center">{emp.cantidad_empleados ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{emp.domicilio_fiscal_localidad || '-'}</td>
                    <td className="px-4 py-3 text-sm text-center">{emp.contactos_count}</td>
                    <td className="px-4 py-3 text-sm text-center">{emp.oportunidades_abiertas_count}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        emp.activo ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {emp.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Nueva empresa */}
      {mostrarNueva && (
        <Modal title="Nueva empresa" onClose={() => setMostrarNueva(false)} maxWidth="max-w-3xl">
          <form onSubmit={crearEmpresa} className="space-y-6">
            <FieldForm
              sections={EMPRESA_FIELD_SECTIONS}
              values={nuevaForm}
              onChange={handleCuitChange(nuevaForm, setNuevaForm, setCuitInvalido)}
              errors={cuitInvalido ? { cuit: 'CUIT inválido (dígito verificador incorrecto)' } : {}}
            />
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
                disabled={guardando || cuitInvalido}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
              >
                {guardando ? 'Guardando...' : 'Crear empresa'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Ficha 360 */}
      {fichaId && (
        <Modal
          title={fichaLoading ? 'Cargando...' : ficha?.razon_social || ''}
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
                {fichaTab === 'contactos' && (
                  <button
                    onClick={abrirVincular}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
                  >
                    <Icon name="link" />
                    Vincular persona
                  </button>
                )}
              </div>

              {fichaTab === 'datos' && (
                editando ? (
                  <form onSubmit={guardarEdicion} className="space-y-6">
                    <FieldForm
                      sections={EMPRESA_FIELD_SECTIONS}
                      values={editForm}
                      onChange={handleCuitChange(editForm, setEditForm, setEditCuitInvalido)}
                      errors={editCuitInvalido ? { cuit: 'CUIT inválido (dígito verificador incorrecto)' } : {}}
                    />
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
                        disabled={guardando || editCuitInvalido}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
                      >
                        {guardando ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <Dato label="Token" valor={ficha.token} mono />
                    <Dato label="Nombre de fantasía" valor={ficha.nombre_fantasia} />
                    <Dato label="CUIT" valor={ficha.cuit} />
                    <Dato label="Condición IVA" valor={ficha.condicion_iva} />
                    <Dato label="CIIU" valor={ficha.ciiu_codigo ? `${ficha.ciiu_codigo} - ${ficha.ciiu_descripcion || ''}` : null} />
                    <Dato label="Empleados" valor={ficha.cantidad_empleados} />
                    <Dato label="Facturación anual estimada" valor={ficha.facturacion_anual_estimada} />
                    <Dato label="Domicilio fiscal" valor={[ficha.domicilio_fiscal_calle, ficha.domicilio_fiscal_numero, ficha.domicilio_fiscal_localidad, ficha.domicilio_fiscal_provincia].filter(Boolean).join(', ')} full />
                    <Dato label="Teléfono" valor={ficha.telefono} />
                    <Dato label="Email" valor={ficha.email} />
                    <Dato label="Web" valor={ficha.web} />
                    <Dato label="Origen" valor={ficha.origen} />
                    <Dato label="Notas" valor={ficha.notas} full />
                  </div>
                )
              )}

              {fichaTab === 'contactos' && (
                <ListaSimple
                  items={ficha.personas}
                  vacio="Sin contactos vinculados"
                  render={(p) => (
                    <>
                      <span className="font-medium">{p.nombre} {p.apellido || ''}</span>
                      <span className="text-slate-400 text-sm ml-2">{p.rol}</span>
                      {p.cargo_detalle && <span className="text-slate-500 text-sm ml-2">({p.cargo_detalle})</span>}
                      {p.es_decisor && <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">Decisor</span>}
                      {p.es_contacto_principal && <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-xs">Contacto principal</span>}
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

      {/* Modal: Vincular persona */}
      {mostrarVincular && (
        <Modal title="Vincular persona" onClose={() => setMostrarVincular(false)} maxWidth="max-w-lg">
          <form onSubmit={vincularPersona} className="space-y-5">
            <div>
              <label className="block text-slate-400 text-sm mb-2">Buscar persona</label>
              <div className="relative">
                <Icon name="magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={vincularQuery}
                  onChange={(e) => { setVincularQuery(e.target.value); setPersonaElegida(null); }}
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
              ) : vincularQuery.trim() && (
                <div className="mt-2 max-h-48 overflow-y-auto border border-slate-700 rounded-lg divide-y divide-slate-700">
                  {buscandoPersona ? (
                    <p className="text-slate-500 text-sm p-3">Buscando...</p>
                  ) : vincularResultados.length === 0 ? (
                    <p className="text-slate-500 text-sm p-3">Sin resultados</p>
                  ) : (
                    vincularResultados.map((p) => (
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
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition">
                <input type="checkbox" checked={esDecisor} onChange={(e) => setEsDecisor(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-sm">Es decisor</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50 transition">
                <input type="checkbox" checked={esContactoPrincipal} onChange={(e) => setEsContactoPrincipal(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-sm">Contacto principal</span>
              </label>
            </div>

            {errorVinculo && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
                {errorVinculo}
              </div>
            )}

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setMostrarVincular(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={vinculando}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
              >
                {vinculando ? 'Vinculando...' : 'Vincular'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default EmpresasPanel;
