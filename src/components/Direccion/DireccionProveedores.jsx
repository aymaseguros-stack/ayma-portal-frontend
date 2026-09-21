import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import {
  alertasProveedores, costosProveedores, crearCoberturaProveedor, crearContactoProveedor,
  crearProveedor, crearTareaProveedor, darDeBajaProveedor, editarProveedor,
  editarTareaProveedor, listarCoberturasProveedor, listarContactosProveedor,
  listarProveedores, listarTareasProveedor, obtenerProveedor,
} from './direccionApi';
import { ESTADOS_PROVEEDOR, ESTADOS_TAREA_PROVEEDOR, MONEDAS, RUBROS_PRESUPUESTO, TIPOS_COBERTURA, TIPOS_PROVEEDOR, etiqueta, fechaCorta, formatearMonto } from './direccionConstantes';
// Los seis campos de relación económica los expone el backend desde el
// PR #184. Sus vocabularios viven en el módulo Comercial, que es de donde
// salen (app/models/comercial.py::RelacionEconomica), y no se duplican acá:
// una segunda lista es cómo un valor queda aceptado por una pantalla y
// rechazado por la otra.
import {
  RELACIONES_ECONOMICAS, SIN_CLASIFICAR, SIN_DATO, claseRelacion,
  formatearPctCampo, oSinDato,
} from '../Comercial/comercialConstantes';
import { listarPuntos } from '../Comercial/comercialApi';
import {
  Badge, Campo, Cargando, ErrorCarga, EstadoVacio, Panel, Tabla, botonPrimario, botonSecundario, inputClase,
} from './DireccionComunes';

// Chip de relación económica. NULL NO SE PINTA VACÍO: un proveedor sin
// clasificar se muestra en ámbar como "Sin clasificar", que es una tarea
// pendiente y no una celda en blanco que se pasa de largo. La migración de
// datos del backend deja en NULL a los tipos SERVICIOS y OTRO a propósito
// ("no hay forma de saber la dirección sin mirar el contrato").
const ChipRelacion = ({ valor }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${claseRelacion(valor)}`}>
    {valor || SIN_CLASIFICAR}
  </span>
);

// El LIMIT_MAX del backend. Se pide explícito para que el filtro por
// relación económica -que se aplica en el cliente, ver `visibles`- barra el
// padrón entero y no una primera página.
const LIMITE_PADRON = 500;

// Sentinela del filtro "Sin clasificar". No puede ser '' porque ése es "sin
// filtro", y no puede ser null porque el value de un <option> es string.
const FILTRO_SIN_CLASIFICAR = '__SIN_CLASIFICAR__';

const VISTAS = [
  { id: 'lista', label: 'Proveedores' },
  { id: 'costos', label: 'Costos por rubro' },
];

// Pantalla 3: padrón de proveedores. Lista con filtros, alta/edición,
// detalle con pestañas y vista de costos. La baja es LÓGICA en el backend
// (DELETE sella eliminado_en y pasa a BAJA), así que se confirma antes.
const DireccionProveedores = ({ token }) => {
  const [vista, setVista] = useState('lista');
  const [detalleId, setDetalleId] = useState(null);

  if (detalleId) {
    return <DetalleProveedor token={token} proveedorId={detalleId} onVolver={() => setDetalleId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Proveedores</h2>
          <p className="text-slate-400 text-sm mt-1">A quién le pagamos, cuánto, y qué trabajo tiene asignado.</p>
        </div>
        <nav className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                vista === v.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </div>

      {vista === 'lista'
        ? <ListaProveedores token={token} onAbrir={setDetalleId} />
        : <CostosPorRubro token={token} />}
    </div>
  );
};

const ListaProveedores = ({ token, onAbrir }) => {
  const [items, setItems] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [tipo, setTipo] = useState('');
  const [rubro, setRubro] = useState('');
  const [estado, setEstado] = useState('');
  const [relacion, setRelacion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorAlertas, setErrorAlertas] = useState(null);
  const [modalAlta, setModalAlta] = useState(false);
  const [aBajar, setABajar] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Los tres filtros los resuelve el BACKEND
      // (GET /direccion/proveedores?estado=&tipo=&rubro_presupuesto=). Antes
      // `tipo` se filtraba en el cliente sobre la página ya traída: con el
      // limit por default eso significa filtrar sobre los primeros N y
      // mostrar "ninguno coincide" cuando el que se busca está en la página
      // siguiente.
      // `limit: LIMITE_PADRON` es lo que hace honesto al filtro por
      // relación económica de abajo. Ver el comentario de `visibles`.
      setItems(await listarProveedores(token, {
        estado: estado || undefined,
        tipo: tipo || undefined,
        rubro_presupuesto: rubro || undefined,
        limit: LIMITE_PADRON,
      }));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, estado, tipo, rubro]);

  // EL FILTRO POR RELACIÓN ECONÓMICA SE APLICA EN EL CLIENTE, y es la única
  // excepción de esta pantalla: `GET /direccion/proveedores` acepta `estado`,
  // `tipo` y `rubro_presupuesto`, pero NO `relacion_economica` (ver
  // `listar_proveedores` en el backend). Agregarlo como query lo haría
  // rebotar como parámetro ignorado y el filtro no filtraría nada.
  //
  // Para que eso no reviva el bug que los otros tres filtros ya corrigieron
  // -filtrar sobre la primera página y decir "ninguno coincide" cuando el
  // buscado está más atrás-, la carga pide `limit=500`, que es el LIMIT_MAX
  // del backend, contra un padrón de decenas de filas. Y si alguna vez el
  // padrón llegara a ese tope, el cartel de abajo lo dice en vez de mentir
  // en silencio.
  const visibles = !relacion ? items : items.filter((p) => (
    relacion === FILTRO_SIN_CLASIFICAR ? !p.relacion_economica : p.relacion_economica === relacion
  ));
  const padronTruncado = items.length >= LIMITE_PADRON;

  const cargarAlertas = useCallback(async () => {
    setErrorAlertas(null);
    try { setAlertas(await alertasProveedores(token)); }
    catch (err) { setErrorAlertas(err.message); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarAlertas(); }, [cargarAlertas]);

  const hayFiltro = Boolean(tipo || estado || rubro || relacion);

  const confirmarBaja = async () => {
    try {
      await darDeBajaProveedor(token, aBajar.id);
      setABajar(null);
      cargar();
      cargarAlertas();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-6">
      {errorAlertas
        ? <ErrorCarga mensaje={errorAlertas} que="las alertas de proveedores" onReintentar={cargarAlertas} />
        : alertas.length > 0 && (
          <Panel titulo={`Alertas (${alertas.length})`} subtitulo="Vencimientos y datos faltantes">
            <ul className="divide-y divide-slate-700/60">
              {alertas.map((a, i) => (
                <li key={`${a.proveedor_id}-${a.tipo}-${i}`} className="px-4 py-2.5 flex items-start gap-3">
                  <Icon name="exclamation-triangle" size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-slate-200 text-sm">
                      <span className="font-medium">{a.proveedor_nombre}</span> — {a.detalle}
                    </p>
                    {(a.vence_en || a.dias !== null) && (
                      <p className="text-slate-500 text-xs mt-0.5">
                        {a.vence_en ? `Vence ${fechaCorta(a.vence_en)}` : ''}
                        {a.dias !== null && a.dias !== undefined ? ` · ${a.dias} días` : ''}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}

      <div className="flex items-end gap-3 flex-wrap">
        <Campo label="Tipo">
          <select className={inputClase + ' min-w-[180px]'} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {TIPOS_PROVEEDOR.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}
          </select>
        </Campo>
        <Campo label="Rubro de presupuesto">
          <select className={inputClase + ' min-w-[190px]'} value={rubro} onChange={(e) => setRubro(e.target.value)}>
            <option value="">Todos</option>
            {RUBROS_PRESUPUESTO.map((r) => <option key={r} value={r}>{etiqueta(r)}</option>)}
          </select>
        </Campo>
        <Campo label="Estado">
          <select className={inputClase + ' min-w-[160px]'} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_PROVEEDOR.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}
          </select>
        </Campo>
        <Campo label="Relación económica">
          <select
            aria-label="Relación económica"
            className={inputClase + ' min-w-[185px]'}
            value={relacion}
            onChange={(e) => setRelacion(e.target.value)}
          >
            <option value="">Todas</option>
            {RELACIONES_ECONOMICAS.map((r) => <option key={r} value={r}>{r}</option>)}
            {/* "Sin clasificar" ES un filtro y no la ausencia de filtro: es
                la lista de trabajo pendiente (los tipos SERVICIOS y OTRO que
                la migración de datos dejó en NULL a propósito). Sin esta
                opción, la única forma de encontrarlos sería mirar las 24
                filas de a una. */}
            <option value={FILTRO_SIN_CLASIFICAR}>{SIN_CLASIFICAR}</option>
          </select>
        </Campo>
        <button className={botonPrimario + ' ml-auto'} onClick={() => setModalAlta(true)}>Nuevo proveedor</button>
      </div>

      {error && !loading && <ErrorCarga mensaje={error} que="los proveedores" onReintentar={cargar} />}

      {/* El filtro por relación económica corre en el cliente (el backend no
          lo acepta como query). Mientras el padrón entre en un pedido, el
          resultado es completo; si alguna vez llega al tope, se dice, en vez
          de mostrar un subconjunto como si fuera todo. */}
      {relacion && padronTruncado && (
        <div role="alert" className="bg-yellow-500/15 border border-yellow-500/50 rounded-lg p-3 text-sm">
          <p className="text-yellow-100">
            El padrón llegó al tope de {LIMITE_PADRON} filas por pedido y este filtro se aplica en
            el cliente: puede haber proveedores que coincidan y no se estén viendo. Acotá antes por
            tipo, rubro o estado.
          </p>
        </div>
      )}

      <Panel>
        {loading ? (
          <Cargando texto="Cargando proveedores…" />
        ) : error ? null : visibles.length === 0 ? (
          <EstadoVacio
            icono="building-office"
            titulo={hayFiltro ? 'Ningún proveedor coincide con el filtro' : 'Todavía no hay proveedores. Cargá el primero'}
            detalle={hayFiltro ? 'Probá con otro tipo, rubro o estado.' : 'Acá va todo lo que se paga: herramientas, profesionales, locaciones.'}
            accion={!hayFiltro
              ? <button className={botonPrimario} onClick={() => setModalAlta(true)}>Cargar el primero</button>
              : null}
          />
        ) : (
          <Tabla columnas={['Proveedor', 'Tipo', 'Relación', 'Estado', 'Costo mensual', 'Rubro', 'Renovación', 'Trabajo asignado', '']}>
            {visibles.map((p) => (
              <tr key={p.id} className={p.costo_mensual && !p.trabajo_asignado ? 'bg-red-500/10' : ''}>
                <td className="px-4 py-2.5">
                  <button className="text-white hover:text-blue-300 font-medium text-left" onClick={() => onAbrir(p.id)}>
                    {p.nombre}
                  </button>
                </td>
                <td className="px-4 py-2.5"><Badge valor={p.tipo} /></td>
                <td className="px-4 py-2.5"><ChipRelacion valor={p.relacion_economica} /></td>
                <td className="px-4 py-2.5"><Badge valor={p.estado} /></td>
                <td className="px-4 py-2.5 text-slate-200 whitespace-nowrap">{formatearMonto(p.costo_mensual, p.moneda)}</td>
                <td className="px-4 py-2.5"><Badge valor={p.rubro_presupuesto} /></td>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fechaCorta(p.renovacion_fecha)}</td>
                <td className="px-4 py-2.5 text-sm">
                  {p.trabajo_asignado
                    ? <span className="text-slate-300">{p.trabajo_asignado}</span>
                    : <span className="text-red-300 text-xs font-semibold">Sin trabajo asignado</span>}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {p.estado !== 'BAJA' && (
                    <button className="text-red-300 hover:text-red-200 text-xs" onClick={() => setABajar(p)}>
                      Dar de baja
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>

      {modalAlta && (
        <ModalProveedor
          token={token}
          onCerrar={() => setModalAlta(false)}
          onGuardado={() => { setModalAlta(false); cargar(); cargarAlertas(); }}
        />
      )}

      {aBajar && (
        <Modal title="Dar de baja el proveedor" onClose={() => setABajar(null)}>
          <p className="text-slate-300 text-sm">
            ¿Dar de baja a <strong className="text-white">{aBajar.nombre}</strong>?
          </p>
          <p className="text-slate-400 text-xs mt-2">
            Es una baja lógica: sale de listados, alertas y costos, pero el histórico de lo que se le pagó no se borra.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button className={botonSecundario} onClick={() => setABajar(null)}>Cancelar</button>
            <button
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition"
              onClick={confirmarBaja}
            >
              Dar de baja
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const FORM_VACIO = {
  nombre: '', tipo: 'OTRO', estado: 'ACTIVO', costo_mensual: '', moneda: '',
  rubro_presupuesto: '', dia_vencimiento_pago: '', renovacion_fecha: '',
  url_panel: '', trabajo_asignado: '', cuit: '', notas: '',
  es_persona_fisica: false, transfiere_datos_exterior: false, dpa_firmado: false,
  // Relación económica (backend PR #184). `companias_habilitadas` vive en el
  // form como TEXTO separado por comas y se parte al enviar: un editor de
  // chips completo para una lista de tres nombres es más superficie de la
  // que el dato justifica.
  relacion_economica: '', companias_habilitadas: '', comision_pct_aplicable: '',
  es_receptor_factura: false, sla_respuesta_horas: '', punto_contacto_id: '',
};

// La lista de compañías viaja como array de strings. El backend ya recorta,
// descarta vacíos y deduplica conservando el orden, así que acá sólo se
// parte por coma: normalizar dos veces con reglas que se pueden desincronizar
// es peor que dejar que mande una sola.
const partirCompanias = (texto) => String(texto || '')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

// Alta y edición. Los campos visibles son exactamente los que pide el
// módulo; los opcionales vacíos viajan como null (no como "") para no
// romper la validación de Decimal/date del backend.
const ModalProveedor = ({ token, proveedor, onCerrar, onGuardado }) => {
  const [form, setForm] = useState(() => (proveedor
    ? { ...FORM_VACIO, ...Object.fromEntries(Object.entries(proveedor).filter(([k]) => k in FORM_VACIO))
        , costo_mensual: proveedor.costo_mensual ?? '', renovacion_fecha: proveedor.renovacion_fecha ?? '',
        dia_vencimiento_pago: proveedor.dia_vencimiento_pago ?? '',
        relacion_economica: proveedor.relacion_economica ?? '',
        companias_habilitadas: (proveedor.companias_habilitadas || []).join(', '),
        comision_pct_aplicable: proveedor.comision_pct_aplicable ?? '',
        es_receptor_factura: Boolean(proveedor.es_receptor_factura),
        sla_respuesta_horas: proveedor.sla_respuesta_horas ?? '',
        punto_contacto_id: proveedor.punto_contacto_id ?? '' }
    : FORM_VACIO));
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [puntos, setPuntos] = useState([]);

  // Para el desplegable de "Punto de contacto vinculado". Si falla, el
  // desplegable queda con la opción vacía y el resto del formulario sigue
  // funcionando: no se puede perder el alta de un proveedor porque no cargó
  // una lista opcional.
  useEffect(() => {
    listarPuntos(token, { limite: 500 }).then(setPuntos).catch(() => setPuntos([]));
  }, [token]);

  const texto = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const check = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.checked }));

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError(null);
    const vacioANull = (v) => (v === '' || v === undefined ? null : v);
    const cuerpo = {
      nombre: form.nombre,
      tipo: form.tipo,
      estado: form.estado,
      cuit: vacioANull(form.cuit),
      costo_mensual: form.costo_mensual === '' ? null : String(form.costo_mensual),
      moneda: vacioANull(form.moneda),
      rubro_presupuesto: vacioANull(form.rubro_presupuesto),
      dia_vencimiento_pago: form.dia_vencimiento_pago === '' ? null : Number(form.dia_vencimiento_pago),
      renovacion_fecha: vacioANull(form.renovacion_fecha),
      url_panel: vacioANull(form.url_panel),
      trabajo_asignado: vacioANull(form.trabajo_asignado),
      es_persona_fisica: Boolean(form.es_persona_fisica),
      transfiere_datos_exterior: Boolean(form.transfiere_datos_exterior),
      dpa_firmado: Boolean(form.dpa_firmado),
      notas: vacioANull(form.notas),
      // Los seis de relación económica. LOS VACÍOS VIAJAN COMO `null` Y ESO
      // BORRA: el backend honra el null para estos cinco campos
      // (`CAMPOS_BORRABLES`) justamente para que se puedan desvincular desde
      // acá. Para los campos viejos de arriba, en cambio, `null` sigue
      // significando "no lo toques" — por eso esta pantalla nunca pudo
      // borrarlos y sigue sin poder, que es el contrato de siempre.
      relacion_economica: vacioANull(form.relacion_economica),
      companias_habilitadas: partirCompanias(form.companias_habilitadas).length
        ? partirCompanias(form.companias_habilitadas)
        : null,
      comision_pct_aplicable: form.comision_pct_aplicable === ''
        ? null : String(form.comision_pct_aplicable),
      // `es_receptor_factura` NO usa vacioANull: su columna es NOT NULL y se
      // apaga mandando `false`, no `null`.
      es_receptor_factura: Boolean(form.es_receptor_factura),
      sla_respuesta_horas: form.sla_respuesta_horas === ''
        ? null : Number(form.sla_respuesta_horas),
      punto_contacto_id: vacioANull(form.punto_contacto_id),
    };
    try {
      if (proveedor) await editarProveedor(token, proveedor.id, cuerpo);
      else await crearProveedor(token, cuerpo);
      onGuardado();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  return (
    <Modal title={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={onCerrar} maxWidth="max-w-2xl">
      <form onSubmit={enviar} className="space-y-4">
        {error && <ErrorCarga mensaje={error} que="guardar el proveedor" />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Nombre">
            <input className={inputClase} value={form.nombre} onChange={texto('nombre')} required />
          </Campo>
          <Campo label="CUIT">
            <input className={inputClase} value={form.cuit} onChange={texto('cuit')} />
          </Campo>
          <Campo label="Tipo">
            <select className={inputClase} value={form.tipo} onChange={texto('tipo')}>
              {TIPOS_PROVEEDOR.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}
            </select>
          </Campo>
          <Campo label="Estado">
            <select className={inputClase} value={form.estado} onChange={texto('estado')}>
              {ESTADOS_PROVEEDOR.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}
            </select>
          </Campo>
          <Campo label="Costo mensual">
            <input type="number" step="0.01" className={inputClase} value={form.costo_mensual} onChange={texto('costo_mensual')} />
          </Campo>
          <Campo label="Moneda">
            <select className={inputClase} value={form.moneda} onChange={texto('moneda')}>
              <option value="">—</option>
              {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Campo>
          <Campo label="Rubro de presupuesto">
            <select className={inputClase} value={form.rubro_presupuesto} onChange={texto('rubro_presupuesto')}>
              <option value="">—</option>
              {RUBROS_PRESUPUESTO.map((r) => <option key={r} value={r}>{etiqueta(r)}</option>)}
            </select>
          </Campo>
          <Campo label="Día de pago" ayuda="1 a 31.">
            <input type="number" min="1" max="31" className={inputClase} value={form.dia_vencimiento_pago} onChange={texto('dia_vencimiento_pago')} />
          </Campo>
          <Campo label="Renovación">
            <input type="date" className={inputClase} value={form.renovacion_fecha || ''} onChange={texto('renovacion_fecha')} />
          </Campo>
          <Campo label="URL del panel">
            <input className={inputClase} value={form.url_panel} onChange={texto('url_panel')} placeholder="https://" />
          </Campo>
        </div>
        <Campo label="Trabajo asignado" ayuda="Si se paga y no tiene trabajo asignado, aparece en rojo en el tablero.">
          <input className={inputClase} value={form.trabajo_asignado} onChange={texto('trabajo_asignado')} />
        </Campo>
        <Campo label="Notas">
          <textarea className={inputClase} rows={2} value={form.notas} onChange={texto('notas')} />
        </Campo>
        <fieldset className="border border-slate-700 rounded-lg p-3 space-y-3">
          <legend className="px-1 text-slate-400 text-xs">Relación económica</legend>
          <p className="text-slate-500 text-[11px]">
            En qué dirección va la plata con este proveedor. Dejar los campos vacíos los borra.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo
              label="Relación"
              ayuda="INGRESO: nos liquida. EGRESO: le pagamos. COMPARTIDA: las dos."
            >
              <select
                aria-label="Relación"
                className={inputClase}
                value={form.relacion_economica}
                onChange={texto('relacion_economica')}
              >
                <option value="">{SIN_CLASIFICAR}</option>
                {RELACIONES_ECONOMICAS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Campo>
            <Campo label="Comisión aplicable (%)" ayuda="0 a 100.">
              <input
                type="number" step="0.01" min="0" max="100"
                className={inputClase}
                value={form.comision_pct_aplicable}
                onChange={texto('comision_pct_aplicable')}
              />
            </Campo>
            <Campo label="SLA de respuesta (horas)" ayuda="Hasta 8760 (un año).">
              <input
                type="number" min="0" max="8760"
                className={inputClase}
                value={form.sla_respuesta_horas}
                onChange={texto('sla_respuesta_horas')}
              />
            </Campo>
            <Campo label="Punto de contacto vinculado">
              <select
                aria-label="Punto de contacto vinculado"
                className={inputClase}
                value={form.punto_contacto_id}
                onChange={texto('punto_contacto_id')}
              >
                <option value="">—</option>
                {puntos.map((pc) => <option key={pc.id} value={pc.id}>{pc.slug} — {pc.nombre}</option>)}
              </select>
            </Campo>
          </div>
          <Campo
            label="Compañías habilitadas"
            ayuda="Separadas por coma. P. ej.: BERKLEY, PREVENCION, FEDERACION."
          >
            <input
              className={inputClase}
              value={form.companias_habilitadas}
              onChange={texto('companias_habilitadas')}
              placeholder="BERKLEY, PREVENCION"
            />
          </Campo>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.es_receptor_factura} onChange={check('es_receptor_factura')} />
            Le emitimos comprobante (es receptor de factura)
          </label>
        </fieldset>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.es_persona_fisica} onChange={check('es_persona_fisica')} />
            Persona física
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.transfiere_datos_exterior} onChange={check('transfiere_datos_exterior')} />
            Transfiere datos al exterior
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.dpa_firmado} onChange={check('dpa_firmado')} />
            DPA firmado
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : (proveedor ? 'Guardar cambios' : 'Crear proveedor')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const PESTANAS_DETALLE = [
  { id: 'datos', label: 'Datos' },
  { id: 'contactos', label: 'Contactos' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'coberturas', label: 'Coberturas' },
];

const DetalleProveedor = ({ token, proveedorId, onVolver }) => {
  const [pestana, setPestana] = useState('datos');
  const [proveedor, setProveedor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setProveedor(await obtenerProveedor(token, proveedorId));
    } catch (err) { setError(err.message); setProveedor(null); }
    finally { setLoading(false); }
  }, [token, proveedorId]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onVolver} className={botonSecundario + ' flex items-center gap-2'}>
            <Icon name="arrow-left" size={16} /> Proveedores
          </button>
          <h2 className="text-2xl font-bold truncate">{proveedor?.nombre || 'Proveedor'}</h2>
          {proveedor && <Badge valor={proveedor.estado} />}
        </div>
        {proveedor && <button className={botonPrimario} onClick={() => setEditando(true)}>Editar</button>}
      </div>

      {error && <ErrorCarga mensaje={error} que="el proveedor" onReintentar={cargar} />}
      {loading && <Cargando />}

      {proveedor && (
        <>
          <nav className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1 w-fit max-w-full overflow-x-auto">
            {PESTANAS_DETALLE.map((p) => (
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

          {pestana === 'datos' && <PestanaDatos token={token} proveedor={proveedor} />}
          {pestana === 'contactos' && <PestanaContactos token={token} proveedorId={proveedorId} />}
          {pestana === 'tareas' && <PestanaTareas token={token} proveedorId={proveedorId} />}
          {pestana === 'coberturas' && <PestanaCoberturas token={token} proveedorId={proveedorId} />}
        </>
      )}

      {editando && proveedor && (
        <ModalProveedor
          token={token}
          proveedor={proveedor}
          onCerrar={() => setEditando(false)}
          onGuardado={() => { setEditando(false); cargar(); }}
        />
      )}
    </div>
  );
};

const Dato = ({ label, children }) => (
  <div>
    <p className="text-slate-500 text-xs">{label}</p>
    <div className="text-slate-200 text-sm mt-0.5">{children ?? '—'}</div>
  </div>
);

// El link al punto de contacto: el backend guarda el id, y un UUID en
// pantalla no le dice nada a nadie. Se resuelve contra el listado de puntos
// para mostrar el slug, que es lo que está impreso en el QR.
const PuntoVinculado = ({ token, puntoId }) => {
  const [punto, setPunto] = useState(undefined);
  useEffect(() => {
    // Sin id no se toca el estado: el render de abajo ya corta por `puntoId`
    // antes de mirar `punto`, y un setState acá dispararía un render en
    // cascada por un caso que no necesita ninguno.
    if (!puntoId) return undefined;
    let vivo = true;
    listarPuntos(token, { limite: 500 })
      .then((filas) => { if (vivo) setPunto(filas.find((f) => f.id === puntoId) || null); })
      .catch(() => { if (vivo) setPunto(null); });
    return () => { vivo = false; };
  }, [token, puntoId]);

  if (!puntoId) return <span className="text-slate-500">{SIN_DATO}</span>;
  if (punto === undefined) return <span className="text-slate-500">…</span>;
  if (!punto) return <span className="text-slate-500">{SIN_DATO}</span>;
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <code className="font-mono text-blue-300">{punto.slug}</code>
      <span className="text-slate-400 text-xs">{punto.nombre}</span>
      {punto.url_corta && (
        <a
          href={punto.url_corta}
          target="_blank"
          rel="noreferrer"
          className="text-blue-300 hover:text-blue-200 inline-flex items-center gap-1 text-xs"
        >
          Abrir <Icon name="arrow-top-right-on-square" size={12} />
        </a>
      )}
    </span>
  );
};

const PestanaDatos = ({ token, proveedor: p }) => (
  <Panel titulo="Datos">
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Dato label="Tipo"><Badge valor={p.tipo} /></Dato>
      <Dato label="Estado"><Badge valor={p.estado} /></Dato>
      <Dato label="CUIT">{p.cuit || '—'}</Dato>
      <Dato label="Costo mensual">{formatearMonto(p.costo_mensual, p.moneda)}</Dato>
      <Dato label="Rubro de presupuesto"><Badge valor={p.rubro_presupuesto} /></Dato>
      <Dato label="Día de pago">{p.dia_vencimiento_pago ?? '—'}</Dato>
      <Dato label="Renovación">{fechaCorta(p.renovacion_fecha)}</Dato>
      <Dato label="Panel">
        {p.url_panel
          ? <a href={p.url_panel} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200 inline-flex items-center gap-1">
              Abrir <Icon name="arrow-top-right-on-square" size={14} />
            </a>
          : '—'}
      </Dato>
      <Dato label="Trabajo asignado">
        {p.trabajo_asignado || <span className="text-red-300 font-semibold text-xs">Sin trabajo asignado</span>}
      </Dato>
      <Dato label="Persona física">{p.es_persona_fisica ? 'Sí' : 'No'}</Dato>
      <Dato label="Transfiere datos al exterior">{p.transfiere_datos_exterior ? 'Sí' : 'No'}</Dato>
      <Dato label="DPA firmado">{p.dpa_firmado ? 'Sí' : 'No'}</Dato>

      {/* Relación económica (backend PR #184). En su propia fila porque es
          otra pregunta que el resto: el bloque de arriba es a quién le
          pagamos, éste es en qué dirección va la plata. */}
      <div className="sm:col-span-2 lg:col-span-3 border-t border-slate-700/60 pt-4 mt-1">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Relación económica</p>
      </div>
      <Dato label="Relación"><ChipRelacion valor={p.relacion_economica} /></Dato>
      <Dato label="Comisión aplicable">{formatearPctCampo(p.comision_pct_aplicable)}</Dato>
      <Dato label="SLA de respuesta">
        {p.sla_respuesta_horas === null || p.sla_respuesta_horas === undefined
          ? <span className="text-slate-500">{SIN_DATO}</span>
          : `${p.sla_respuesta_horas} h`}
      </Dato>
      <Dato label="Receptor de factura">{p.es_receptor_factura ? 'Sí' : 'No'}</Dato>
      <div className="sm:col-span-2">
        <Dato label="Punto de contacto vinculado">
          <PuntoVinculado token={token} puntoId={p.punto_contacto_id} />
        </Dato>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <Dato label="Compañías habilitadas">
          {p.companias_habilitadas && p.companias_habilitadas.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {p.companias_habilitadas.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-200 text-xs">
                  {c}
                </span>
              ))}
            </div>
          ) : <span className="text-slate-500">{SIN_DATO}</span>}
        </Dato>
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        <Dato label="Notas">{oSinDato(p.notas)}</Dato>
      </div>
    </div>
  </Panel>
);

// Hook común de las pestañas del detalle: cargar, error visible, empty state.
const useSubrecurso = (cargarFn) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const recargar = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await cargarFn()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [cargarFn]);
  useEffect(() => { recargar(); }, [recargar]);
  return { items, loading, error, recargar };
};

const PestanaContactos = ({ token, proveedorId }) => {
  const cargarFn = useCallback(() => listarContactosProveedor(token, proveedorId), [token, proveedorId]);
  const { items, loading, error, recargar } = useSubrecurso(cargarFn);
  const [form, setForm] = useState({ nombre: '', cargo: '', email: '', telefono: '' });
  const [guardando, setGuardando] = useState(false);
  const [errorAlta, setErrorAlta] = useState(null);

  const agregar = async (e) => {
    e.preventDefault();
    setGuardando(true); setErrorAlta(null);
    try {
      await crearContactoProveedor(token, proveedorId, {
        nombre: form.nombre || null, cargo: form.cargo || null,
        email: form.email || null, telefono: form.telefono || null,
      });
      setForm({ nombre: '', cargo: '', email: '', telefono: '' });
      recargar();
    } catch (err) { setErrorAlta(err.message); }
    finally { setGuardando(false); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorCarga mensaje={error} que="los contactos" onReintentar={recargar} />}
      <Panel titulo="Contactos">
        {loading ? <Cargando /> : error ? null : items.length === 0 ? (
          <EstadoVacio titulo="Todavía no hay contactos" detalle="Cargá el primero con el formulario de abajo." icono="chat-bubble" />
        ) : (
          <Tabla columnas={['Nombre', 'Cargo', 'Email', 'Teléfono']}>
            {items.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 text-white">{c.nombre || '—'}</td>
                <td className="px-4 py-2.5 text-slate-300">{c.cargo || '—'}</td>
                <td className="px-4 py-2.5 text-slate-300">{c.email || '—'}</td>
                <td className="px-4 py-2.5 text-slate-300">{c.telefono || '—'}</td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>
      <Panel titulo="Agregar contacto">
        <form onSubmit={agregar} className="p-4 space-y-3">
          {errorAlta && <ErrorCarga mensaje={errorAlta} que="guardar el contacto" />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Nombre"><input className={inputClase} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Campo>
            <Campo label="Cargo"><input className={inputClase} value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></Campo>
            <Campo label="Email"><input className={inputClase} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Campo>
            <Campo label="Teléfono"><input className={inputClase} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Campo>
          </div>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Agregar contacto'}
          </button>
        </form>
      </Panel>
    </div>
  );
};

const PestanaTareas = ({ token, proveedorId }) => {
  const cargarFn = useCallback(() => listarTareasProveedor(token, proveedorId), [token, proveedorId]);
  const { items, loading, error, recargar } = useSubrecurso(cargarFn);
  const [form, setForm] = useState({ titulo: '', vence_en: '' });
  const [guardando, setGuardando] = useState(false);
  const [errorAlta, setErrorAlta] = useState(null);

  const agregar = async (e) => {
    e.preventDefault();
    setGuardando(true); setErrorAlta(null);
    try {
      await crearTareaProveedor(token, proveedorId, {
        titulo: form.titulo, vence_en: form.vence_en || null,
      });
      setForm({ titulo: '', vence_en: '' });
      recargar();
    } catch (err) { setErrorAlta(err.message); }
    finally { setGuardando(false); }
  };

  const cambiarEstado = async (tarea, estado) => {
    try { await editarTareaProveedor(token, proveedorId, tarea.id, { estado }); recargar(); }
    catch (err) { setErrorAlta(err.message); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorCarga mensaje={error} que="las tareas" onReintentar={recargar} />}
      <Panel titulo="Tareas">
        {loading ? <Cargando /> : error ? null : items.length === 0 ? (
          <EstadoVacio titulo="Todavía no hay tareas" detalle="Cargá la primera con el formulario de abajo." icono="clock" />
        ) : (
          <Tabla columnas={['Tarea', 'Vence', 'Estado']}>
            {items.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2.5 text-white">{t.titulo}</td>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fechaCorta(t.vence_en)}</td>
                <td className="px-4 py-2.5">
                  <select
                    aria-label={`Estado de la tarea ${t.titulo}`}
                    value={t.estado}
                    onChange={(e) => cambiarEstado(t, e.target.value)}
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-600 text-white text-xs"
                  >
                    {ESTADOS_TAREA_PROVEEDOR.map((e) => <option key={e} value={e}>{etiqueta(e)}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>
      <Panel titulo="Agregar tarea">
        <form onSubmit={agregar} className="p-4 space-y-3">
          {errorAlta && <ErrorCarga mensaje={errorAlta} que="guardar la tarea" />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Título"><input className={inputClase} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></Campo>
            <Campo label="Vence"><input type="date" className={inputClase} value={form.vence_en} onChange={(e) => setForm({ ...form, vence_en: e.target.value })} /></Campo>
          </div>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Agregar tarea'}
          </button>
        </form>
      </Panel>
    </div>
  );
};

const PestanaCoberturas = ({ token, proveedorId }) => {
  const cargarFn = useCallback(() => listarCoberturasProveedor(token, proveedorId), [token, proveedorId]);
  const { items, loading, error, recargar } = useSubrecurso(cargarFn);
  const [form, setForm] = useState({ tipo: 'OTRA', vence_en: '', url_drive: '' });
  const [guardando, setGuardando] = useState(false);
  const [errorAlta, setErrorAlta] = useState(null);

  const agregar = async (e) => {
    e.preventDefault();
    setGuardando(true); setErrorAlta(null);
    try {
      await crearCoberturaProveedor(token, proveedorId, {
        tipo: form.tipo, vence_en: form.vence_en || null, url_drive: form.url_drive || null,
      });
      setForm({ tipo: 'OTRA', vence_en: '', url_drive: '' });
      recargar();
    } catch (err) { setErrorAlta(err.message); }
    finally { setGuardando(false); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorCarga mensaje={error} que="las coberturas" onReintentar={recargar} />}
      <Panel titulo="Coberturas">
        {loading ? <Cargando /> : error ? null : items.length === 0 ? (
          <EstadoVacio titulo="Todavía no hay coberturas" detalle="ART, RC u otras pólizas del proveedor." icono="shield-check" />
        ) : (
          <Tabla columnas={['Tipo', 'Vence', 'Documento']}>
            {items.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5"><Badge valor={c.tipo} /></td>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fechaCorta(c.vence_en)}</td>
                <td className="px-4 py-2.5">
                  {c.url_drive
                    ? <a href={c.url_drive} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200 text-xs">Abrir</a>
                    : <span className="text-slate-500">—</span>}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>
      <Panel titulo="Agregar cobertura">
        <form onSubmit={agregar} className="p-4 space-y-3">
          {errorAlta && <ErrorCarga mensaje={errorAlta} que="guardar la cobertura" />}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Campo label="Tipo">
              <select className={inputClase} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS_COBERTURA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo label="Vence"><input type="date" className={inputClase} value={form.vence_en} onChange={(e) => setForm({ ...form, vence_en: e.target.value })} /></Campo>
            <Campo label="URL del documento"><input className={inputClase} value={form.url_drive} onChange={(e) => setForm({ ...form, url_drive: e.target.value })} /></Campo>
          </div>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Agregar cobertura'}
          </button>
        </form>
      </Panel>
    </div>
  );
};

const CostosPorRubro = ({ token }) => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try { setDatos(await costosProveedores(token)); }
    catch (err) { setError(err.message); setDatos(null); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  if (error && !loading) return <ErrorCarga mensaje={error} que="los costos" onReintentar={cargar} />;
  if (loading) return <Cargando texto="Cargando costos…" />;
  if (!datos) return null;

  const porRubro = datos.por_rubro || {};
  const porMoneda = datos.por_moneda || {};

  return (
    <Panel
      titulo="Costos por rubro"
      subtitulo="Proveedores ACTIVO con costo mensual. No se suman monedas distintas."
    >
      {Object.keys(porRubro).length === 0 ? (
        <EstadoVacio
          icono="currency-dollar"
          titulo="Todavía no hay costos cargados"
          detalle="Cargá el costo mensual de un proveedor activo para verlo acá."
        />
      ) : (
        <>
          <Tabla columnas={['Rubro', 'Moneda', 'Total mensual']}>
            {Object.entries(porRubro).flatMap(([rubro, porMon]) =>
              Object.entries(porMon).map(([moneda, monto]) => (
                <tr key={`${rubro}-${moneda}`}>
                  <td className="px-4 py-2.5"><Badge valor={rubro} /></td>
                  <td className="px-4 py-2.5 text-slate-300">{moneda}</td>
                  <td className="px-4 py-2.5 text-white whitespace-nowrap">{formatearMonto(monto, moneda)}</td>
                </tr>
              ))
            )}
          </Tabla>
          <div className="px-4 py-3 border-t border-slate-700 flex flex-wrap gap-4">
            {Object.entries(porMoneda).map(([moneda, monto]) => (
              <div key={moneda}>
                <p className="text-slate-400 text-xs">Total {moneda}</p>
                <p className="text-lg font-bold text-white">{formatearMonto(monto, moneda)}</p>
              </div>
            ))}
            <div>
              <p className="text-slate-400 text-xs">Proveedores contados</p>
              <p className="text-lg font-bold text-white">{datos.proveedores_contados ?? '—'}</p>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
};

export default DireccionProveedores;
