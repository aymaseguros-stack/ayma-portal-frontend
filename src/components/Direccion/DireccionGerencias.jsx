import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import {
  crearDecision, crearFrente, derivarFrente, editarDecision, editarFrente,
  listarEventosFrente, listarGerencias, obtenerFichaGerencia,
} from './direccionApi';
import { EJECUTORES_FRENTE, ESTADOS_FRENTE, etiqueta, fechaCorta } from './direccionConstantes';
import {
  AvisoConflictoCodigo, Badge, Campo, Cargando, ChipSemaforo, ErrorCarga, EstadoVacio, Panel, PuntoSemaforo, Tabla, botonPrimario, botonSecundario, inputClase,
} from './DireccionComunes';

// Pantalla 2: listado de gerencias y ficha de cada una (cabecera, frentes,
// decisiones, workers y documentos). GET /direccion/gerencias y
// GET /direccion/gerencias/{codigo} (FichaGerencia).
const DireccionGerencias = ({ token, codigoAbierto, onAbrirGerencia, onCerrarFicha }) => {
  if (codigoAbierto) {
    return <FichaGerencia token={token} codigo={codigoAbierto} onVolver={onCerrarFicha} />;
  }
  return <ListadoGerencias token={token} onAbrir={onAbrirGerencia} />;
};

const ListadoGerencias = ({ token, onAbrir }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listarGerencias(token)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Gerencias</h2>
        <p className="text-slate-400 text-sm mt-1">Abrí una gerencia para ver sus frentes, decisiones, workers y documentos.</p>
      </div>

      {error && !loading && <ErrorCarga mensaje={error} que="las gerencias" onReintentar={cargar} />}

      {loading ? (
        <Cargando texto="Cargando gerencias…" />
      ) : !error && items.length === 0 ? (
        <Panel>
          <EstadoVacio
            icono="building-office"
            titulo="Todavía no hay gerencias"
            detalle="El módulo se inicializa con la semilla de gerencias del backend."
          />
        </Panel>
      ) : !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((g) => (
            <button
              key={g.codigo}
              type="button"
              onClick={() => onAbrir(g.codigo)}
              className="text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/60 rounded-xl p-4 transition"
            >
              <p className="text-xs text-slate-500">{g.codigo} · prefijo {g.prefijo_ids}</p>
              <p className="font-semibold text-white mt-0.5">{g.nombre}</p>
              <p className="text-slate-400 text-xs mt-2">
                Titular: {g.worker_titular || '—'}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const FichaGerencia = ({ token, codigo, onVolver }) => {
  const [ficha, setFicha] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // 'frente' | 'decision' | {tipo:'eventos'|'derivar'|'cerrarDecision', ...}

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try { setFicha(await obtenerFichaGerencia(token, codigo)); }
    catch (err) { setError(err.message); setFicha(null); }
    finally { setLoading(false); }
  }, [token, codigo]);

  useEffect(() => { cargar(); }, [cargar]);

  const trasGuardar = () => { setModal(null); cargar(); };

  const cambiarEstadoFrente = async (frente, estado) => {
    try {
      await editarFrente(token, frente.codigo, { estado });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onVolver} className={botonSecundario + ' flex items-center gap-2'}>
            <Icon name="arrow-left" size={16} /> Gerencias
          </button>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{codigo}</p>
            <h2 className="text-2xl font-bold truncate">{ficha?.gerencia?.nombre || codigo}</h2>
          </div>
        </div>
        {ficha && <ChipSemaforo color={ficha.semaforo} />}
      </div>

      {error && <ErrorCarga mensaje={error} que="la ficha de la gerencia" onReintentar={cargar} />}
      {loading && !ficha && <Cargando texto="Cargando la ficha…" />}

      {ficha && (
        <>
          {(ficha.motivos || []).length > 0 && (
            <Panel titulo="Por qué está así">
              <ul className="p-4 space-y-1">
                {ficha.motivos.map((m, i) => (
                  <li key={i} className="text-slate-300 text-sm">• {m}</li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel
            titulo="Frentes"
            acciones={
              <button className={botonPrimario} onClick={() => setModal({ tipo: 'frente' })}>
                Nuevo frente
              </button>
            }
          >
            {(ficha.frentes || []).length === 0 ? (
              <EstadoVacio titulo="Todavía no hay frentes en esta gerencia" detalle="Cargá el primero." />
            ) : (
              <Tabla columnas={['Código', 'Título', 'Estado', 'Responsable', 'Ejecutor', 'Prioridad', '']}>
                {ficha.frentes.map((f) => (
                  <tr key={f.codigo}>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{f.codigo}</td>
                    <td className="px-4 py-2.5 text-white">{f.titulo}</td>
                    <td className="px-4 py-2.5">
                      <select
                        aria-label={`Estado del frente ${f.codigo}`}
                        value={f.estado}
                        onChange={(e) => cambiarEstadoFrente(f, e.target.value)}
                        className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-600 text-white text-xs"
                      >
                        {ESTADOS_FRENTE.map((e) => <option key={e} value={e}>{etiqueta(e)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{f.responsable || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{f.ejecutor || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-300">{f.prioridad}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <button
                        className="text-blue-300 hover:text-blue-200 text-xs mr-3"
                        onClick={() => setModal({ tipo: 'derivar', frente: f })}
                      >
                        Derivar
                      </button>
                      <button
                        className="text-slate-300 hover:text-white text-xs"
                        onClick={() => setModal({ tipo: 'eventos', frente: f })}
                      >
                        Ver eventos
                      </button>
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
          </Panel>

          <Panel
            titulo="Decisiones"
            acciones={
              <button className={botonPrimario} onClick={() => setModal({ tipo: 'decision' })}>
                Nueva decisión
              </button>
            }
          >
            {(ficha.decisiones || []).length === 0 ? (
              <EstadoVacio titulo="Todavía no hay decisiones en esta gerencia" detalle="Cargá la primera." icono="chat-bubble" />
            ) : (
              <Tabla columnas={['Código', 'Pregunta', 'Recomendación', 'Estado', 'Creada', '']}>
                {ficha.decisiones.map((d) => (
                  <tr key={d.codigo}>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{d.codigo}</td>
                    <td className="px-4 py-2.5 text-white">{d.pregunta}</td>
                    <td className="px-4 py-2.5 text-slate-300">{d.recomendacion || '—'}</td>
                    <td className="px-4 py-2.5"><Badge valor={d.estado} /></td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fechaCorta(d.creada_en)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {d.estado === 'ABIERTA' && (
                        <button
                          className="text-blue-300 hover:text-blue-200 text-xs"
                          onClick={() => setModal({ tipo: 'cerrarDecision', decision: d })}
                        >
                          Cerrar con resolución
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
          </Panel>

          <Panel titulo="Workers">
            {(ficha.workers || []).length === 0 ? (
              <EstadoVacio titulo="Todavía no hay workers en esta gerencia" detalle="El padrón de automatizaciones está vacío." />
            ) : (
              <Tabla columnas={['Código', 'Función', 'Runtime', 'Autonomía', 'Estado', 'Última ejecución']}>
                {ficha.workers.map((w) => (
                  <tr key={w.codigo}>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{w.codigo}</td>
                    <td className="px-4 py-2.5 text-white">{w.funcion || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-300">{w.runtime || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-300">{w.nivel_autonomia || '—'}</td>
                    <td className="px-4 py-2.5"><Badge valor={w.estado} /></td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fechaCorta(w.ultima_ejecucion)}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </Panel>

          <Panel titulo="Documentos">
            {(ficha.documentos || []).length === 0 ? (
              <EstadoVacio titulo="Todavía no hay documentos en esta gerencia" detalle="Bitácora, rector y especificaciones se enlazan desde el backend." />
            ) : (
              <Tabla columnas={['Nombre', 'Rol', 'Versión', 'Enlace']}>
                {ficha.documentos.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-4 py-2.5 text-white">{doc.nombre}</td>
                    <td className="px-4 py-2.5"><Badge valor={doc.rol} /></td>
                    <td className="px-4 py-2.5 text-slate-300">{doc.version || '—'}</td>
                    <td className="px-4 py-2.5">
                      {doc.url_drive ? (
                        <a href={doc.url_drive} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200 text-xs inline-flex items-center gap-1">
                          Abrir <Icon name="arrow-top-right-on-square" size={14} />
                        </a>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
          </Panel>
        </>
      )}

      {modal?.tipo === 'frente' && (
        <ModalNuevoFrente token={token} gerencia={codigo} onCerrar={() => setModal(null)} onGuardado={trasGuardar} />
      )}
      {modal?.tipo === 'decision' && (
        <ModalNuevaDecision token={token} gerencia={codigo} onCerrar={() => setModal(null)} onGuardado={trasGuardar} />
      )}
      {modal?.tipo === 'derivar' && (
        <ModalDerivar token={token} frente={modal.frente} onCerrar={() => setModal(null)} onGuardado={trasGuardar} />
      )}
      {modal?.tipo === 'eventos' && (
        <ModalEventos token={token} frente={modal.frente} onCerrar={() => setModal(null)} />
      )}
      {modal?.tipo === 'cerrarDecision' && (
        <ModalCerrarDecision token={token} decision={modal.decision} onCerrar={() => setModal(null)} onGuardado={trasGuardar} />
      )}
    </div>
  );
};

// Alta de frente. El código es OPCIONAL: si se omite, el backend asigna el
// siguiente libre del prefijo de la gerencia. Si se manda uno ocupado
// contesta 409 con `siguiente_codigo_libre`, y eso se ofrece con un click.
const ModalNuevoFrente = ({ token, gerencia, onCerrar, onGuardado }) => {
  const [form, setForm] = useState({ codigo: '', titulo: '', descripcion: '', estado: 'ABIERTO', responsable: '', ejecutor: '', prioridad: 0 });
  const [error, setError] = useState(null);
  const [conflicto, setConflicto] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null); setConflicto(null);
    try {
      await crearFrente(token, {
        gerencia_codigo: gerencia,
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        estado: form.estado,
        responsable: form.responsable || null,
        ejecutor: form.ejecutor || null,
        prioridad: Number(form.prioridad) || 0,
        ...(form.codigo ? { codigo: form.codigo } : {}),
      });
      onGuardado();
    } catch (err) {
      if (err.conflicto) setConflicto(err.conflicto);
      else setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal title="Nuevo frente" onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <AvisoConflictoCodigo
          conflicto={conflicto}
          onUsarSugerido={(codigo) => { setForm((f) => ({ ...f, codigo })); setConflicto(null); }}
        />
        {error && <ErrorCarga mensaje={error} que="guardar el frente" />}
        <Campo label="Código (opcional)" ayuda="Si lo dejás vacío, el backend asigna el siguiente libre de la gerencia.">
          <input className={inputClase} value={form.codigo} onChange={cambiar('codigo')} placeholder="Automático" />
        </Campo>
        <Campo label="Título">
          <input className={inputClase} value={form.titulo} onChange={cambiar('titulo')} required />
        </Campo>
        <Campo label="Descripción">
          <textarea className={inputClase} rows={3} value={form.descripcion} onChange={cambiar('descripcion')} />
        </Campo>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Estado">
            <select className={inputClase} value={form.estado} onChange={cambiar('estado')}>
              {ESTADOS_FRENTE.map((e) => <option key={e} value={e}>{etiqueta(e)}</option>)}
            </select>
          </Campo>
          <Campo label="Ejecutor">
            <select className={inputClase} value={form.ejecutor} onChange={cambiar('ejecutor')}>
              <option value="">—</option>
              {EJECUTORES_FRENTE.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </Campo>
          <Campo label="Responsable">
            <input className={inputClase} value={form.responsable} onChange={cambiar('responsable')} />
          </Campo>
          <Campo label="Prioridad">
            <input type="number" className={inputClase} value={form.prioridad} onChange={cambiar('prioridad')} />
          </Campo>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Crear frente'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ModalNuevaDecision = ({ token, gerencia, onCerrar, onGuardado }) => {
  const [form, setForm] = useState({ codigo: '', pregunta: '', opciones: '', recomendacion: '' });
  const [error, setError] = useState(null);
  const [conflicto, setConflicto] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null); setConflicto(null);
    try {
      await crearDecision(token, {
        gerencia_codigo: gerencia,
        pregunta: form.pregunta,
        opciones: form.opciones || null,
        recomendacion: form.recomendacion || null,
        ...(form.codigo ? { codigo: form.codigo } : {}),
      });
      onGuardado();
    } catch (err) {
      if (err.conflicto) setConflicto(err.conflicto);
      else setError(err.message);
    } finally { setGuardando(false); }
  };

  return (
    <Modal title="Nueva decisión" onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <AvisoConflictoCodigo
          conflicto={conflicto}
          onUsarSugerido={(codigo) => { setForm((f) => ({ ...f, codigo })); setConflicto(null); }}
        />
        {error && <ErrorCarga mensaje={error} que="guardar la decisión" />}
        <Campo label="Código (opcional)" ayuda="Vacío = el backend asigna el siguiente libre.">
          <input className={inputClase} value={form.codigo} onChange={cambiar('codigo')} placeholder="Automático" />
        </Campo>
        <Campo label="Pregunta">
          <textarea className={inputClase} rows={2} value={form.pregunta} onChange={cambiar('pregunta')} required />
        </Campo>
        <Campo label="Opciones">
          <textarea className={inputClase} rows={2} value={form.opciones} onChange={cambiar('opciones')} />
        </Campo>
        <Campo label="Recomendación">
          <textarea className={inputClase} rows={2} value={form.recomendacion} onChange={cambiar('recomendacion')} />
        </Campo>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Crear decisión'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ModalCerrarDecision = ({ token, decision, onCerrar, onGuardado }) => {
  const [resolucion, setResolucion] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null);
    try {
      await editarDecision(token, decision.codigo, { estado: 'CERRADA', resolucion });
      onGuardado();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  return (
    <Modal title={`Cerrar ${decision.codigo}`} onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        {error && <ErrorCarga mensaje={error} que="cerrar la decisión" />}
        <p className="text-slate-300 text-sm">{decision.pregunta}</p>
        <Campo label="Resolución">
          <textarea className={inputClase} rows={3} value={resolucion} onChange={(e) => setResolucion(e.target.value)} required />
        </Campo>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Cerrar decisión'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ModalDerivar = ({ token, frente, onCerrar, onGuardado }) => {
  const [gerencias, setGerencias] = useState([]);
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    listarGerencias(token).then(setGerencias).catch((err) => setError(err.message));
  }, [token]);

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null);
    try {
      await derivarFrente(token, frente.codigo, { gerencia_codigo: destino, motivo: motivo || null });
      onGuardado();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  return (
    <Modal title={`Derivar ${frente.codigo}`} onClose={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        {error && <ErrorCarga mensaje={error} que="derivar el frente" />}
        <Campo label="Gerencia destino">
          <select className={inputClase} value={destino} onChange={(e) => setDestino(e.target.value)} required>
            <option value="">Elegí una gerencia</option>
            {gerencias.map((g) => <option key={g.codigo} value={g.codigo}>{g.codigo} · {g.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Motivo">
          <textarea className={inputClase} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Derivando…' : 'Derivar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ModalEventos = ({ token, frente, onCerrar }) => {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    listarEventosFrente(token, frente.codigo)
      .then((e) => { if (!cancelado) setEventos(e); })
      .catch((err) => { if (!cancelado) setError(err.message); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [token, frente.codigo]);

  return (
    <Modal title={`Bitácora de ${frente.codigo}`} onClose={onCerrar} maxWidth="max-w-2xl">
      {error && <ErrorCarga mensaje={error} que="los eventos del frente" />}
      {loading ? (
        <Cargando />
      ) : !error && eventos.length === 0 ? (
        <EstadoVacio titulo="Todavía no hay eventos en este frente" detalle="La bitácora se llena con cada cambio." />
      ) : (
        <ul className="space-y-3">
          {eventos.map((ev) => (
            <li key={ev.id} className="border-l-2 border-slate-600 pl-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge valor={ev.tipo} />
                <span className="text-slate-500 text-xs">{fechaCorta(ev.ocurrido_en)}</span>
              </div>
              {ev.detalle && <p className="text-slate-300 text-sm mt-1">{ev.detalle}</p>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

export default DireccionGerencias;
