import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import {
  Badge, Campo, Cargando, ErrorCarga, EstadoVacio, Panel, Tabla,
  botonPrimario, botonSecundario, inputClase,
} from '../Direccion/DireccionComunes';
import { listarProveedores } from '../Direccion/direccionApi';
import {
  crearPunto, darDeBajaPunto, descargarQrPunto, editarPunto, listarPuntos,
  metricasPunto, obtenerPunto, rankingPuntos,
} from './comercialApi';
import {
  DESTINOS_TIPO, ORDENES_RANKING, RIESGOS_PUNTO, SIN_DATO, TIPOS_PUNTO,
  errorDeSlug, estadoDeVigencia, etiquetaPunto, fechaCorta, formatearPct,
  formatearPctCampo, formatearPesos, normalizarSlug, oSinDato,
} from './comercialConstantes';

const VISTAS = [
  { id: 'lista', label: 'Puntos de contacto' },
  { id: 'ranking', label: 'Ranking' },
];

// Sub-pestaña "Puntos de contacto" del CRM (backend PR #183).
//
// QUÉ ES UN PUNTO DE CONTACTO: una entidad nuestra con su propio id, su
// `slug`, su URL corta y su QR imprimible. Los `utm_*` pasan a ser lo que el
// redirector AGREGA al destino, no lo que esperamos que venga del navegador
// — que es el motivo del módulo: un QR impreso que alguien escanea, copia y
// reenvía por WhatsApp pierde toda la atribución basada en UTM.
const PuntosContactoPanel = ({ token }) => {
  const [vista, setVista] = useState('lista');
  const [detalleId, setDetalleId] = useState(null);

  if (detalleId) {
    return <DetallePunto token={token} puntoId={detalleId} onVolver={() => setDetalleId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Puntos de contacto</h2>
          <p className="text-slate-400 text-sm mt-1">
            De dónde viene cada lead: un QR propio por mostrador, canal o campaña.
          </p>
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
        ? <ListaPuntos token={token} onAbrir={setDetalleId} />
        : <RankingPuntos token={token} onAbrir={setDetalleId} />}
    </div>
  );
};

// Índice id -> nombre de proveedor. El backend devuelve `proveedor_id` y no
// el nombre, así que se cruza acá contra el padrón de Dirección. Si esa
// carga falla, la columna dice "sin dato todavía" y NO el id crudo: un UUID
// en una tabla comercial no le dice nada a nadie.
const useProveedores = (token) => {
  const [porId, setPorId] = useState(null);
  useEffect(() => {
    let vivo = true;
    listarProveedores(token, { limit: 500 })
      .then((filas) => {
        if (!vivo) return;
        setPorId(Object.fromEntries(filas.map((p) => [p.id, p.nombre])));
      })
      .catch(() => { if (vivo) setPorId({}); });
    return () => { vivo = false; };
  }, [token]);
  return porId;
};

const NombreProveedor = ({ porId, id }) => {
  if (!id) return <span className="text-slate-500">{SIN_DATO}</span>;
  if (porId === null) return <span className="text-slate-500">…</span>;
  const nombre = porId[id];
  if (!nombre) return <span className="text-slate-500">{SIN_DATO}</span>;
  return <span className="text-slate-300">{nombre}</span>;
};

// Celda de una métrica. Un `undefined` (el ranking no cargó) NO es un cero:
// se escribe "sin dato todavía". Un 0 que sí vino del backend se muestra
// como 0, porque ahí el cero es el dato.
const Metrica = ({ valor, formato }) => {
  if (valor === null || valor === undefined) {
    return <span className="text-slate-500 text-xs">{SIN_DATO}</span>;
  }
  return <span className="text-slate-200">{formato ? formato(valor) : valor}</span>;
};

const ListaPuntos = ({ token, onAbrir }) => {
  const [items, setItems] = useState([]);
  const [metricas, setMetricas] = useState(null);
  const [activo, setActivo] = useState('');
  const [riesgo, setRiesgo] = useState('');
  const [tipoPunto, setTipoPunto] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorMetricas, setErrorMetricas] = useState(null);
  const [modalAlta, setModalAlta] = useState(false);
  const [aBajar, setABajar] = useState(null);
  const proveedores = useProveedores(token);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Los tres filtros los resuelve el BACKEND
      // (GET /comercial/puntos-contacto?activo=&riesgo=&tipo_punto=), no el
      // cliente sobre la página ya traída: con el limit por default, filtrar
      // acá mostraría "ninguno coincide" cuando el buscado está más atrás.
      setItems(await listarPuntos(token, {
        activo: activo === '' ? undefined : activo,
        riesgo: riesgo || undefined,
        tipo_punto: tipoPunto || undefined,
      }));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, activo, riesgo, tipoPunto]);

  // Escaneos, leads y conversión NO vienen en el listado: `PuntoContactoOut`
  // no los declara. Los calcula `/ranking`, que devuelve las métricas de
  // TODOS los puntos vivos, así que se traen de ahí y se cruzan por id.
  //
  // EN UN PEDIDO APARTE y con su propio error: que el ranking falle no puede
  // dejar sin tabla a quien sólo quiere ver a dónde apunta un QR.
  const cargarMetricas = useCallback(async () => {
    setErrorMetricas(null);
    try {
      const filas = await rankingPuntos(token, { limite: 500 });
      setMetricas(Object.fromEntries(filas.map((f) => [f.punto_contacto_id, f])));
    } catch (err) { setErrorMetricas(err.message); setMetricas(null); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarMetricas(); }, [cargarMetricas]);

  const hayFiltro = Boolean(activo !== '' || riesgo || tipoPunto);

  const confirmarBaja = async () => {
    try {
      await darDeBajaPunto(token, aBajar.id);
      setABajar(null);
      cargar();
      cargarMetricas();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-6">
      {errorMetricas && (
        <ErrorCarga
          mensaje={errorMetricas}
          que="las métricas de los puntos"
          onReintentar={cargarMetricas}
        />
      )}

      <div className="flex items-end gap-3 flex-wrap">
        <Campo label="Tipo">
          <select
            aria-label="Tipo"
            className={inputClase + ' min-w-[170px]'}
            value={tipoPunto}
            onChange={(e) => setTipoPunto(e.target.value)}
          >
            <option value="">Todos</option>
            {TIPOS_PUNTO.map((t) => <option key={t} value={t}>{etiquetaPunto(t)}</option>)}
          </select>
        </Campo>
        <Campo label="Riesgo">
          <select
            aria-label="Riesgo"
            className={inputClase + ' min-w-[160px]'}
            value={riesgo}
            onChange={(e) => setRiesgo(e.target.value)}
          >
            <option value="">Todos</option>
            {RIESGOS_PUNTO.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Campo>
        <Campo label="Activo">
          <select
            aria-label="Activo"
            className={inputClase + ' min-w-[150px]'}
            value={activo}
            onChange={(e) => setActivo(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="true">Sólo activos</option>
            <option value="false">Sólo apagados</option>
          </select>
        </Campo>
        <button className={botonPrimario + ' ml-auto'} onClick={() => setModalAlta(true)}>
          Nuevo punto de contacto
        </button>
      </div>

      {error && !loading && <ErrorCarga mensaje={error} que="los puntos de contacto" onReintentar={cargar} />}

      <Panel>
        {loading ? (
          <Cargando texto="Cargando puntos de contacto…" />
        ) : error ? null : items.length === 0 ? (
          <EstadoVacio
            icono="qr-code"
            titulo={hayFiltro
              ? 'Ningún punto de contacto coincide con el filtro'
              : 'Todavía no hay puntos de contacto. Creá el primero'}
            detalle={hayFiltro
              ? 'Probá con otro tipo, riesgo o estado.'
              : 'Un punto por mostrador, canal o campaña: cada uno con su QR imprimible.'}
            accion={!hayFiltro
              ? <button className={botonPrimario} onClick={() => setModalAlta(true)}>Crear el primero</button>
              : null}
          />
        ) : (
          <Tabla columnas={[
            'Slug', 'Nombre', 'Tipo', 'Riesgo', 'Destino', 'Proveedor',
            'Activo', 'Vence', 'Escaneos', 'Leads', 'Conversión', '',
          ]}>
            {items.map((p) => {
              const m = metricas?.[p.id];
              const vigencia = estadoDeVigencia(p);
              return (
                <tr key={p.id}>
                  <td className="px-4 py-2.5">
                    <button
                      className="font-mono text-blue-300 hover:text-blue-200 text-left"
                      onClick={() => onAbrir(p.id)}
                    >
                      {p.slug}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-white">{p.nombre}</td>
                  <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{etiquetaPunto(p.tipo_punto)}</td>
                  <td className="px-4 py-2.5"><Badge valor={p.riesgo} /></td>
                  <td className="px-4 py-2.5 max-w-[220px]">
                    <p className="text-slate-400 text-xs">{etiquetaPunto(p.destino_tipo)}</p>
                    {p.destino_url && (
                      <a
                        href={p.destino_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-300 hover:text-blue-200 text-xs truncate block"
                        title={p.destino_url}
                      >
                        {p.destino_url}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    <NombreProveedor porId={proveedores} id={p.proveedor_id} />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${vigencia.clase}`}>
                      {vigencia.texto}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                    {p.vence_el ? fechaCorta(p.vence_el) : <span className="text-slate-500">Sin vencimiento</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap"><Metrica valor={m?.escaneos} /></td>
                  <td className="px-4 py-2.5 whitespace-nowrap"><Metrica valor={m?.leads} /></td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Metrica valor={m?.conversion_pct} formato={formatearPct} />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {!p.deleted_at && (
                      <button className="text-red-300 hover:text-red-200 text-xs" onClick={() => setABajar(p)}>
                        Dar de baja
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Tabla>
        )}
      </Panel>

      {modalAlta && (
        <ModalPunto
          token={token}
          onCerrar={() => setModalAlta(false)}
          onGuardado={() => { setModalAlta(false); cargar(); cargarMetricas(); }}
        />
      )}

      {aBajar && (
        <Modal title="Dar de baja el punto de contacto" onClose={() => setABajar(null)}>
          <p className="text-slate-300 text-sm">
            ¿Dar de baja <strong className="text-white">{aBajar.nombre}</strong>{' '}
            (<code className="font-mono text-blue-300">{aBajar.slug}</code>)?
          </p>
          <p className="text-slate-400 text-xs mt-2">
            Es una baja lógica: el QR deja de redirigir y la fila no se borra nunca, porque sus
            escaneos y sus leads la referencian. El histórico de por dónde entró un cliente no se
            pierde porque alguien saque el QR de la vidriera.
          </p>
          <p className="text-amber-200/90 text-xs mt-2">
            El slug <strong>no se libera</strong>: no se puede volver a usar para otro punto, porque
            le daría al nuevo los escaneos del viejo.
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
  slug: '', nombre: '', descripcion: '', tipo_punto: 'fisico', riesgo: 'MULTI',
  destino_tipo: 'landing_riesgo', destino_url: '', proveedor_id: '',
  comision_referido_pct: '', responsable: '', ubicacion: '', campania: '',
  utm_source: '', utm_medium: '', utm_campaign: '', activo: true, vence_el: '',
};

const ModalPunto = ({ token, punto, onCerrar, onGuardado }) => {
  const editando = Boolean(punto);
  const [form, setForm] = useState(() => (punto
    ? {
      ...FORM_VACIO,
      ...Object.fromEntries(Object.entries(punto).filter(([k]) => k in FORM_VACIO)),
      comision_referido_pct: punto.comision_referido_pct ?? '',
      vence_el: punto.vence_el ?? '',
      proveedor_id: punto.proveedor_id ?? '',
      descripcion: punto.descripcion ?? '',
    }
    : FORM_VACIO));
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [proveedores, setProveedores] = useState([]);

  useEffect(() => {
    listarProveedores(token, { estado: 'ACTIVO', limit: 500 })
      .then(setProveedores)
      .catch(() => setProveedores([]));
  }, [token]);

  const texto = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const check = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.checked }));

  // Se valida ANTES de mandar porque el slug no se puede cambiar después: no
  // hay PATCH de `slug` (viaja impreso en un QR que ya está pegado en una
  // pared). Un 422 del servidor avisaría igual, pero recién después de que
  // la persona llenó el resto del formulario.
  const problemaSlug = editando ? null : errorDeSlug(form.slug);

  const enviar = async (e) => {
    e.preventDefault();
    if (problemaSlug) { setError(problemaSlug); return; }
    setGuardando(true); setError(null);
    const vacioANull = (v) => (v === '' || v === undefined ? null : v);
    const cuerpo = {
      nombre: form.nombre,
      descripcion: vacioANull(form.descripcion),
      tipo_punto: form.tipo_punto,
      riesgo: form.riesgo,
      destino_tipo: form.destino_tipo,
      destino_url: form.destino_url,
      proveedor_id: vacioANull(form.proveedor_id),
      comision_referido_pct: form.comision_referido_pct === ''
        ? null : String(form.comision_referido_pct),
      responsable: vacioANull(form.responsable),
      ubicacion: vacioANull(form.ubicacion),
      campania: vacioANull(form.campania),
      utm_source: vacioANull(form.utm_source),
      utm_medium: vacioANull(form.utm_medium),
      utm_campaign: vacioANull(form.utm_campaign),
      activo: Boolean(form.activo),
      vence_el: vacioANull(form.vence_el),
    };
    try {
      if (editando) {
        // SIN `slug`: PuntoContactoPatch no lo declara.
        await editarPunto(token, punto.id, cuerpo);
      } else {
        await crearPunto(token, { ...cuerpo, slug: normalizarSlug(form.slug) });
      }
      onGuardado();
    } catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  };

  return (
    <Modal
      title={editando ? 'Editar punto de contacto' : 'Nuevo punto de contacto'}
      onClose={onCerrar}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={enviar} className="space-y-4">
        {error && <ErrorCarga mensaje={error} que="guardar el punto de contacto" />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo
            label="Slug"
            ayuda={editando
              ? 'No se puede cambiar: viaja impreso en el QR.'
              : 'Se guarda en minúsculas. Lo que se imprime en el QR y no se puede cambiar después.'}
          >
            <input
              className={inputClase + ' font-mono' + (problemaSlug && form.slug ? ' border-red-500' : '')}
              value={form.slug}
              onChange={texto('slug')}
              disabled={editando}
              maxLength={32}
              placeholder="jefa-auto"
              required={!editando}
            />
          </Campo>
          <Campo label="Nombre">
            <input className={inputClase} value={form.nombre} onChange={texto('nombre')} required maxLength={120} />
          </Campo>
          <Campo label="Tipo">
            <select className={inputClase} value={form.tipo_punto} onChange={texto('tipo_punto')}>
              {TIPOS_PUNTO.map((t) => <option key={t} value={t}>{etiquetaPunto(t)}</option>)}
            </select>
          </Campo>
          <Campo label="Riesgo">
            <select className={inputClase} value={form.riesgo} onChange={texto('riesgo')}>
              {RIESGOS_PUNTO.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Campo>
          <Campo label="Tipo de destino">
            <select className={inputClase} value={form.destino_tipo} onChange={texto('destino_tipo')}>
              {DESTINOS_TIPO.map((d) => <option key={d} value={d}>{etiquetaPunto(d)}</option>)}
            </select>
          </Campo>
          <Campo
            label="Proveedor"
            ayuda="El canal por el que entra este negocio, si lo hay."
          >
            <select className={inputClase} value={form.proveedor_id} onChange={texto('proveedor_id')}>
              <option value="">—</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
        </div>

        <Campo
          label="URL de destino"
          ayuda="Tiene que empezar con http:// o https://: es a dónde se redirige a quien escanea."
        >
          <input
            type="url"
            className={inputClase}
            value={form.destino_url}
            onChange={texto('destino_url')}
            placeholder="https://aymaseguros.com.ar/seguro-auto"
            required
          />
        </Campo>

        <Campo label="Descripción">
          <textarea className={inputClase} rows={2} value={form.descripcion} onChange={texto('descripcion')} />
        </Campo>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Responsable">
            <input className={inputClase} value={form.responsable} onChange={texto('responsable')} maxLength={120} />
          </Campo>
          <Campo label="Ubicación">
            <input className={inputClase} value={form.ubicacion} onChange={texto('ubicacion')} maxLength={200} />
          </Campo>
          <Campo label="Campaña">
            <input className={inputClase} value={form.campania} onChange={texto('campania')} maxLength={80} />
          </Campo>
          <Campo label="Comisión de referido (%)" ayuda="0 a 100.">
            <input
              type="number" step="0.01" min="0" max="100"
              className={inputClase}
              value={form.comision_referido_pct}
              onChange={texto('comision_referido_pct')}
            />
          </Campo>
          <Campo label="Vence el" ayuda="Vacío = sin vencimiento.">
            <input type="date" className={inputClase} value={form.vence_el || ''} onChange={texto('vence_el')} />
          </Campo>
        </div>

        <fieldset className="border border-slate-700 rounded-lg p-3">
          <legend className="px-1 text-slate-400 text-xs">
            UTM que el redirector agrega al destino
          </legend>
          <p className="text-slate-500 text-[11px] mb-3">
            No pisan los que el destino ya traiga cargados a mano: el del punto es un default, no
            una corrección.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Campo label="utm_source">
              <input className={inputClase} value={form.utm_source} onChange={texto('utm_source')} maxLength={80} />
            </Campo>
            <Campo label="utm_medium">
              <input className={inputClase} value={form.utm_medium} onChange={texto('utm_medium')} maxLength={80} />
            </Campo>
            <Campo label="utm_campaign">
              <input className={inputClase} value={form.utm_campaign} onChange={texto('utm_campaign')} maxLength={80} />
            </Campo>
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={form.activo} onChange={check('activo')} />
          Activo (el redirector lo atiende)
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
          <button type="submit" className={botonPrimario} disabled={guardando}>
            {guardando ? 'Guardando…' : (editando ? 'Guardar cambios' : 'Crear punto')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const Dato = ({ label, children }) => (
  <div>
    <p className="text-slate-500 text-xs">{label}</p>
    <div className="text-slate-200 text-sm mt-0.5">{children ?? SIN_DATO}</div>
  </div>
);

const Kpi = ({ label, valor, detalle }) => (
  <div className="px-4 py-3">
    <p className="text-slate-400 text-xs">{label}</p>
    <p className="text-2xl font-bold text-white mt-0.5">{valor}</p>
    {detalle && <p className="text-slate-500 text-[11px] mt-0.5">{detalle}</p>}
  </div>
);

const DetallePunto = ({ token, puntoId, onVolver }) => {
  const [punto, setPunto] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorMetricas, setErrorMetricas] = useState(null);
  const [editando, setEditando] = useState(false);
  const proveedores = useProveedores(token);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try { setPunto(await obtenerPunto(token, puntoId)); }
    catch (err) { setError(err.message); setPunto(null); }
    finally { setLoading(false); }
  }, [token, puntoId]);

  const cargarMetricas = useCallback(async () => {
    setErrorMetricas(null);
    try { setMetricas(await metricasPunto(token, puntoId)); }
    catch (err) { setErrorMetricas(err.message); setMetricas(null); }
  }, [token, puntoId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarMetricas(); }, [cargarMetricas]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onVolver} className={botonSecundario + ' flex items-center gap-2'}>
            <Icon name="arrow-left" size={16} /> Puntos de contacto
          </button>
          <h2 className="text-2xl font-bold truncate">{punto?.nombre || 'Punto de contacto'}</h2>
          {punto && (() => {
            const v = estadoDeVigencia(punto);
            return (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.clase}`}>{v.texto}</span>
            );
          })()}
        </div>
        {punto && <button className={botonPrimario} onClick={() => setEditando(true)}>Editar</button>}
      </div>

      {error && <ErrorCarga mensaje={error} que="el punto de contacto" onReintentar={cargar} />}
      {loading && <Cargando />}

      {punto && (
        <>
          <BloqueQr token={token} punto={punto} />

          <Panel
            titulo="Embudo"
            subtitulo="Acumulado desde el alta del punto. El backend no acepta un rango de fechas en este endpoint."
            acciones={(
              <button className={botonSecundario} onClick={cargarMetricas}>
                <Icon name="arrow-path" size={14} className="inline mr-1" /> Actualizar
              </button>
            )}
          >
            {errorMetricas ? (
              <div className="p-4">
                <ErrorCarga mensaje={errorMetricas} que="las métricas" onReintentar={cargarMetricas} />
              </div>
            ) : !metricas ? (
              <Cargando texto="Cargando métricas…" />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-slate-700/60">
                  <Kpi label="Escaneos" valor={metricas.escaneos} />
                  <Kpi label="Leads" valor={metricas.leads} />
                  <Kpi label="Conversión" valor={formatearPct(metricas.conversion_pct)} detalle="leads / escaneos" />
                  <Kpi label="Cotizaciones" valor={metricas.cotizaciones} />
                  <Kpi label="Emisiones" valor={metricas.emisiones} />
                  <Kpi label="Emisión" valor={formatearPct(metricas.emision_pct)} detalle="emisiones / leads" />
                </div>
                <div className="px-4 py-3 border-t border-slate-700 flex flex-wrap gap-6">
                  <div>
                    <p className="text-slate-400 text-xs">Comisión estimada (devengada)</p>
                    <p className="text-lg font-bold text-white">{formatearPesos(metricas.comision_estimada)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Comisión liquidada</p>
                    <p className="text-lg font-bold text-white">{formatearPesos(metricas.comision_liquidada)}</p>
                  </div>
                </div>
                {/* El backend declara la fuente EN LA RESPUESTA a propósito:
                    cotizaciones y emisiones salen del estado del lead, no de
                    una tabla de pólizas. Quien lee el número tiene que poder
                    saber qué está contando sin abrir el código. */}
                <p className="px-4 pb-3 text-slate-500 text-[11px]">
                  Cotizaciones y emisiones se cuentan por el estado del lead (fuente:{' '}
                  <code className="text-slate-400">{metricas.fuente}</code>), no por la tabla de
                  pólizas. La comisión estimada es lo devengado y no se suma con lo liquidado: son
                  dos números distintos.
                </p>
              </>
            )}
          </Panel>

          <Panel titulo="Datos">
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Dato label="Slug"><code className="font-mono text-blue-300">{punto.slug}</code></Dato>
              <Dato label="Tipo">{etiquetaPunto(punto.tipo_punto)}</Dato>
              <Dato label="Riesgo"><Badge valor={punto.riesgo} /></Dato>
              <Dato label="Tipo de destino">{etiquetaPunto(punto.destino_tipo)}</Dato>
              <div className="sm:col-span-2">
                <Dato label="URL de destino">
                  {punto.destino_url
                    ? (
                      <a
                        href={punto.destino_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-300 hover:text-blue-200 inline-flex items-center gap-1 break-all"
                      >
                        {punto.destino_url} <Icon name="arrow-top-right-on-square" size={14} />
                      </a>
                    )
                    : SIN_DATO}
                </Dato>
              </div>
              <Dato label="Proveedor"><NombreProveedor porId={proveedores} id={punto.proveedor_id} /></Dato>
              <Dato label="Responsable">{oSinDato(punto.responsable)}</Dato>
              <Dato label="Ubicación">{oSinDato(punto.ubicacion)}</Dato>
              <Dato label="Campaña">{oSinDato(punto.campania)}</Dato>
              <Dato label="Comisión de referido">{formatearPctCampo(punto.comision_referido_pct)}</Dato>
              <Dato label="Vence el">
                {punto.vence_el ? fechaCorta(punto.vence_el) : 'Sin vencimiento'}
              </Dato>
              <Dato label="utm_source">{oSinDato(punto.utm_source)}</Dato>
              <Dato label="utm_medium">{oSinDato(punto.utm_medium)}</Dato>
              <Dato label="utm_campaign">{oSinDato(punto.utm_campaign)}</Dato>
              <div className="sm:col-span-2 lg:col-span-3">
                <Dato label="Descripción">{oSinDato(punto.descripcion)}</Dato>
              </div>
            </div>
          </Panel>
        </>
      )}

      {editando && punto && (
        <ModalPunto
          token={token}
          punto={punto}
          onCerrar={() => setEditando(false)}
          onGuardado={() => { setEditando(false); cargar(); cargarMetricas(); }}
        />
      )}
    </div>
  );
};

// Tamaños ofrecidos para la descarga. El backend acota `size` a 64–2000 (sin
// tope, un `?size=100000` sería un OOM servido por nosotros), así que el
// mayor de acá es su máximo: es el que sirve para imprenta.
const TAMANOS_QR = [
  { valor: 512, label: 'Pantalla (512 px)' },
  { valor: 1024, label: 'Impresión (1024 px)' },
  { valor: 2000, label: 'Imprenta (2000 px)' },
];

const BloqueQr = ({ token, punto }) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const [bajando, setBajando] = useState(false);
  const [tamano, setTamano] = useState(2000);
  const [copiado, setCopiado] = useState(false);

  // EL PNG NO PUEDE IR EN UN `<img src>` DIRECTO: el endpoint cuelga de
  // require_admin y un `<img>` no manda Authorization, así que volvería 401
  // y el navegador pintaría el ícono de imagen rota. Se baja como blob con
  // el token y se arma una object URL, que se revoca al desmontar.
  useEffect(() => {
    let url = null;
    let vivo = true;
    setError(null);
    descargarQrPunto(token, punto.id, 512)
      .then((blob) => {
        if (!vivo) return;
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      })
      .catch((err) => { if (vivo) setError(err.message); });
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [token, punto.id]);

  const bajar = async () => {
    setBajando(true); setError(null);
    let url = null;
    try {
      const blob = await descargarQrPunto(token, punto.id, tamano);
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${punto.slug}-${tamano}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) { setError(err.message); }
    finally {
      // Se revoca SIEMPRE, también en el camino feliz: la descarga ya tomó
      // los bytes y dejar la object URL viva retiene el PNG entero en
      // memoria hasta que se recargue la página.
      if (url) URL.revokeObjectURL(url);
      setBajando(false);
    }
  };

  const copiarUrl = async () => {
    try {
      await navigator.clipboard.writeText(punto.url_corta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sin portapapeles: la URL está a la vista igual */ }
  };

  return (
    <Panel
      titulo="QR y URL corta"
      subtitulo="Corrección de error nivel H (30%): se imprime, se pega y le quedan dedos encima."
    >
      <div className="p-4 flex flex-col sm:flex-row gap-6">
        <div className="shrink-0">
          {error ? (
            <div className="w-40 h-40 rounded-lg border border-red-500/50 bg-red-500/10 flex items-center justify-center text-center p-3">
              <p className="text-red-200 text-xs">No se pudo cargar el QR. {error}</p>
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={`Código QR del punto de contacto ${punto.slug}`}
              className="w-40 h-40 rounded-lg bg-white p-2"
            />
          ) : (
            <div className="w-40 h-40 rounded-lg border border-slate-700 bg-slate-900 flex items-center justify-center">
              <Icon name="qr-code" size={32} className="text-slate-600 animate-pulse" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-slate-500 text-xs">URL corta</p>
            {punto.url_corta ? (
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <code className="font-mono text-blue-300 break-all">{punto.url_corta}</code>
                <button
                  type="button"
                  onClick={copiarUrl}
                  className="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs transition"
                >
                  {copiado ? 'Copiada' : 'Copiar'}
                </button>
              </div>
            ) : (
              <p className="text-slate-500 text-sm mt-1">{SIN_DATO}</p>
            )}
            <p className="text-slate-500 text-[11px] mt-1">
              Se puede tipear a mano cuando la cámara no engancha, y por eso el slug va en
              minúsculas.
            </p>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <Campo label="Tamaño">
              <select
                aria-label="Tamaño"
                className={inputClase + ' min-w-[190px]'}
                value={tamano}
                onChange={(e) => setTamano(Number(e.target.value))}
              >
                {TAMANOS_QR.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
              </select>
            </Campo>
            <button className={botonPrimario + ' flex items-center gap-2'} onClick={bajar} disabled={bajando}>
              <Icon name="arrow-down-tray" size={16} />
              {bajando ? 'Bajando…' : 'Descargar QR'}
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
};

const RankingPuntos = ({ token, onAbrir }) => {
  const [orden, setOrden] = useState('leads');
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // EL ORDEN LO RESUELVE EL BACKEND (`?orden=leads|conversion`), no un sort
  // en el cliente: es una lista cerrada allá (armar SQL con el parámetro
  // sería inyección) y además desempata por escaneos y slug, así que un
  // ranking con dos puntos en 0 no se mueve solo entre pedidos.
  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try { setFilas(await rankingPuntos(token, { orden })); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, orden]);

  useEffect(() => { cargar(); }, [cargar]);

  const totales = useMemo(() => filas.reduce(
    (acc, f) => ({ escaneos: acc.escaneos + (f.escaneos || 0), leads: acc.leads + (f.leads || 0) }),
    { escaneos: 0, leads: 0 },
  ), [filas]);

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3 flex-wrap">
        <Campo label="Ordenar por">
          <select
            aria-label="Ordenar por"
            className={inputClase + ' min-w-[190px]'}
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
          >
            {ORDENES_RANKING.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Campo>
        <p className="text-slate-500 text-xs pb-2.5 max-w-md">
          Los dos órdenes y no uno solo: el que más leads trae puede ser el del lugar con más
          tránsito, y el de mejor conversión el que trae menos pero mejores.
        </p>
      </div>

      {error && !loading && <ErrorCarga mensaje={error} que="el ranking" onReintentar={cargar} />}

      <Panel
        titulo="Ranking de puntos"
        subtitulo="Acumulado desde el alta de cada punto. Sólo puntos vivos."
      >
        {loading ? (
          <Cargando texto="Cargando ranking…" />
        ) : error ? null : filas.length === 0 ? (
          <EstadoVacio
            icono="chart-bar"
            titulo="Todavía no hay puntos que rankear"
            detalle="Creá un punto de contacto y su QR para empezar a medir."
          />
        ) : (
          <>
            <Tabla columnas={[
              '#', 'Slug', 'Nombre', 'Escaneos', 'Leads', 'Conversión',
              'Cotizaciones', 'Emisiones', 'Emisión', 'Comisión devengada',
            ]}>
              {filas.map((f, i) => (
                <tr key={f.punto_contacto_id}>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <button
                      className="font-mono text-blue-300 hover:text-blue-200"
                      onClick={() => onAbrir(f.punto_contacto_id)}
                    >
                      {f.slug}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-white">{f.nombre}</td>
                  <td className="px-4 py-2.5 text-slate-200">{f.escaneos}</td>
                  <td className="px-4 py-2.5 text-slate-200">{f.leads}</td>
                  <td className="px-4 py-2.5 text-slate-200 whitespace-nowrap">{formatearPct(f.conversion_pct)}</td>
                  <td className="px-4 py-2.5 text-slate-200">{f.cotizaciones}</td>
                  <td className="px-4 py-2.5 text-slate-200">{f.emisiones}</td>
                  <td className="px-4 py-2.5 text-slate-200 whitespace-nowrap">{formatearPct(f.emision_pct)}</td>
                  <td className="px-4 py-2.5 text-slate-200 whitespace-nowrap">{formatearPesos(f.comision_estimada)}</td>
                </tr>
              ))}
            </Tabla>
            <div className="px-4 py-3 border-t border-slate-700 flex flex-wrap gap-6">
              <div>
                <p className="text-slate-400 text-xs">Escaneos (todos los puntos)</p>
                <p className="text-lg font-bold text-white">{totales.escaneos}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Leads (todos los puntos)</p>
                <p className="text-lg font-bold text-white">{totales.leads}</p>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
};

export default PuntosContactoPanel;
