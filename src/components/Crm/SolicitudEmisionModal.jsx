import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../Modal';
import { Icon } from '../Icons';
import { fechaHora } from '../../utils/fechas';
import {
  ESTADOS_LINK_VIVO, ESTADO_LABEL, generarSolicitud, listarSolicitudes,
  qrDataUri, revocarSolicitud,
} from './emisionApi';

// "Pedir datos para emitir" (QR-EMI, C-6c): el link firmado, su QR y el
// texto de WhatsApp, desde la ficha de la oportunidad.
//
// AL MONTAR NO SE GENERA NADA. El modal abre en modo consulta: pregunta por
// las solicitudes que ya existen y, si hay una viva, muestra su estado y su
// vencimiento ANTES de ofrecer generar otra. Generar es un POST irreversible
// -revoca el link anterior, que puede estar circulando por WhatsApp-, así
// que lo dispara un clic y, si hay una viva, un segundo clic de confirmación.
//
// UN SOLO POST POR CLIC (H-66). `generando` es la guarda de reentrada: se
// levanta ANTES del await y el botón queda deshabilitado. Sin eso, un doble
// clic genera dos links y el primero -el que ya se copió o se mandó- queda
// revocado por el segundo sin que nadie se entere.
//
// EL TOKEN EN CLARO VIVE SÓLO EN ESTA PANTALLA. El backend devuelve la URL
// una única vez; no se persiste ni se vuelve a pedir. Por eso el modal no
// se cierra solo al generar y el link queda a la vista con "Copiar".
const SolicitudEmisionModal = ({ token, oportunidad, onCerrar, onCambio }) => {
  const [previas, setPrevias] = useState(null);
  const [errorPrevias, setErrorPrevias] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [creada, setCreada] = useState(null);
  const [error, setError] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [revocando, setRevocando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [form, setForm] = useState({ marca: '', modelo: '', anio: '', compania: '' });

  const cargarPrevias = useCallback(async () => {
    setErrorPrevias(null);
    try {
      setPrevias(await listarSolicitudes(token, { oportunidad_id: oportunidad.id, limit: 20 }));
    } catch (err) {
      setPrevias([]);
      setErrorPrevias(err.message);
    }
  }, [token, oportunidad.id]);

  useEffect(() => { cargarPrevias(); }, [cargarPrevias]);

  // Una solicitud "viva" es la que todavía puede abrirse con el link que el
  // cliente tiene en la mano. `vencida` lo calcula el backend contra su
  // reloj: el del navegador puede estar corrido.
  const viva = (previas || []).find(
    (s) => ESTADOS_LINK_VIVO.includes(s.estado) && !s.vencida,
  );

  const set = (campo) => (e) => setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  const generar = async () => {
    if (generando) return;          // guarda de reentrada (H-66)
    setGenerando(true);
    setError(null);
    setAviso(null);
    try {
      const anio = form.anio.trim() ? Number(form.anio.trim()) : null;
      const respuesta = await generarSolicitud(token, oportunidad.id, {
        vehiculo_marca: form.marca.trim() || null,
        vehiculo_modelo: form.modelo.trim() || null,
        vehiculo_anio: Number.isFinite(anio) && anio ? anio : null,
        compania: form.compania.trim() || null,
      });
      setCreada(respuesta);
      setConfirmando(false);
      await cargarPrevias();
      if (onCambio) onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerando(false);
    }
  };

  const pedirGenerar = () => {
    setError(null);
    if (viva && !confirmando) { setConfirmando(true); return; }
    generar();
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(creada.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sin portapapeles: el link está a la vista igual */ }
  };

  const revocar = async () => {
    if (revocando) return;          // guarda de reentrada (H-66)
    const id = creada?.solicitud?.id || viva?.id;
    if (!id) return;
    setRevocando(true);
    setError(null);
    try {
      await revocarSolicitud(token, id, 'Revocada desde la ficha de la oportunidad');
      setCreada(null);
      setAviso('El link quedó revocado: ya no abre el formulario.');
      await cargarPrevias();
      if (onCambio) onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setRevocando(false);
    }
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm';

  return (
    <Modal title="Pedir datos para emitir" onClose={onCerrar} maxWidth="max-w-xl" zClass="z-[60]">
      <div className="space-y-5">
        <p className="text-slate-400 text-sm">
          El cliente carga DNI, datos de cobro y fotos en un formulario de AYMA, cifrado y
          pendiente de aprobación. El link vence a las 72 h y es de un solo uso.
        </p>

        {errorPrevias && (
          <div className="bg-amber-500/15 border border-amber-500/40 text-amber-200 px-4 py-2 rounded-lg text-sm">
            No se pudieron leer las solicitudes anteriores: {errorPrevias}
          </div>
        )}

        {viva && !creada && (
          <div className="bg-blue-500/10 border border-blue-500/40 rounded-lg px-4 py-3 text-sm space-y-1">
            <p className="text-blue-200 font-medium">
              Ya hay un link activo: {ESTADO_LABEL[viva.estado] || viva.estado}
            </p>
            <p className="text-slate-300">Vence el {fechaHora(viva.vence_en)}</p>
            <p className="text-amber-200">Generar uno nuevo invalida el anterior.</p>
          </div>
        )}

        {aviso && (
          <div className="bg-slate-700/60 border border-slate-600 text-slate-200 px-4 py-2 rounded-lg text-sm">
            {aviso}
          </div>
        )}

        {!creada && (
          <>
            {/* EL VEHÍCULO SE PASA, NO SE ADIVINA: la oportunidad guarda la
                patente y no marca/modelo/año, y la patente es justamente lo
                que el formulario público NO puede mostrar. Sin estos campos
                el formulario no muestra vehículo, que es mejor que inventarlo. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 text-sm mb-2" htmlFor="emi-marca">Marca</label>
                <input id="emi-marca" type="text" value={form.marca} onChange={set('marca')} className={inputClass} />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2" htmlFor="emi-modelo">Modelo</label>
                <input id="emi-modelo" type="text" value={form.modelo} onChange={set('modelo')} className={inputClass} />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2" htmlFor="emi-anio">Año</label>
                <input id="emi-anio" type="number" value={form.anio} onChange={set('anio')} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2" htmlFor="emi-compania">Compañía</label>
              <input id="emi-compania" type="text" value={form.compania} onChange={set('compania')} className={inputClass} />
              <p className="text-slate-500 text-xs mt-1">Decide qué fotos pide el formulario.</p>
            </div>

            {confirmando && (
              <div className="bg-amber-500/15 border border-amber-500/40 text-amber-100 px-4 py-3 rounded-lg text-sm">
                Generar uno nuevo invalida el anterior. ¿Confirmás?
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={pedirGenerar}
                disabled={generando}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
              >
                <Icon name="qr-code" size={16} />
                {generando
                  ? 'Generando…'
                  : confirmando ? 'Confirmar y generar uno nuevo' : (viva ? 'Generar un link nuevo' : 'Generar link')}
              </button>
              {confirmando && (
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
                >
                  Cancelar
                </button>
              )}
            </div>
          </>
        )}

        {creada && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-5">
              <img
                src={qrDataUri(creada.qr_png_base64)}
                alt="Código QR del formulario de emisión"
                className="w-40 h-40 rounded-lg bg-white p-2 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-slate-500 text-xs">Link del formulario</p>
                  <code className="font-mono text-blue-300 text-sm break-all">{creada.url}</code>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={copiar}
                    className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition"
                  >
                    {copiado ? 'Link copiado' : 'Copiar link'}
                  </button>
                  {/* Sin teléfono cargado el backend no arma el wa.me y no se
                      inventa uno: queda el texto para copiar, que es lo que
                      igual hay que poder hacer. */}
                  {creada.url_whatsapp ? (
                    <a
                      href={creada.url_whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm transition"
                    >
                      <Icon name="chat-bubble" size={16} />
                      Abrir WhatsApp
                    </a>
                  ) : (
                    <span className="px-3 py-2 text-slate-500 text-xs self-center">
                      El contacto no tiene teléfono cargado: copiá el link.
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-sm">
                  Vence el <span className="text-white">{fechaHora(creada.solicitud?.vence_en)}</span>
                </p>
                {creada.revocadas?.length > 0 && (
                  <p className="text-amber-200 text-xs">
                    Quedó revocado el link anterior ({creada.revocadas.length}).
                  </p>
                )}
              </div>
            </div>

            <details className="bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-3">
              <summary className="text-slate-300 text-sm cursor-pointer">Texto para WhatsApp</summary>
              <p className="text-slate-400 text-sm mt-2 whitespace-pre-wrap">{creada.texto_whatsapp}</p>
            </details>

            <button
              type="button"
              onClick={revocar}
              disabled={revocando}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-red-600/40 disabled:opacity-50 text-sm transition"
            >
              {revocando ? 'Revocando…' : 'Revocar link'}
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}
      </div>
    </Modal>
  );
};

export default SolicitudEmisionModal;
