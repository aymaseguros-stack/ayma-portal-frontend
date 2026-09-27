import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import { fechaHora, fechaCorta } from '../../utils/fechas';
import { formatMoneda } from './oportunidadConstants';
import { seguimientosDeHoy, registrarSeguimiento, MAX_TOQUES } from './pipelineApi';
import {
  mensajeSugerido, linkWhatsapp, mensajeListoParaEnviar, TOQUE_TITULO, TOQUE_PIDE_EDICION,
} from './seguimientoMensajes';
import OportunidadFichaModal from './OportunidadFichaModal';
import ProximaAccionForm from './ProximaAccionForm';
import CompletarProximaAccionModal from './CompletarProximaAccionModal';
import { useProximaAccionForm } from './useProximaAccion';
import {
  CANAL_DEFAULT, toqueExigeProximaAccion, resumenProgramado, sinProximaAccion,
  etiquetaTipoAccion, etiquetaLoopMotivo,
} from './proximaAccion';
import { BadgeImpedida } from '../ArtCartera/Impedimento';

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
  // Con un marcador sin completar el botón no es un link: un <a> no tiene
  // `disabled` de verdad, así que se dibuja un <button disabled> igual.
  const listo = mensajeListoParaEnviar(mensaje);
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
            {fechaHora(fila.programado_para)}
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

          {!listo && (
            <p className="text-amber-300 text-sm flex items-start gap-2">
              <Icon name="exclamation-triangle" className="mt-0.5 shrink-0" />
              Completá el dato de valor antes de enviar
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {link && !listo ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
              >
                <Icon name="chat-bubble" />
                Abrir WhatsApp
              </button>
            ) : link ? (
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
              className={`inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm ${
                listo ? '' : 'ring-2 ring-amber-400'
              }`}
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

// Sub-modal de "Registrar" (C-9d): el resultado del toque, si HUBO respuesta
// (sin valor por defecto: decide qué más es obligatorio), el canal y, cuando
// el backend la exige, la próxima acción.
//
//   hubo respuesta           -> próxima acción obligatoria (se cancelan los toques)
//   sin respuesta, toque 1-2 -> nada más: la próxima acción es el toque siguiente
//   sin respuesta, toque 3   -> próxima acción obligatoria (o LOOP)
//
// Un 422 queda en el modal con el texto del backend y el modal NO se cierra.
const RegistrarModal = ({ token, fila, onCerrar, onConfirmar }) => {
  const [resultado, setResultado] = useState('');
  const [huboRespuesta, setHuboRespuesta] = useState(null);
  const [canal, setCanal] = useState(CANAL_DEFAULT);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  // SeguimientoPendiente no trae el track: se lee sólo si se elige LOOP.
  const estado = useProximaAccionForm({ token, oportunidadId: fila.oportunidad_id });

  const exige = toqueExigeProximaAccion(huboRespuesta, fila.numero_de_toque, MAX_TOQUES);

  const confirmar = async (e) => {
    e.preventDefault();
    if (huboRespuesta === null) { setError('Indicá si hubo respuesta'); return; }
    if (!resultado.trim()) { setError('Escribí el resultado del toque'); return; }
    if (exige) {
      const problema = estado.validar();
      if (problema) { setError(problema); return; }
    }
    setGuardando(true);
    setError(null);
    try {
      await onConfirmar(fila, {
        resultado: resultado.trim(),
        hubo_respuesta: huboRespuesta,
        canal,
        ...(exige ? { proxima_accion: estado.payload() } : {}),
      });
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
      maxWidth="max-w-lg"
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

        <ProximaAccionForm
          estado={estado}
          idPrefijo="sg-pa"
          deshabilitado={guardando}
          mostrarAccion={exige}
          toque={{ huboRespuesta, onHuboRespuesta: setHuboRespuesta, canal, onCanal: setCanal }}
        />

        {huboRespuesta === false && !exige && (
          <p className="text-slate-500 text-xs">
            Sin respuesta: se programa el toque {fila.numero_de_toque + 1}.
          </p>
        )}
        {huboRespuesta === false && exige && (
          <p className="text-amber-300/90 text-xs">
            Tercer toque sin respuesta: elegí la próxima acción, o "Sin próxima acción → LOOP".
          </p>
        )}

        {error && (
          <div role="alert" className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex gap-4 pt-2">
          <button type="button" onClick={onCerrar} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
            Cancelar
          </button>
          <button
            type="submit" disabled={guardando || huboRespuesta === null}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
          >
            {guardando ? 'Registrando...' : 'Confirmar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// C-9g: dd/mm/aaaa HH:mm en hora argentina, el formato único del helper.
const fechaHoraCorta = (v) => fechaHora(v);
const FORMATEAR = { fecha: (v) => fechaCorta(v), fechaHora: fechaHoraCorta };

const BotonWhatsapp = ({ telefono }) => {
  const link = linkWhatsapp(telefono, '');
  if (!link) return null;
  return (
    <a
      href={link} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm font-medium"
    >
      <Icon name="chat-bubble" />
      Abrir WhatsApp
    </a>
  );
};

const telHref = (telefono) => {
  const digitos = (telefono || '').replace(/[^\d+]/g, '');
  return digitos ? `tel:${digitos}` : null;
};

// "Próximas acciones" (C-9d): las tareas de próxima acción con fecha hasta
// hoy, vencidas primero.
const ProximaAccionRow = ({ fila, onCompletar, onAbrirFicha }) => {
  const tel = fila.tipo_accion === 'LLAMAR' ? telHref(fila.telefono) : null;
  return (
    <div
      data-testid="fila-proxima-accion"
      className={`rounded-lg p-4 space-y-2 border ${
        fila.vencida ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-700/30 border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {fila.oportunidad_id ? (
            <button
              type="button" onClick={() => onAbrirFicha(fila.oportunidad_id)}
              className="font-medium hover:text-blue-300 transition text-left"
            >
              {fila.nombre || fila.titulo}
            </button>
          ) : (
            <span className="font-medium">{fila.nombre || fila.titulo}</span>
          )}
          <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-slate-400">
            {fila.oportunidad_token && <span className="font-mono text-blue-400">{fila.oportunidad_token}</span>}
            {fila.track && <span>{fila.track}</span>}
            <BadgeImpedida impedimento={fila.impedimento} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-700/60 text-blue-100 whitespace-nowrap">
            {etiquetaTipoAccion(fila.tipo_accion)}
          </span>
          <span className={`text-xs ${fila.vencida ? 'text-red-400' : 'text-slate-500'}`}>
            {fila.vencida ? 'Vencida · ' : ''}{fechaHoraCorta(fila.fecha_programada)}
          </span>
        </div>
      </div>
      {fila.nota && <p className="text-slate-300 text-sm">{fila.nota}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        {fila.tipo_accion === 'WHATSAPP' && <BotonWhatsapp telefono={fila.telefono} />}
        {tel && (
          <a
            href={tel}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
          >
            <Icon name="phone" />
            Llamar {fila.telefono}
          </a>
        )}
        <button
          type="button" onClick={() => onCompletar(fila)}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
        >
          <Icon name="check-badge" />
          Completar
        </button>
      </div>
    </div>
  );
};

// "LOOP a recontactar" (C-9d): LOOP con fecha de recontacto hasta hoy.
const LoopRow = ({ fila, onAbrirFicha }) => (
  <div data-testid="fila-loop" className="rounded-lg p-4 space-y-2 border bg-yellow-500/5 border-yellow-600/30">
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <button
          type="button" onClick={() => onAbrirFicha(fila.oportunidad_id)}
          className="font-medium hover:text-blue-300 transition text-left"
        >
          {fila.nombre || fila.oportunidad_token}
        </button>
        <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-slate-400">
          <span className="font-mono text-blue-400">{fila.oportunidad_token}</span>
          {fila.track && <span>{fila.track}</span>}
          <BadgeImpedida impedimento={fila.impedimento} />
        </div>
      </div>
      <span className={`text-xs shrink-0 ${fila.dias_vencido > 0 ? 'text-red-400' : 'text-slate-400'}`}>
        {fila.dias_vencido > 0
          ? `Vencido hace ${fila.dias_vencido} día${fila.dias_vencido === 1 ? '' : 's'}`
          : 'Recontactar hoy'}
      </span>
    </div>
    <p className="text-slate-300 text-sm">
      Motivo: {etiquetaLoopMotivo(fila.loop_motivo)}
      {fila.loop_motivo_detalle ? ` · ${fila.loop_motivo_detalle}` : ''}
    </p>
    <div className="flex items-center gap-2 flex-wrap">
      <BotonWhatsapp telefono={fila.telefono} />
      <button
        type="button" onClick={() => onAbrirFicha(fila.oportunidad_id)}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
      >
        Ver ficha
      </button>
    </div>
  </div>
);

// Sólo ADMIN: las oportunidades vivas sin nada agendado.
const SinProximaAccionCard = ({ token, onAbrirFicha, version }) => {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    let vivo = true;
    sinProximaAccion(token)
      .then((d) => { if (vivo) { setDatos(d); setError(null); } })
      .catch((err) => { if (vivo) setError(err.message); });
    return () => { vivo = false; };
  }, [token, version]);

  if (error) {
    return <div className="text-red-300 text-sm">Oportunidades sin próxima acción: {error}</div>;
  }
  if (!datos) return null;
  return (
    <div data-testid="sin-proxima-accion" className={`rounded-xl border p-4 ${
      datos.total > 0 ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-800/50 border-slate-700'
    }`}>
      <button
        type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="font-semibold">Oportunidades sin próxima acción: {datos.total}</span>
        {datos.detalle.length > 0 && <span className="text-sm text-slate-400">{abierta ? 'Ocultar' : 'Ver detalle'}</span>}
      </button>
      {abierta && datos.detalle.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {datos.detalle.map((o) => (
            <li key={o.oportunidad_id} className="flex items-center gap-2 flex-wrap">
              <button
                type="button" onClick={() => onAbrirFicha(o.oportunidad_id)}
                className="text-blue-300 hover:text-blue-200 underline"
              >
                {o.nombre || o.id_corto}
              </button>
              <span className="text-slate-400">{o.track} · {o.estado_crm}</span>
              <span className="font-mono text-slate-500">{o.id_corto}</span>
              {o.ultimo_toque && (
                <span className="text-slate-500">· último toque {o.ultimo_toque.numero_de_toque}</span>
              )}
            </li>
          ))}
          {datos.detalle_truncado && (
            <li className="text-slate-500 text-xs">Se muestran las {datos.detalle.length} más viejas.</li>
          )}
        </ul>
      )}
    </div>
  );
};

const ordenarProximas = (lista) => [...lista].sort((a, b) => {
  if (a.vencida !== b.vencida) return a.vencida ? -1 : 1;
  return String(a.fecha_programada).localeCompare(String(b.fecha_programada));
});

const SeguimientosHoyPanel = ({ token, esAdmin = false }) => {
  const [datos, setDatos] = useState({
    fecha: null, total: 0, seguimientos: [], proximas_acciones: [], loop_a_recontactar: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [soloMios, setSoloMios] = useState(false);

  const [aRegistrar, setARegistrar] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [aCompletar, setACompletar] = useState(null);
  const [fichaAbierta, setFichaAbierta] = useState(null);
  // Sube con cada cambio para que la tarjeta ADMIN se vuelva a pedir.
  const [version, setVersion] = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await seguimientosDeHoy(token, { soloMios });
      setDatos({ proximas_acciones: [], loop_a_recontactar: [], ...r });
      setVersion((v) => v + 1);
    } catch (err) {
      console.error('Error cargando seguimientos de hoy:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, soloMios]);

  useEffect(() => { cargar(); }, [cargar]);

  const confirmarRegistro = async (fila, datosRegistro) => {
    const respuesta = await registrarSeguimiento(token, fila.id, datosRegistro);
    setARegistrar(null);
    const partes = [`Toque ${fila.numero_de_toque} registrado`];
    if (respuesta.proximo_toque) {
      partes.push(`próximo toque ${respuesta.proximo_toque} el ${fechaHoraCorta(respuesta.proximo_programado_para)}`);
    }
    if (respuesta.seguimientos_cancelados > 0) {
      partes.push(`${respuesta.seguimientos_cancelados} toque${respuesta.seguimientos_cancelados === 1 ? '' : 's'} pendiente${respuesta.seguimientos_cancelados === 1 ? '' : 's'} cancelado${respuesta.seguimientos_cancelados === 1 ? '' : 's'}`);
    }
    const programado = resumenProgramado(respuesta.proxima_accion, FORMATEAR);
    if (programado) partes.push(programado);
    if (respuesta.detalle) partes.push(respuesta.detalle);
    setAviso(partes.join(' · '));
    await cargar();
  };

  const tareaCompletada = async (respuesta) => {
    setACompletar(null);
    const programado = resumenProgramado(respuesta?.proxima_accion, FORMATEAR);
    setAviso(['Acción completada', programado].filter(Boolean).join(' · '));
    await cargar();
  };

  const proximas = ordenarProximas(datos.proximas_acciones || []);
  const loops = datos.loop_a_recontactar || [];

  const vencidos = datos.seguimientos.filter((s) => s.vencido).length;

  return (
    <div className="space-y-6">
      {esAdmin && <SinProximaAccionCard token={token} onAbrirFicha={setFichaAbierta} version={version} />}

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

      {!loading && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Próximas acciones ({proximas.length})</h3>
          {proximas.length === 0 ? (
            <p className="text-slate-500 text-sm">Nada agendado para hoy.</p>
          ) : proximas.map((fila) => (
            <ProximaAccionRow
              key={fila.tarea_id} fila={fila}
              onCompletar={setACompletar} onAbrirFicha={setFichaAbierta}
            />
          ))}
        </section>
      )}

      {!loading && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">LOOP a recontactar ({loops.length})</h3>
          {loops.length === 0 ? (
            <p className="text-slate-500 text-sm">Ningún LOOP vence hoy.</p>
          ) : loops.map((fila) => (
            <LoopRow key={fila.oportunidad_id} fila={fila} onAbrirFicha={setFichaAbierta} />
          ))}
        </section>
      )}

      {aRegistrar && (
        <RegistrarModal
          token={token}
          fila={aRegistrar}
          onCerrar={() => setARegistrar(null)}
          onConfirmar={confirmarRegistro}
        />
      )}

      {aCompletar && (
        <CompletarProximaAccionModal
          token={token}
          tarea={{
            id: aCompletar.tarea_id, titulo: aCompletar.titulo,
            oportunidad_id: aCompletar.oportunidad_id, track: aCompletar.track,
          }}
          onCerrar={() => setACompletar(null)}
          onCompletada={tareaCompletada}
        />
      )}

      {fichaAbierta && (
        <OportunidadFichaModal
          token={token}
          oportunidadId={fichaAbierta}
          onClose={() => setFichaAbierta(null)}
          onChanged={cargar}
        />
      )}
    </div>
  );
};

export default SeguimientosHoyPanel;
