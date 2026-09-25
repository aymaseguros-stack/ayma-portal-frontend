import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import {
  crearCredencial, crearHallazgo, editarHallazgo, historicoSalud,
  listarCredenciales, listarHallazgos, tomarSnapshotSalud,
} from './direccionApi';
import { ESTADOS_HALLAZGO, SEVERIDADES_HALLAZGO, SISTEMAS_HALLAZGO, etiqueta, fechaCorta } from './direccionConstantes';
import { useAccionManual } from './accionManual';
import ClavesWorker from './ClavesWorker';
import DireccionDiagnosticos from './DireccionDiagnosticos';
import SaludSistemaCard from './SaludSistemaCard';
import WhatsappSaludCard from './WhatsappSaludCard';
import {
  AvisoConflictoCodigo, Badge, Campo, Cargando, ErrorCarga, EstadoVacio, Panel, Tabla, botonPrimario, botonSecundario, inputClase,
} from './DireccionComunes';

const PESTANAS = [
  { id: 'hallazgos', label: 'Hallazgos' },
  { id: 'credenciales', label: 'Credenciales' },
  { id: 'salud', label: 'Salud' },
  { id: 'diagnosticos', label: 'Diagnósticos del sistema' },
];

// Pantalla 4: seguridad. Hallazgos, inventario de credenciales y salud.
//
// REGLA DEL MÓDULO, NO UN DETALLE DE ESTA PANTALLA: el inventario de
// credenciales NO tiene ni puede tener un campo para el valor del secreto.
// El backend contesta 422 si el cuerpo trae valor/secret/password/token/key
// (direccion.py::_rechazar_claves_prohibidas) y ninguna respuesta suya los
// devuelve. Acá se registra DÓNDE vive la credencial y CUÁNDO se rota, nada
// más. Verificado por DireccionSeguridad.test.jsx.
// `esAdmin`: App ya monta esta pantalla sólo para ADMIN; el bloque de claves
// de worker (COMPLIANCE-0003) lo vuelve a exigir por su cuenta.
const DireccionSeguridad = ({ token, esAdmin = false }) => {
  const [pestana, setPestana] = useState('hallazgos');
  const [criticos, setCriticos] = useState(null);
  const [errorCriticos, setErrorCriticos] = useState(null);

  // La métrica se recalcula al montar y cada vez que algo de hallazgos
  // cambia: `recargas` es el disparador (lo incrementa recargarCriticos).
  // El fetch vive dentro del efecto, con bandera de cancelado, para no
  // tocar estado sincrónicamente al montar.
  const [recargas, setRecargas] = useState(0);
  const recargarCriticos = useCallback(() => setRecargas((n) => n + 1), []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const abiertos = await listarHallazgos(token, { estado: 'ABIERTO' });
        if (cancelado) return;
        setCriticos(abiertos.filter((h) => h.severidad === 'CRITICO').length);
        setErrorCriticos(null);
      } catch (err) {
        if (cancelado) return;
        setCriticos(null);
        setErrorCriticos(err.message);
      }
    })();
    return () => { cancelado = true; };
  }, [token, recargas]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Seguridad</h2>
          <p className="text-slate-400 text-sm mt-1">Hallazgos, inventario de credenciales, salud y diagnósticos del sistema.</p>
        </div>
        {/* La métrica NUNCA muestra 0 cuando la consulta falló: dice que no se
            pudo medir. Un 0 ahí se lee como "no hay críticos abiertos". */}
        <div className={`px-4 py-2 rounded-lg border ${criticos ? 'bg-red-500/15 border-red-500/50' : 'bg-slate-800/60 border-slate-700'}`}>
          <p className="text-slate-400 text-xs">Críticos abiertos</p>
          {errorCriticos ? (
            <p className="text-red-300 text-sm font-semibold">Sin medir</p>
          ) : (
            <p className={`text-2xl font-bold ${criticos ? 'text-red-300' : 'text-white'}`}>
              {criticos === null ? '—' : criticos}
            </p>
          )}
        </div>
      </div>

      {errorCriticos && <ErrorCarga mensaje={errorCriticos} que="la métrica de hallazgos críticos" onReintentar={recargarCriticos} />}

      <nav className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1 w-fit max-w-full overflow-x-auto">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition ${
              pestana === p.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {pestana === 'hallazgos' && <PestanaHallazgos token={token} onCambio={recargarCriticos} />}
      {pestana === 'credenciales' && <PestanaCredenciales token={token} esAdmin={esAdmin} />}
      {pestana === 'salud' && <PestanaSalud token={token} />}
      {pestana === 'diagnosticos' && <DireccionDiagnosticos token={token} />}
    </div>
  );
};

const PestanaHallazgos = ({ token, onCambio }) => {
  const [estado, setEstado] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalAlta, setModalAlta] = useState(false);
  const [aCerrar, setACerrar] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listarHallazgos(token, { estado: estado || undefined })); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, estado]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <Campo label="Estado">
          <select className={inputClase + ' min-w-[160px]'} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_HALLAZGO.map((e) => <option key={e} value={e}>{etiqueta(e)}</option>)}
          </select>
        </Campo>
        <button className={botonPrimario + ' ml-auto'} onClick={() => setModalAlta(true)}>Nuevo hallazgo</button>
      </div>

      {error && !loading && <ErrorCarga mensaje={error} que="los hallazgos" onReintentar={cargar} />}

      <Panel>
        {loading ? <Cargando /> : error ? null : items.length === 0 ? (
          <EstadoVacio
            icono="shield-check"
            titulo={estado ? 'Ningún hallazgo con ese estado' : 'Todavía no hay hallazgos. Cargá el primero'}
            detalle="Cada hallazgo se cierra con el PR que lo arregla."
          />
        ) : (
          <Tabla columnas={['Código', 'Título', 'Severidad', 'Sistema', 'Estado', 'Detectado', 'PR de cierre', '']}>
            {items.map((h) => (
              <tr key={h.codigo} className={h.severidad === 'CRITICO' && h.estado === 'ABIERTO' ? 'bg-red-500/10' : ''}>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{h.codigo}</td>
                <td className="px-4 py-2.5 text-white">{h.titulo}</td>
                <td className="px-4 py-2.5"><Badge valor={h.severidad} /></td>
                <td className="px-4 py-2.5 text-slate-300">{h.sistema || '—'}</td>
                <td className="px-4 py-2.5"><Badge valor={h.estado} /></td>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fechaCorta(h.detectado_en)}</td>
                <td className="px-4 py-2.5">
                  {h.pr_cierre
                    ? <a href={h.pr_cierre} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200 text-xs break-all">{h.pr_cierre}</a>
                    : <span className="text-slate-500">—</span>}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {h.estado === 'ABIERTO' && (
                    <button className="text-blue-300 hover:text-blue-200 text-xs" onClick={() => setACerrar(h)}>
                      Cerrar con PR
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>

      {modalAlta && (
        <ModalHallazgo
          token={token}
          onCerrar={() => setModalAlta(false)}
          onGuardado={() => { setModalAlta(false); cargar(); onCambio(); }}
        />
      )}
      {aCerrar && (
        <ModalCerrarHallazgo
          token={token}
          hallazgo={aCerrar}
          onCerrar={() => setACerrar(null)}
          onGuardado={() => { setACerrar(null); cargar(); onCambio(); }}
        />
      )}
    </div>
  );
};

const ModalHallazgo = ({ token, onCerrar, onGuardado }) => {
  const [form, setForm] = useState({ codigo: '', titulo: '', severidad: 'MEDIO', sistema: '', evidencia: '' });
  const [error, setError] = useState(null);
  const [conflicto, setConflicto] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c) => (e) => setForm((f) => ({ ...f, [c]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null); setConflicto(null);
    try {
      await crearHallazgo(token, {
        titulo: form.titulo,
        severidad: form.severidad,
        sistema: form.sistema || null,
        evidencia: form.evidencia || null,
        ...(form.codigo ? { codigo: form.codigo } : {}),
      });
      onGuardado();
    } catch (err) {
      if (err.conflicto) setConflicto(err.conflicto);
      else setError(err.message);
    } finally { setGuardando(false); }
  };

  return (
    <Modal title="Nuevo hallazgo" onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <AvisoConflictoCodigo
          conflicto={conflicto}
          onUsarSugerido={(codigo) => { setForm((f) => ({ ...f, codigo })); setConflicto(null); }}
        />
        {error && <ErrorCarga mensaje={error} que="guardar el hallazgo" />}
        <Campo label="Código (opcional)" ayuda="Vacío = el backend asigna el siguiente libre.">
          <input className={inputClase} value={form.codigo} onChange={cambiar('codigo')} placeholder="Automático" />
        </Campo>
        <Campo label="Título">
          <input className={inputClase} value={form.titulo} onChange={cambiar('titulo')} required />
        </Campo>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Severidad">
            <select className={inputClase} value={form.severidad} onChange={cambiar('severidad')}>
              {SEVERIDADES_HALLAZGO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Campo>
          <Campo label="Sistema">
            <select className={inputClase} value={form.sistema} onChange={cambiar('sistema')}>
              <option value="">—</option>
              {SISTEMAS_HALLAZGO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Campo>
        </div>
        <Campo label="Evidencia" ayuda="Dónde se vio. No pegues secretos acá.">
          <textarea className={inputClase} rows={3} value={form.evidencia} onChange={cambiar('evidencia')} />
        </Campo>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Crear hallazgo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ModalCerrarHallazgo = ({ token, hallazgo, onCerrar, onGuardado }) => {
  const [pr, setPr] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null);
    try {
      await editarHallazgo(token, hallazgo.codigo, { estado: 'CERRADO', pr_cierre: pr });
      onGuardado();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  return (
    <Modal title={`Cerrar ${hallazgo.codigo}`} onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        {error && <ErrorCarga mensaje={error} que="cerrar el hallazgo" />}
        <p className="text-slate-300 text-sm">{hallazgo.titulo}</p>
        <Campo label="PR que lo cierra">
          <input className={inputClase} value={pr} onChange={(e) => setPr(e.target.value)} placeholder="https://github.com/..." required />
        </Campo>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Cerrar hallazgo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Inventario de credenciales. SIN campo para el valor del secreto: ni en la
// tabla ni en el alta. Ver el comentario de cabecera de este archivo.
const PestanaCredenciales = ({ token, esAdmin }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalAlta, setModalAlta] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listarCredenciales(token)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 flex items-start gap-3">
        <Icon name="lock-closed" size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-slate-300 text-sm">
          Esto es un <strong>inventario</strong>: registra dónde vive cada credencial y cuándo se rota.
          El valor del secreto no se guarda acá ni en el backend.
        </p>
      </div>

      <div className="flex justify-end">
        <button className={botonPrimario} onClick={() => setModalAlta(true)}>Nueva credencial</button>
      </div>

      {error && !loading && <ErrorCarga mensaje={error} que="el inventario de credenciales" onReintentar={cargar} />}

      <Panel>
        {loading ? <Cargando /> : error ? null : items.length === 0 ? (
          <EstadoVacio
            icono="lock-closed"
            titulo="Todavía no hay credenciales en el inventario. Cargá la primera"
            detalle="Nombre, ubicación y fechas de rotación."
          />
        ) : (
          <Tabla columnas={['Nombre', 'Ubicación', 'Última rotación', 'Próxima rotación', 'Lote', 'Expuesta']}>
            {items.map((c) => (
              <tr key={c.id} className={c.expuesta_en_transcript ? 'bg-red-500/10' : ''}>
                <td className="px-4 py-2.5 text-white">{c.nombre}</td>
                <td className="px-4 py-2.5 text-slate-300">{c.ubicacion || '—'}</td>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fechaCorta(c.ultima_rotacion)}</td>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fechaCorta(c.proxima_rotacion)}</td>
                <td className="px-4 py-2.5 text-slate-400">{c.lote || '—'}</td>
                <td className="px-4 py-2.5">
                  {c.expuesta_en_transcript
                    ? <span className="text-red-300 text-xs font-semibold">Sí — rotar</span>
                    : <span className="text-slate-500 text-xs">No</span>}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>

      {/* COMPLIANCE-0003 · H-71: las claves que usan los workers de datos. */}
      <div className="border-t border-slate-700 pt-6">
        <ClavesWorker token={token} esAdmin={esAdmin} />
      </div>

      {modalAlta && (
        <ModalCredencial token={token} onCerrar={() => setModalAlta(false)} onGuardado={() => { setModalAlta(false); cargar(); }} />
      )}
    </div>
  );
};

const ModalCredencial = ({ token, onCerrar, onGuardado }) => {
  const [form, setForm] = useState({ nombre: '', ubicacion: '', ultima_rotacion: '', proxima_rotacion: '', lote: '' });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c) => (e) => setForm((f) => ({ ...f, [c]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null);
    try {
      await crearCredencial(token, {
        nombre: form.nombre,
        ubicacion: form.ubicacion || null,
        ultima_rotacion: form.ultima_rotacion || null,
        proxima_rotacion: form.proxima_rotacion || null,
        lote: form.lote || null,
      });
      onGuardado();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  return (
    <Modal title="Nueva credencial (inventario)" onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        {error && <ErrorCarga mensaje={error} que="guardar la credencial" />}
        <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-3">
          <p className="text-yellow-100 text-xs">
            No hay campo para el valor del secreto, y no lo va a haber: el backend rechaza el alta si el
            cuerpo trae uno. Anotá dónde vive, no qué dice.
          </p>
        </div>
        <Campo label="Nombre">
          <input className={inputClase} value={form.nombre} onChange={cambiar('nombre')} required />
        </Campo>
        <Campo label="Ubicación" ayuda="Dónde vive: Render env, GitHub secret, vault, etc.">
          <input className={inputClase} value={form.ubicacion} onChange={cambiar('ubicacion')} />
        </Campo>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Última rotación">
            <input type="date" className={inputClase} value={form.ultima_rotacion} onChange={cambiar('ultima_rotacion')} />
          </Campo>
          <Campo label="Próxima rotación">
            <input type="date" className={inputClase} value={form.proxima_rotacion} onChange={cambiar('proxima_rotacion')} />
          </Campo>
        </div>
        <Campo label="Lote">
          <input className={inputClase} value={form.lote} onChange={cambiar('lote')} />
        </Campo>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Registrar credencial'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const PestanaSalud = ({ token }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // El snapshot ESCRIBE (POST /direccion/salud/snapshot), así que pasa por el
  // guardián de reentrada de H-66: `disabled={tomando}` llega un render tarde
  // y un doble clic tomaba dos mediciones del mismo instante.
  const { corriendo: tomando, correr } = useAccionManual();

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await historicoSalud(token, 30)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const snapshot = () => correr('snapshot', async () => {
    setError(null);
    try { await tomarSnapshotSalud(token); await cargar(); }
    catch (err) { setError(err.message); }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-slate-400 text-sm">Histórico de los últimos 30 días.</p>
        <button type="button" className={botonPrimario} onClick={snapshot} disabled={Boolean(tomando)}>
          {tomando ? 'Tomando…' : 'Tomar snapshot'}
        </button>
      </div>

      {error && !loading && <ErrorCarga mensaje={error} que="el histórico de salud" onReintentar={cargar} />}

      {/* C-4a3: el estado global en vivo, con DEGRADADO en ámbar y las
          señales degradadas aparte de las que están en alerta. */}
      <SaludSistemaCard token={token} />

      {/* C-4c: la integración de WhatsApp, con lo que falta configurar en rojo. */}
      <WhatsappSaludCard token={token} />

      <Panel>
        {loading ? <Cargando /> : error ? null : items.length === 0 ? (
          <EstadoVacio
            icono="chart-bar"
            titulo="Todavía no hay mediciones de salud"
            detalle="Tomá el primer snapshot para empezar el histórico."
          />
        ) : (
          <Tabla columnas={['Señal', 'Estado', 'Valor', 'Medido']}>
            {items.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2.5 text-white">{s.senal}</td>
                <td className="px-4 py-2.5"><Badge valor={s.estado} /></td>
                <td className="px-4 py-2.5 text-slate-300">{s.valor_texto || '—'}</td>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fechaCorta(s.medido_en)}</td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>
    </div>
  );
};

export default DireccionSeguridad;
