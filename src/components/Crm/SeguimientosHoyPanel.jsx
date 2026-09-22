import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import { fechaHora } from '../../utils/fechas';
import { formatMoneda } from './oportunidadConstants';
import { seguimientosDeHoy, registrarSeguimiento, MAX_TOQUES } from './pipelineApi';
import { mensajeSugerido, linkWhatsapp, TOQUE_TITULO, TOQUE_PIDE_EDICION } from './seguimientoMensajes';
import TransicionEstadoModal from './TransicionEstadoModal';
import OportunidadFichaModal from './OportunidadFichaModal';

// "Seguimientos de hoy": la cadencia +24 h / +72 h / +7 d desde la entrega de
// la cotización, servida por GET /crm/seguimientos/hoy (que incluye los
// VENCIDOS: un toque de anteayer que nadie hizo sigue siendo trabajo).
//
// EL LINK DE WHATSAPP ES UN <a href>, NO UN window.open.
//
// Es la diferencia entre que WhatsApp abra al primer click o al segundo. Un
// `window.open` que corre después de un `await` ya perdió la activación del
// gesto del usuario y el navegador lo bloquea; un ancla navega dentro del click
// mismo y no hay nada que bloquear. Así que acá el mensaje se arma ANTES (con
// lo que ya trajo el GET) y el botón es un link de verdad. Lo que se registra
// después es un acto aparte, con su propio click.

const ToqueBadge = ({ numero }) => (
  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-700 text-slate-200 whitespace-nowrap">
    Toque {numero}/{MAX_TOQUES}
  </span>
);

const SeguimientoRow = ({ fila, onRegistrar, onAbrirFicha }) => {
  const [mensaje, setMensaje] = useState(() => mensajeSugerido(fila));
  const [editando, setEditando] = useState(Boolean(TOQUE_PIDE_EDICION[fila.numero_de_toque]));

  const link = linkWhatsapp(fila.telefono, mensaje);
  // El backend ya no crea la fila de alguien con `no_contactar`. Si igual
  // apareciera (una fila vieja, un cambio posterior en la persona), NO se
  // esconde: se muestra deshabilitada con el motivo. Esconderla haría creer
  // que el seguimiento no existe y el toque quedaría colgado para siempre.
  const bloqueada = fila.no_contactar === true;

  return (
    <div className={`rounded-lg p-4 space-y-3 border ${
      bloqueada
        ? 'bg-slate-800/40 border-slate-700 opacity-70'
        : fila.vencido
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-slate-700/30 border-slate-700'
    }`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onAbrirFicha(fila.oportunidad_id)}
            className="font-medium hover:text-blue-300 transition text-left"
          >
            {fila.nombre || 'Sin nombre'}
          </button>
          <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-slate-400">
            <span className="font-mono text-blue-400">{fila.oportunidad_token}</span>
            {fila.vehiculo && <span>{fila.vehiculo}</span>}
            {fila.compania && <span className="px-2 py-0.5 bg-slate-600 rounded">{fila.compania}</span>}
            <span className="text-slate-300">{formatMoneda(fila.premio)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ToqueBadge numero={fila.numero_de_toque} />
          <span className={`text-xs ${fila.vencido ? 'text-red-400' : 'text-slate-500'}`}>
            {fila.vencido ? 'Vencido · ' : ''}
            {fechaHora(fila.programado_para, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {bloqueada ? (
        <p className="text-amber-300/90 text-sm flex items-start gap-2">
          <Icon name="exclamation-triangle" className="mt-0.5 shrink-0" />
          La persona pidió no ser contactada (no_contactar). No se le escribe.
        </p>
      ) : (
        <>
          <p className="text-slate-400 text-xs">{TOQUE_TITULO[fila.numero_de_toque] || TOQUE_TITULO[1]}</p>

          {editando ? (
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={3}
              aria-label="Mensaje de WhatsApp"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm"
            />
          ) : (
            <p className="text-slate-300 text-sm bg-slate-800/60 rounded-lg px-3 py-2">{mensaje}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm font-medium"
              >
                <Icon name="chat-bubble" />
                Abrir WhatsApp
              </a>
            ) : (
              <span className="text-xs text-amber-300">
                Sin teléfono válido para WhatsApp{fila.telefono ? ` ("${fila.telefono}")` : ''}
              </span>
            )}
            <button
              type="button"
              onClick={() => setEditando((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
            >
              <Icon name="pencil-square" />
              {editando ? 'Listo' : 'Editar mensaje'}
            </button>
            <button
              type="button"
              onClick={() => onRegistrar(fila)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
            >
              <Icon name="check-badge" />
              Registrar
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Sub-modal de "Registrar": el resultado del toque, y si HUBO respuesta.
// `hubo_respuesta` sólo pesa en el toque 3: tres toques sin respuesta es lo que
// hace que el backend PROPONGA el LOOP (no lo aplica solo - la fecha de
// recontacto es un juicio comercial).
const RegistrarModal = ({ fila, onCerrar, onConfirmar }) => {
  const [resultado, setResultado] = useState('');
  const [huboRespuesta, setHuboRespuesta] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const confirmar = async (e) => {
    e.preventDefault();
    if (!resultado.trim()) { setError('Escribí el resultado del toque'); return; }
    setGuardando(true);
    setError(null);
    try {
      await onConfirmar(fila, { resultado: resultado.trim(), hubo_respuesta: huboRespuesta });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      title={`Registrar toque ${fila.numero_de_toque}/${MAX_TOQUES} · ${fila.nombre || fila.oportunidad_token}`}
      onClose={onCerrar}
      maxWidth="max-w-md"
    >
      <form onSubmit={confirmar} className="space-y-5">
        <div>
          <label className="block text-slate-400 text-sm mb-2" htmlFor="sg-resultado">Resultado *</label>
          <textarea
            id="sg-resultado" rows={3} value={resultado} onChange={(e) => setResultado(e.target.value)}
            placeholder="Qué dijo, qué quedó pendiente"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            required
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox" checked={huboRespuesta} onChange={(e) => setHuboRespuesta(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Hubo respuesta del prospecto
        </label>
        {fila.numero_de_toque >= MAX_TOQUES && !huboRespuesta && (
          <p className="text-amber-300/90 text-xs">
            Tercer toque sin respuesta: al confirmar se va a proponer pasar la oportunidad a LOOP.
          </p>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex gap-4 pt-2">
          <button type="button" onClick={onCerrar} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition">
            {guardando ? 'Registrando...' : 'Confirmar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const SeguimientosHoyPanel = ({ token, esAdmin = false }) => {
  const [datos, setDatos] = useState({ fecha: null, total: 0, seguimientos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [soloMios, setSoloMios] = useState(false);

  const [aRegistrar, setARegistrar] = useState(null);
  const [aviso, setAviso] = useState(null);
  // El backend PROPONE el LOOP tras un tercer toque sin respuesta; la
  // confirmación es de una persona y pide la fecha de recontacto.
  const [loopPropuesto, setLoopPropuesto] = useState(null);
  const [fichaAbierta, setFichaAbierta] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDatos(await seguimientosDeHoy(token, { soloMios }));
    } catch (err) {
      console.error('Error cargando seguimientos de hoy:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, soloMios]);

  useEffect(() => { cargar(); }, [cargar]);

  const confirmarRegistro = async (fila, datosRegistro) => {
    const respuesta = await registrarSeguimiento(token, fila.id, {
      ...datosRegistro,
      canal: 'WHATSAPP',
    });
    setARegistrar(null);
    const partes = [`Toque ${fila.numero_de_toque} registrado`];
    if (respuesta.proximo_toque) {
      partes.push(`próximo toque ${respuesta.proximo_toque} el ${fechaHora(respuesta.proximo_programado_para, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`);
    }
    if (respuesta.detalle) partes.push(respuesta.detalle);
    setAviso(partes.join(' · '));
    if (respuesta.propone_loop) {
      setLoopPropuesto({ id: fila.oportunidad_id, nombre: fila.nombre });
    }
    await cargar();
  };

  const vencidos = datos.seguimientos.filter((s) => s.vencido).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Seguimientos de hoy</h2>
          <p className="text-slate-400 text-sm mt-1">
            {datos.total} pendiente{datos.total === 1 ? '' : 's'}
            {vencidos > 0 && <span className="text-red-400"> · {vencidos} vencido{vencidos === 1 ? '' : 's'}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox" checked={soloMios} onChange={(e) => setSoloMios(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Solo míos
          </label>
          <button
            onClick={cargar}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
          >
            <Icon name="arrow-path" />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {aviso && (
        <div className="bg-blue-500/15 border border-blue-500/40 text-blue-200 px-4 py-2 rounded-lg text-sm">{aviso}</div>
      )}

      {loopPropuesto && (
        <div className="bg-amber-500/15 border border-amber-500/40 text-amber-200 px-4 py-3 rounded-lg text-sm flex items-start gap-3 flex-wrap">
          <Icon name="exclamation-triangle" className="mt-0.5 shrink-0" />
          <span className="flex-1 min-w-[12rem]">
            Tres toques sin respuesta en {loopPropuesto.nombre || 'la oportunidad'}. Corresponde pasarla a LOOP con fecha de recontacto.
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setLoopPropuesto({ ...loopPropuesto, confirmando: true })}
              className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition text-sm"
            >
              Pasar a LOOP
            </button>
            <button
              onClick={() => setLoopPropuesto(null)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition text-sm"
            >
              Después
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-400 text-center py-8">Cargando seguimientos...</p>
      ) : datos.seguimientos.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-slate-400">No hay seguimientos pendientes para hoy</p>
          <p className="text-slate-500 text-sm mt-2">
            La cadencia arranca al registrar una cotización entregada: primer toque a las 24 h.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {datos.seguimientos.map((fila) => (
            <SeguimientoRow
              key={fila.id}
              fila={fila}
              onRegistrar={setARegistrar}
              onAbrirFicha={setFichaAbierta}
            />
          ))}
        </div>
      )}

      {aRegistrar && (
        <RegistrarModal
          fila={aRegistrar}
          onCerrar={() => setARegistrar(null)}
          onConfirmar={confirmarRegistro}
        />
      )}

      {loopPropuesto?.confirmando && (
        <TransicionEstadoModal
          token={token}
          oportunidad={{ id: loopPropuesto.id }}
          destino="LOOP"
          onCerrar={() => setLoopPropuesto(null)}
          onAplicada={() => { setLoopPropuesto(null); setAviso('Oportunidad pasada a LOOP'); cargar(); }}
        />
      )}

      {fichaAbierta && (
        <OportunidadFichaModal
          token={token}
          esAdmin={esAdmin}
          oportunidadId={fichaAbierta}
          onClose={() => setFichaAbierta(null)}
          onChanged={cargar}
        />
      )}
    </div>
  );
};

export default SeguimientosHoyPanel;
