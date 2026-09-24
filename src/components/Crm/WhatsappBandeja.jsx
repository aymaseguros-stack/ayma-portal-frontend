import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import Modal from '../Modal';
import { altaDesdeBandeja, horaMeta, listarSinClasificar, marcarPersonal } from './whatsappApi';

// C-4c · La bandeja "WhatsApp sin clasificar" (D-C31), como SUB-PESTAÑA de
// Leads: no es una ruta nueva, es la otra mitad de la misma pregunta -quién
// nos escribió que todavía no es un lead-.
//
// QUÉ HAY Y QUÉ NO. Un número llega acá cuando escribió sin anuncio
// (sin `referral`) y no está en el padrón. De esos mensajes el backend
// guardó SÓLO metadata: cuántos, en qué dirección, el primero y el último.
// Ni texto ni archivos, así que esta pantalla no tiene nada que mostrar de
// la conversación y no finge tenerlo.
//
// LAS DOS SALIDAS SON DECISIONES CON EFECTO, y por eso las dos confirman:
//   - "Alta como lead": lead + persona en DATO + acto CONTACTO, y de ahí en
//     adelante su contenido se archiva. Lo anterior NO se recupera.
//   - "Personal · excluir": persona fuera del padrón comercial, sólo
//     metadata para siempre. Si el número ya está en el padrón es 409.

const MENSAJE_VACIO = 'Sin mensajes pendientes. La integración se activa cuando Meta esté conectado.';

const ModalAlta = ({ numero, onCancelar, onConfirmar, enviando, error }) => {
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const input = 'w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-600 text-white text-sm';
  return (
    <Modal title="Alta como lead" onClose={onCancelar}>
      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); onConfirmar(form); }}
      >
        <p className="text-slate-300 text-sm">
          <strong className="font-mono">{numero.telefono_e164}</strong> pasa a ser un lead con su persona en DATO.
          {numero.persona_en_padron_id
            ? ' El número ya está en el padrón: se vincula a esa persona y no se crea otra.'
            : ' Si no cargás nombre, la persona nace como "WhatsApp +54…" y se corrige en su ficha.'}
        </p>
        <p className="text-amber-200/90 text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
          Lo que escribió hasta ahora <strong>no se guardó y no se recupera</strong>: el contenido se
          archiva a partir del alta.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-400">Nombre (opcional)
            <input aria-label="Nombre" className={input} value={form.nombre} onChange={set('nombre')} maxLength={100} />
          </label>
          <label className="text-xs text-slate-400">Apellido (opcional)
            <input aria-label="Apellido" className={input} value={form.apellido} onChange={set('apellido')} maxLength={150} />
          </label>
          <label className="text-xs text-slate-400 sm:col-span-2">Email (opcional)
            <input aria-label="Email" type="email" className={input} value={form.email} onChange={set('email')} />
          </label>
        </div>
        {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancelar} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-semibold"
          >
            {enviando ? 'Dando de alta…' : 'Confirmar alta'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ModalPersonal = ({ numero, onCancelar, onConfirmar, enviando, error }) => {
  const [nombre, setNombre] = useState('');
  return (
    <Modal title="Personal · excluir" onClose={onCancelar}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onConfirmar({ nombre }); }}>
        <p className="text-slate-300 text-sm">
          <strong className="font-mono">{numero.telefono_e164}</strong> queda marcado como contacto personal:
        </p>
        <ul className="text-slate-300 text-sm list-disc pl-5 space-y-1">
          <li>No entra al padrón comercial, ni al embudo, ni a la cola de recontacto.</li>
          <li>De sus mensajes se guarda <strong>sólo metadata</strong>, para siempre: ni texto ni archivos.</li>
          <li>Sus próximos mensajes no vuelven a esta bandeja.</li>
        </ul>
        <label className="block text-xs text-slate-400">Cómo reconocerlo (opcional)
          <input
            aria-label="Nombre de referencia"
            className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-600 text-white text-sm"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={150}
            placeholder="Ej.: Tía Marta"
          />
        </label>
        {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancelar} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="flex-1 py-2.5 bg-slate-500 hover:bg-slate-400 disabled:opacity-50 rounded-lg text-sm font-semibold"
          >
            {enviando ? 'Marcando…' : 'Confirmar: es personal'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const WhatsappBandeja = ({ token, onClasificado, onVerPersona }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  // {accion: 'alta'|'personal', numero}
  const [pendiente, setPendiente] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await listarSinClasificar(token);
      setItems(res.items || []);
      setTotal(res.total ?? (res.items || []).length);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrir = (accion, numero) => { setErrorAccion(null); setPendiente({ accion, numero }); };
  const cerrar = () => { if (!enviando) setPendiente(null); };

  const confirmar = async (datos) => {
    if (enviando || !pendiente) return;
    const { accion, numero } = pendiente;
    setEnviando(true);
    setErrorAccion(null);
    try {
      const hacer = accion === 'alta' ? altaDesdeBandeja : marcarPersonal;
      const res = await hacer(token, numero.wa_id, datos);
      setPendiente(null);
      setAviso({
        accion,
        telefono: numero.telefono_e164,
        personaId: res.persona_id,
        mensajes: res.mensajes_vinculados,
        creada: res.persona_creada,
      });
      await cargar();
      onClasificado?.(accion, res);
    } catch (err) {
      // 409 = ya está en el padrón (personal) / se clasificó recién. El
      // mensaje del backend lo dice; se muestra tal cual y se relee la lista.
      setErrorAccion(err.message);
      if (err.status === 409 || err.status === 404) cargar();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 flex items-start gap-3">
        <Icon name="chat-bubble" size={18} className="text-green-400 shrink-0 mt-0.5" />
        <p className="text-slate-300 text-sm">
          Números que escribieron al WhatsApp de AYMA <strong>sin venir de un anuncio</strong> y que no están en el padrón.
          De estos mensajes <strong>sólo hay metadata</strong>: el texto no se guardó. Decidí si es un cliente o un contacto personal.
        </p>
      </div>

      {aviso && (
        <div role="status" className="bg-green-500/10 border border-green-500/40 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-green-200 text-sm">
            {aviso.accion === 'alta'
              ? `${aviso.telefono}: alta como lead ${aviso.creada ? '(persona nueva)' : '(vinculado a la persona existente)'} · ${aviso.mensajes} mensaje(s) vinculados.`
              : `${aviso.telefono}: marcado como personal. Sólo metadata de acá en adelante.`}
          </p>
          <div className="flex gap-2">
            {aviso.accion === 'alta' && onVerPersona && aviso.personaId && (
              <button type="button" onClick={() => onVerPersona(aviso.personaId)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">
                Ver persona
              </button>
            )}
            <button type="button" onClick={() => setAviso(null)} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm">
              Cerrar
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold">WhatsApp sin clasificar</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{total} número(s)</span>
            <button type="button" onClick={cargar} disabled={cargando} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-sm">
              {cargando ? 'Cargando…' : 'Actualizar'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center" role="alert">
            <p className="text-red-300 font-semibold">No se pudo cargar la bandeja</p>
            <p className="text-red-400/80 text-sm mt-2">{error}</p>
          </div>
        ) : cargando && items.length === 0 ? (
          <p className="p-8 text-center text-slate-400">Cargando…</p>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-400">{MENSAJE_VACIO}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3 text-center">Mensajes</th>
                  <th className="px-4 py-3 text-center">Entrantes / Salientes</th>
                  <th className="px-4 py-3">Primero</th>
                  <th className="px-4 py-3">Último</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {items.map((n) => (
                  <tr key={n.wa_id} data-testid={`bandeja-${n.wa_id}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{n.telefono_e164}</span>
                      {n.persona_en_padron_id && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">Ya en el padrón</span>
                      )}
                      {n.telefono_ambiguo && (
                        <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs">Teléfono en 2+ personas</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{n.cantidad}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-300">
                      <span title="Entrantes">↓ {n.entrantes}</span>
                      <span className="mx-2 text-slate-600">/</span>
                      <span title="Salientes">↑ {n.salientes}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{horaMeta(n.primer_mensaje_en)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">{horaMeta(n.ultimo_mensaje_en)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrir('alta', n)}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm whitespace-nowrap"
                        >
                          Alta como lead
                        </button>
                        <button
                          type="button"
                          onClick={() => abrir('personal', n)}
                          disabled={Boolean(n.persona_en_padron_id)}
                          title={n.persona_en_padron_id ? 'Ya está en el padrón: para no guardar sus mensajes usá "Excluir WhatsApp" en su ficha.' : undefined}
                          className="px-3 py-1.5 border border-slate-500 text-slate-200 hover:bg-slate-700 disabled:opacity-40 rounded text-sm whitespace-nowrap"
                        >
                          Personal · excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendiente?.accion === 'alta' && (
        <ModalAlta numero={pendiente.numero} onCancelar={cerrar} onConfirmar={confirmar} enviando={enviando} error={errorAccion} />
      )}
      {pendiente?.accion === 'personal' && (
        <ModalPersonal numero={pendiente.numero} onCancelar={cerrar} onConfirmar={confirmar} enviando={enviando} error={errorAccion} />
      )}
    </div>
  );
};

export default WhatsappBandeja;
