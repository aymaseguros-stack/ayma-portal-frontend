import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../Modal';
import { Icon } from '../Icons';
import { fechaHora } from '../../utils/fechas';
import {
  ESTADOS_REVISABLES, ESTADOS_SOLICITUD, ESTADO_BADGE, ESTADO_LABEL,
  aprobarSolicitud, bajarBlob, descargarAdjuntoSolicitud, listarSolicitudes,
  observarSolicitud, qrDataUri, resolverOportunidades, verSolicitud,
} from './emisionApi';

// CRM → "Solicitudes de emisión" (QR-EMI, C-6c): la cola de revisión de lo
// que los clientes cargaron en el formulario firmado.
//
// LO QUE ESTA PANTALLA NO HACE AL ABRIRSE es tan importante como lo que
// hace. Lista solicitudes -que no llevan un solo dato del formulario- y
// nada más. Los datos en claro (DNI, CBU, domicilio) los sirve un endpoint
// ADMIN que deja cada acceso en `auditoria_accesos`, así que se piden con
// un clic explícito y jamás al montar el detalle: un GET automático
// llenaría la bitácora de accesos que nadie pidió y volvería inútil el
// único rastro que importa.
//
// PENDIENTE_REVISION PRIMERO porque es la única columna que es trabajo: lo
// demás es historia.
const ESTADO_INICIAL = 'PENDIENTE_REVISION';

const SolicitudesEmisionPanel = ({ token, esAdmin = false }) => {
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const [filas, setFilas] = useState([]);
  const [contexto, setContexto] = useState({});   // oportunidad_id -> {referencia, cliente}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [abierta, setAbierta] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const datos = await listarSolicitudes(token, { estado: estado || undefined, limit: 200 });
      setFilas(datos);
      // El contexto se resuelve DESPUÉS de pintar la tabla y nunca la
      // bloquea: si falla, la fila muestra el id de la oportunidad.
      const nuevas = await resolverOportunidades(token, datos.map((s) => s.oportunidad_id), contexto);
      if (Object.keys(nuevas).length > 0) setContexto((prev) => ({ ...prev, ...nuevas }));
    } catch (err) {
      setError(err.message);
      setFilas([]);
    } finally {
      setLoading(false);
    }
    // `contexto` queda FUERA de las deps a propósito: entra como caché y
    // meterlo acá haría que cada resolución dispare otra recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, estado]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Solicitudes de emisión</h2>
        <p className="text-slate-400 text-sm mt-1">
          Lo que el cliente cargó por el link firmado, esperando revisión. Los datos viajan
          cifrados y se leen con un clic que queda auditado.
        </p>
      </div>

      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-slate-400 text-sm mb-2" htmlFor="sol-estado">Estado</label>
          <select
            id="sol-estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm min-w-[220px]"
          >
            <option value="">Todos</option>
            {ESTADOS_SOLICITUD.map((e) => (
              <option key={e} value={e}>{ESTADO_LABEL[e] || e}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={cargar}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm transition"
        >
          <Icon name="arrow-path" size={16} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-slate-400 text-sm">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="text-slate-400 text-sm">No hay solicitudes con ese estado.</p>
      ) : (
        <div className="overflow-x-auto border border-slate-700 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/80 text-slate-400">
              <tr>
                <th className="text-left px-4 py-3">Oportunidad</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3">Enviada</th>
                <th className="text-left px-4 py-3">Vence</th>
                <th className="text-left px-4 py-3">Archivos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filas.map((s) => {
                const ctx = contexto[s.oportunidad_id] || {};
                return (
                  <tr key={s.id} className="border-t border-slate-700/70">
                    <td className="px-4 py-3 font-mono text-xs text-blue-300 break-all">
                      {ctx.referencia || s.oportunidad_id}
                    </td>
                    <td className="px-4 py-3">{ctx.cliente || <span className="text-slate-500">sin dato</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-md border text-xs ${ESTADO_BADGE[s.estado] || ''}`}>
                        {ESTADO_LABEL[s.estado] || s.estado}
                      </span>
                      {s.vencida && s.estado !== 'VENCIDA' && (
                        <span className="ml-2 text-amber-300 text-xs">vencida</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {s.enviada_en ? fechaHora(s.enviada_en) : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{fechaHora(s.vence_en)}</td>
                    <td className="px-4 py-3 text-slate-300">{s.archivos}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setAbierta(s)}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs transition"
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {abierta && (
        <DetalleSolicitud
          token={token}
          esAdmin={esAdmin}
          solicitud={abierta}
          contexto={contexto[abierta.oportunidad_id] || {}}
          onCerrar={() => setAbierta(null)}
          onCambio={() => { setAbierta(null); cargar(); }}
        />
      )}
    </div>
  );
};

// El detalle. Abre SIN pedir los datos en claro: lo único que trae de
// entrada es la fila del listado, que ya está en memoria.
const DetalleSolicitud = ({ token, esAdmin, solicitud, contexto, onCerrar, onCambio }) => {
  const [detalle, setDetalle] = useState(null);     // sólo tras el clic explícito
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [aprobando, setAprobando] = useState(false);
  const [observando, setObservando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [regenerar, setRegenerar] = useState(false);
  const [modoObservar, setModoObservar] = useState(false);
  const [link, setLink] = useState(null);

  const revisable = ESTADOS_REVISABLES.includes(solicitud.estado);

  // EL CLIC EXPLÍCITO. Cada llamada deja un registro en `auditoria_accesos`
  // con el id de la solicitud y de la oportunidad: por eso no hay useEffect
  // que la dispare al abrir el detalle.
  const verDatos = async () => {
    if (cargandoDatos) return;                       // guarda de reentrada
    setCargandoDatos(true);
    setError(null);
    try {
      setDetalle(await verSolicitud(token, solicitud.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoDatos(false);
    }
  };

  const aprobar = async () => {
    if (aprobando) return;                           // guarda de reentrada (H-66)
    setAprobando(true);
    setError(null);
    try {
      const r = await aprobarSolicitud(token, solicitud.id);
      setAviso(r?.detalle || (r?.hitos_aplicados
        ? 'Aprobada. Se marcaron los hitos del checklist que la solicitud prueba.'
        : 'Aprobada.'));
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setAprobando(false);
    }
  };

  const observar = async () => {
    if (observando) return;                          // guarda de reentrada (H-66)
    if (motivo.trim().length < 3) {
      setError('El motivo es obligatorio: sin él, el cliente rehace lo mismo y vuelve a rebotar.');
      return;
    }
    setObservando(true);
    setError(null);
    try {
      const r = await observarSolicitud(token, solicitud.id, {
        motivo: motivo.trim(), regenerar_link: regenerar,
      });
      if (r?.link) {
        // El link nuevo se muestra acá y no se cierra el modal: el token en
        // claro sale una sola vez y no se puede volver a pedir.
        setLink(r.link);
        setAviso(r.detalle || 'Se generó un link nuevo y el anterior quedó revocado.');
      } else {
        onCambio();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setObservando(false);
    }
  };

  const bajar = async (adjunto) => {
    setError(null);
    try {
      bajarBlob(await descargarAdjuntoSolicitud(token, adjunto), adjunto.nombre_original);
    } catch (err) {
      setError(err.message);
    }
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';

  return (
    <Modal title="Solicitud de emisión" onClose={onCerrar} maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500 text-xs">Oportunidad</p>
            <p className="font-mono text-blue-300 break-all">{contexto.referencia || solicitud.oportunidad_id}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Cliente</p>
            <p>{contexto.cliente || 'sin dato'}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Estado</p>
            <p>{ESTADO_LABEL[solicitud.estado] || solicitud.estado}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Vence</p>
            <p>{fechaHora(solicitud.vence_en)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Enviada</p>
            <p>{solicitud.enviada_en ? fechaHora(solicitud.enviada_en) : '—'}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Consentimiento</p>
            <p>
              {solicitud.consentimiento_fecha
                ? `${solicitud.consentimiento_version || 'aceptado'} · ${fechaHora(solicitud.consentimiento_fecha)}`
                : 'sin registrar'}
            </p>
          </div>
        </div>

        {solicitud.observacion && (
          <div className="bg-orange-500/10 border border-orange-500/40 text-orange-100 px-4 py-2 rounded-lg text-sm">
            Observación: {solicitud.observacion}
          </div>
        )}

        {aviso && (
          <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 px-4 py-2 rounded-lg text-sm">
            {aviso}
          </div>
        )}

        {/* DATOS EN CLARO: ADMIN y con clic explícito. Un EMPLEADO puede
            aprobar y observar sin que eso le abra la ficha completa, que es
            exactamente el reparto que hace el backend. */}
        <div className="border border-slate-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-white text-sm font-medium">Datos cargados por el cliente</p>
              <p className="text-slate-500 text-xs">
                Cada lectura queda registrada con tu usuario. No se cargan solos.
              </p>
            </div>
            {esAdmin ? (
              <button
                type="button"
                onClick={verDatos}
                disabled={cargandoDatos}
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm transition"
              >
                <Icon name="lock-closed" size={16} />
                {cargandoDatos ? 'Abriendo…' : detalle ? 'Volver a leer' : 'Ver datos cargados'}
              </button>
            ) : (
              <span className="text-slate-500 text-xs">Sólo un ADMIN puede abrirlos.</span>
            )}
          </div>

          {detalle && (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {Object.entries(detalle.datos || {}).map(([campo, valor]) => (
                  <div key={campo} className="bg-slate-900/60 rounded-lg px-3 py-2">
                    <dt className="text-slate-500 text-xs">{campo}</dt>
                    <dd className="text-slate-100 break-all">
                      {valor === null || valor === undefined || valor === ''
                        ? '—'
                        : typeof valor === 'object' ? JSON.stringify(valor) : String(valor)}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="space-y-2">
                <p className="text-slate-400 text-sm">Adjuntos ({detalle.adjuntos?.length || 0})</p>
                {(detalle.adjuntos || []).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 bg-slate-900/60 rounded-lg px-3 py-2">
                    <Icon name={a.mime?.startsWith('image/') ? 'clipboard' : 'document-text'} size={18} />
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-200 text-sm truncate">{a.nombre_original}</p>
                      <p className="text-slate-500 text-xs">{a.categoria}</p>
                    </div>
                    {a.en_drive ? (
                      <button
                        type="button"
                        onClick={() => bajar(a)}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs transition"
                      >
                        Descargar
                      </button>
                    ) : (
                      // `en_drive=false` es la subida en background que
                      // todavía no terminó (S9), no un archivo perdido.
                      <span className="text-amber-300 text-xs">todavía subiendo</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {link && (
          <div className="border border-blue-500/40 bg-blue-500/10 rounded-lg p-4 space-y-3">
            <p className="text-blue-200 text-sm font-medium">Link nuevo (se muestra una sola vez)</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <img
                src={qrDataUri(link.qr_png_base64)}
                alt="Código QR del formulario de emisión"
                className="w-32 h-32 rounded-lg bg-white p-2 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <code className="font-mono text-blue-300 text-xs break-all">{link.url}</code>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(link.url)}
                    className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition"
                  >
                    Copiar link
                  </button>
                  {link.url_whatsapp && (
                    <a
                      href={link.url_whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm transition"
                    >
                      <Icon name="chat-bubble" size={16} />
                      Abrir WhatsApp
                    </a>
                  )}
                </div>
                <p className="text-slate-400 text-xs">Vence el {fechaHora(link.solicitud?.vence_en)}</p>
              </div>
            </div>
          </div>
        )}

        {revisable && !link && (
          <div className="space-y-3">
            {modoObservar && (
              <>
                <div>
                  <label className="block text-slate-400 text-sm mb-2" htmlFor="obs-motivo">
                    Qué hay que corregir *
                  </label>
                  <textarea
                    id="obs-motivo"
                    rows={3}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <label className="flex items-center gap-2 text-slate-300 text-sm">
                  <input
                    type="checkbox"
                    checked={regenerar}
                    onChange={(e) => setRegenerar(e.target.checked)}
                  />
                  Generar un link nuevo (revoca el anterior)
                </label>
              </>
            )}

            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={aprobar}
                disabled={aprobando}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg font-semibold text-sm transition"
              >
                {aprobando ? 'Aprobando…' : 'Aprobar'}
              </button>
              <button
                type="button"
                onClick={() => (modoObservar ? observar() : setModoObservar(true))}
                disabled={observando}
                className="px-4 py-2.5 bg-orange-600/80 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold text-sm transition"
              >
                {observando ? 'Observando…' : modoObservar ? 'Confirmar observación' : 'Observar'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}
      </div>
    </Modal>
  );
};

export default SolicitudesEmisionPanel;
