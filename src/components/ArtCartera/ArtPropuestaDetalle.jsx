import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import {
  agregarNotaPropuestaArt,
  anularPropuestaArt,
  cambiarEstadoPropuestaArt,
  descargarPdfPropuestaArt,
  obtenerPropuestaArt,
} from './artCarteraApi';
import {
  aseguradoraLabel,
  confianzaAlicuotaInfo,
  confianzaMasaInfo,
  decimalAr,
  diasRestantesTexto,
  estadoPropuestaInfo,
  pesosAr,
} from './artCarteraConstants';
import { fechaCorta, fechaHora } from '../../utils/fechas';

const VACIO = '—';

// Los botones de estado que corresponden a CADA estado, calcados de las
// transiciones que acepta el backend (BORRADOR->ENTREGADA,
// ENTREGADA->ACEPTADA|RECHAZADA - ver TRANSICIONES en
// app/services/propuesta_art.py). Mostrar un botón que el backend va a
// rechazar con 409 es peor que no mostrarlo: parece que se puede.
//
// Se indexa por `estado` (el guardado), no por `estado_efectivo`: una
// propuesta VENCIDA sigue siendo una ENTREGADA que se puede aceptar o
// rechazar - el cliente puede contestar tarde, y esa respuesta hay que
// poder registrarla.
//
// `motivo: true` abre el modal antes de mandar el movimiento y lo manda
// como `nota` (POST /estado acepta `nota` desde el BLOQUE 1.5). Lo llevan
// ACEPTADA y RECHAZADA y no "Marcar entregada": entregar es un trámite -
// el papel salió - mientras aceptada y rechazada son los DESENLACES, y un
// desenlace sin explicación no se puede trabajar después. "Rechazada" a
// secas, tres meses más tarde, no dice si se fue por precio, por servicio
// o porque nunca contestó; y eso es justo lo que hay que saber para volver
// a llamar.
const ACCIONES_POR_ESTADO = {
  BORRADOR: [{ estado: 'ENTREGADA', label: 'Marcar entregada', clase: 'bg-blue-600 hover:bg-blue-500 text-white' }],
  ENTREGADA: [
    {
      estado: 'ACEPTADA',
      label: 'Aceptada',
      clase: 'bg-green-600 hover:bg-green-500 text-white',
      motivo: true,
      titulo: 'Marcar como aceptada',
      descripcion: 'Queda asentado en la bitácora con la fecha y el estado nuevo. Sirve para saber después por qué se cerró: con qué argumento, contra qué aseguradora, a qué precio.',
      placeholder: 'Por qué la aceptó',
      confirmar: 'Marcar aceptada',
      enviandoLabel: 'Guardando...',
      claseConfirmar: 'bg-green-600 hover:bg-green-500 text-white',
    },
    {
      estado: 'RECHAZADA',
      label: 'Rechazada',
      clase: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
      motivo: true,
      titulo: 'Marcar como rechazada',
      descripcion: 'Queda asentado en la bitácora con la fecha y el estado nuevo. Un rechazo sin motivo no se puede trabajar: no dice si se fue por precio, por servicio o porque no contestó.',
      placeholder: 'Por qué la rechazó',
      confirmar: 'Marcar rechazada',
      enviandoLabel: 'Guardando...',
      claseConfirmar: 'bg-slate-600 hover:bg-slate-500 text-white',
    },
  ],
  ACEPTADA: [],
  RECHAZADA: [],
  ANULADA: [],
};

// Los dos estados desde los que el backend deja anular (ESTADOS_ANULABLES
// en app/services/propuesta_art.py). Una ACEPTADA o una RECHAZADA ya
// tuvieron su desenlace; una ANULADA no se re-anula. Igual que con los
// botones de estado: mostrar un botón que va a volver con 409 se lee como
// que la acción existe.
const ESTADOS_ANULABLES = ['BORRADOR', 'ENTREGADA'];

// Modal de un solo campo obligatorio: el MOTIVO. Lo usan la anulación
// (manda `motivo` a POST /anular) y los dos desenlaces - aceptada y
// rechazada - (mandan `nota` a POST /estado). Es el mismo gesto y la misma
// regla, así que es el mismo componente: escribir por qué antes de mover
// una propuesta a un estado del que no se vuelve.
//
// El botón de confirmar arranca DESHABILITADO y sólo se habilita con texto
// no vacío (espacios no cuentan): el motivo es lo único que después
// distingue "se cargó mal la alícuota" de "la aseguradora dio de baja la
// cotización", o "se fue por precio" de "nunca contestó". La misma regla
// la vuelve a aplicar el backend (422 en /anular y en PATCH /nota), esto
// es sólo para no hacer el viaje y, sobre todo, para explicar la exigencia
// ANTES de escribir.
//
// El `error` se muestra DENTRO del modal y el texto tipeado NO se pierde:
// si se cerrara, habría que volver a escribirlo.
const MotivoModal = ({
  titulo,
  descripcion,
  placeholder,
  confirmarLabel,
  enviandoLabel,
  claseConfirmar = 'bg-red-600 hover:bg-red-500 text-white',
  pie = null,
  maxLength = 500,
  enviando,
  error,
  onCancelar,
  onConfirmar,
}) => {
  const [motivo, setMotivo] = useState('');
  const vacio = !motivo.trim();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{titulo}</h3>
          <p className="text-slate-400 text-sm mt-1">{descripcion}</p>
        </div>

        <label className="block">
          <span className="block text-slate-300 text-sm mb-1">
            Motivo <span className="text-red-400">*</span>
          </span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            autoFocus
            maxLength={maxLength}
            placeholder={placeholder}
            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-500"
          />
        </label>

        {error && (
          <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {pie && <p className="text-[11px] text-slate-500">{pie}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={enviando}
            className="px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(motivo)}
            disabled={vacio || enviando}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${claseConfirmar}`}
          >
            {enviando ? enviandoLabel : confirmarLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// La bitácora de seguimiento (BLOQUE 1.5 del backend): lo que pasó DESPUÉS
// de armar la propuesta. Va a la vista y no detrás de un colapsable como
// la rentabilidad: es historia comercial de la empresa, no margen de AYMA,
// y es lo primero que alguien necesita leer antes de volver a llamar.
//
// APPEND-ONLY, y la pantalla lo dice: no hay botón de editar ni de borrar
// una entrada, porque el backend no expone ninguno. Una bitácora que se
// puede corregir no sirve para lo único para lo que existe. Si algo se
// anotó mal, se escribe otra nota diciéndolo.
//
// Se muestran en el orden en que se escribieron (la más vieja arriba): es
// una línea de tiempo, y leída al revés una conversación no se entiende.
// Cada entrada lleva el estado que tenía la propuesta AL MOMENTO de
// escribirla, no el de hoy - es lo que convierte la lista en un relato
// ("esto se dijo cuando todavía era un BORRADOR") en vez de un montón de
// comentarios sueltos.
//
// `usuario` viene como id (un UUID) y no se muestra: un UUID en pantalla
// no le dice nada a nadie. La trazabilidad está guardada igual en el
// backend, que es donde hace falta.
const Bitacora = ({ notas, enviando, error, onAgregar }) => {
  const [nota, setNota] = useState('');
  const vacia = !nota.trim();

  const agregar = async () => {
    const ok = await onAgregar(nota);
    // Sólo se limpia si el backend la aceptó: con un 422 o un 500, lo
    // tipeado sigue ahí para reintentar sin volver a escribirlo.
    if (ok) setNota('');
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Bitácora de seguimiento
        </h3>
        <p className="text-slate-500 text-xs mt-0.5">
          Qué pasó después de armarla. Una entrada no se edita ni se borra: si algo
          se anotó mal, se escribe otra nota diciéndolo.
        </p>
      </div>

      {notas.length === 0 ? (
        <p className="text-slate-500 text-sm">
          Todavía no hay notas. La primera se asienta sola al marcar la propuesta como
          aceptada o rechazada.
        </p>
      ) : (
        <ol className="space-y-3">
          {notas.map((entrada, idx) => {
            const estadoNota = estadoPropuestaInfo(entrada.estado);
            return (
              <li
                key={`${entrada.fecha}-${idx}`}
                className="border-l-2 border-slate-700 pl-3 py-0.5"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 text-xs">
                    {fechaCorta(entrada.fecha) || VACIO}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${estadoNota.badge}`}>
                    {estadoNota.label}
                  </span>
                </div>
                <p className="text-slate-200 text-sm mt-1 whitespace-pre-wrap">{entrada.nota}</p>
              </li>
            );
          })}
        </ol>
      )}

      {error && (
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-3">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Agregar una nota de seguimiento"
          className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-500"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={agregar}
            disabled={vacia || enviando}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-700/50 hover:bg-slate-700 text-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando ? 'Guardando...' : 'Agregar nota'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Importe = ({ valor, className = '' }) => {
  const texto = pesosAr(valor);
  if (texto === null) return <span className="text-slate-600">{VACIO}</span>;
  return <span className={className}>{texto}</span>;
};

const Dato = ({ label, children }) => (
  <div>
    <p className="text-slate-500 text-xs uppercase tracking-wide">{label}</p>
    <div className="text-slate-200 mt-0.5">{children}</div>
  </div>
);

// Botón "Copiar" de un valor que NO se puede tipear a mano sin error: un
// SHA-256 son 64 caracteres hexadecimales y el token del vault es un
// identificador opaco. Los dos se copian para pegarlos en otro lado -un
// mail al cliente, un reclamo a la aseguradora, el buscador del vault- y
// una sola letra cambiada los vuelve inservibles sin avisar.
//
// El resultado se dice en el propio botón y no con un toast: el que copia
// está mirando el botón que acaba de apretar. `navigator.clipboard` no
// existe fuera de contexto seguro (http a secas) y puede tirar si el
// permiso está denegado, así que el fallo se MUESTRA - "No se pudo" - en
// vez de dejar creer que el valor está en el portapapeles cuando no está.
const BotonCopiar = ({ texto, etiqueta }) => {
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (!resultado) return undefined;
    const id = setTimeout(() => setResultado(null), 2000);
    return () => clearTimeout(id);
  }, [resultado]);

  const copiar = async () => {
    try {
      if (!navigator?.clipboard?.writeText) throw new Error('sin portapapeles');
      await navigator.clipboard.writeText(texto);
      setResultado('ok');
    } catch {
      setResultado('error');
    }
  };

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={`Copiar ${etiqueta}`}
      className={`shrink-0 px-2 py-1 rounded text-[11px] font-medium border transition ${
        resultado === 'error'
          ? 'border-red-500/50 text-red-300'
          : 'border-slate-600 text-slate-300 hover:bg-slate-700/50'
      }`}
    >
      {resultado === 'ok' ? 'Copiado' : resultado === 'error' ? 'No se pudo' : 'Copiar'}
    </button>
  );
};

// Un valor largo y opaco con su botón de copiar. `break-all` y tipografía
// mono a propósito: un hash cortado con puntos suspensivos no se puede
// comparar de un vistazo contra otro, que es justo para lo que se mira.
const DatoCopiable = ({ label, valor, ayudaVacio }) => (
  <div>
    <p className="text-slate-500 text-xs uppercase tracking-wide">{label}</p>
    {valor ? (
      <div className="flex items-start gap-2 mt-1">
        <code className="text-[11px] text-slate-200 font-mono break-all leading-relaxed">{valor}</code>
        <BotonCopiar texto={valor} etiqueta={label} />
      </div>
    ) : (
      <div className="mt-1">
        <span className="text-slate-600">{VACIO}</span>
        {ayudaVacio && <span className="block text-[11px] text-slate-500">{ayudaVacio}</span>}
      </div>
    )}
  </div>
);

// Evidencia de qué documento se entregó (BLOQUE 1.5 - T25).
//
// El HASH es la huella del PDF que recibió la empresa: sirve para probar
// que el archivo que alguien trae tres meses después es el mismo que se
// entregó, o que no lo es. El TOKEN es su asiento en el Token Vault.
//
// No es un dato del cliente ni de la rentabilidad de AYMA, así que no va
// en ninguno de esos dos bloques: es la trazabilidad del papel.
//
// Sólo aparece cuando hay algo que mostrar. Un BORRADOR todavía no tiene
// PDF - el hash y el token se cargan al entregar - y una tarjeta vacía con
// dos guiones no informa nada.
const ConstanciaDocumento = ({ data }) => {
  if (!data.tiene_pdf && !data.hash_sha256 && !data.vault_token) return null;

  // La anulación quedó asentada allá. `vault_anulado_en` es la fecha del
  // HECHO (viene null mientras no haya entrado, aunque se haya intentado),
  // y es un instante UTC, no una fecha suelta: va con hora.
  //
  // `hour12: false` porque es-AR formatea en 12 horas y un "02:30" sin
  // am/pm en una evidencia no se puede leer. Y se rotula UTC: el backend
  // lo guarda con `datetime.utcnow()` y lo serializa SIN offset, así que
  // el reloj que se ve es el de UTC - decirlo es más barato que dejar a
  // alguien restar tres horas de más.
  const anuladoEn = data.vault_anulado_en
    ? fechaHora(data.vault_anulado_en, { hour12: false })
    : null;
  // Se intentó y NO entró: el token sigue figurando vigente en el vault
  // aunque la propuesta esté anulada acá. Hay que decirlo - alguien tiene
  // que ir a darlo de baja a mano - y por eso el detalle del fallo (un 404
  // de path, un 401 de credencial y un timeout se arreglan distinto).
  const fallo = data.estado === 'ANULADA' && data.vault_token && !data.vault_anulado_en;
  const respuesta = data.vault_anulacion_respuesta || null;
  const detalleFallo = respuesta ? (respuesta.error || (respuesta.status_code ? `HTTP ${respuesta.status_code}` : null)) : null;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Constancia del documento
        </h3>
        <p className="text-slate-500 text-xs mt-0.5">
          La huella del PDF que recibió la empresa y su asiento en el Token Vault. No sale en el PDF del cliente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DatoCopiable
          label="Hash SHA-256"
          valor={data.hash_sha256}
          ayudaVacio="Se calcula al entregar la propuesta."
        />
        <DatoCopiable
          label="Token del vault"
          valor={data.vault_token}
          ayudaVacio="El vault no respondió al entregar. El PDF y su hash valen igual."
        />
      </div>

      {anuladoEn && (
        <p className="text-xs text-slate-400">
          Anulación asentada en el vault el <span className="text-slate-200">{anuladoEn}</span> (UTC).
        </p>
      )}

      {fallo && (
        <p className="text-xs text-amber-300/90">
          La anulación no quedó asentada en el vault: allá el token sigue figurando vigente y hay que
          darlo de baja a mano. La anulación de esta propuesta vale igual.
          {detalleFallo ? ` El vault contestó: ${detalleFallo}.` : ''}
        </p>
      )}
    </div>
  );
};

// Vista de UNA propuesta (BLOQUE 1.3) - GET /art/propuestas/{id}.
//
// DOS BLOQUES SEPARADOS A PROPÓSITO:
//
//   - el resumen del CLIENTE (ahorro, LRT, costo por trabajador, validez)
//     es lo mismo que dice el PDF que recibe la empresa;
//   - el bloque INTERNO (comisión, win, umbral) es la rentabilidad de AYMA
//     y va COLAPSADO. No está escondido - quien arma la propuesta lo
//     necesita para decidir si presentarla - pero tampoco puede estar
//     abierto mientras alguien comparte pantalla con el cliente.
//
// Abajo de los dos va la BITÁCORA (BLOQUE 1.5): qué pasó después de armar
// la propuesta. Los números de una propuesta entregada no se tocan nunca -
// es lo que se le dijo a una empresa - así que la bitácora es lo único que
// se le puede agregar, y el único lugar donde queda por qué se cerró o por
// qué se perdió.
//
// Igual que la grilla, no es una ruta: se abre como drill-down desde la
// grilla o desde la ficha, con estado local (la app no usa router de URLs -
// ver el docstring de ArtCarteraView.jsx).
const ArtPropuestaDetalle = ({ token, propuestaId, onVolver, volverLabel = 'Volver a la grilla' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accionError, setAccionError] = useState(null);
  const [enviando, setEnviando] = useState(null);
  const [internoAbierto, setInternoAbierto] = useState(false);
  const [advertencias, setAdvertencias] = useState([]);
  const [anularAbierto, setAnularAbierto] = useState(false);
  const [anularError, setAnularError] = useState(null);
  // La acción de estado que está esperando el motivo (la entrada de
  // ACCIONES_POR_ESTADO, no sólo el nombre del estado: el modal saca de ahí
  // su título, su placeholder y el color del botón).
  const [accionPendiente, setAccionPendiente] = useState(null);
  const [motivoError, setMotivoError] = useState(null);
  const [notaError, setNotaError] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await obtenerPropuestaArt(token, propuestaId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, propuestaId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Manda el movimiento de estado. Devuelve null si salió bien, o el
  // mensaje de error - NO lo pinta por su cuenta: quien llama decide dónde
  // se lee (el panel o el modal). Devolverlo en vez de leerlo del state
  // después es lo que evita el clásico de ver el error del intento
  // anterior: el `set` de React no se refleja en el mismo closure.
  //
  // `nota` viaja sólo cuando la acción pide motivo; entregar no lo pide.
  const mandarEstado = async (estado, nota) => {
    setEnviando(estado);
    try {
      const resultado = await cambiarEstadoPropuestaArt(token, propuestaId, estado, nota);
      setData(resultado.propuesta);
      setAdvertencias(resultado.advertencias || []);
      return null;
    } catch (err) {
      // El 409 del backend trae la instrucción de qué hacer ("cargar F.931
      // primero"), así que se devuelve tal cual en vez de un "no se pudo".
      return err.message;
    } finally {
      setEnviando(null);
    }
  };

  // Clic en un botón de estado: los que exigen motivo abren el modal, el
  // resto ("Marcar entregada") va derecho.
  const ejecutarAccion = async (accion) => {
    if (accion.motivo) {
      setMotivoError(null);
      setAccionPendiente(accion);
      return;
    }
    setAccionError(await mandarEstado(accion.estado));
  };

  // Confirmación del modal de motivo. El motivo viaja como `nota`: el
  // backend lo asienta en la bitácora con el estado NUEVO, y SÓLO si la
  // transición se acepta - un 409 (la ACEPTADA sin F.931, por ejemplo) hace
  // rollback y no anota nada. Por eso el error se muestra DENTRO del modal,
  // que queda abierto con el motivo ya escrito: el movimiento no pasó y hay
  // que reintentarlo, no volver a tipearlo.
  const confirmarMotivo = async (motivo) => {
    const accion = accionPendiente;
    if (!accion) return;
    setMotivoError(null);
    const error = await mandarEstado(accion.estado, motivo);
    if (error) {
      setMotivoError(error);
      return;
    }
    setAccionPendiente(null);
    setAccionError(null);
  };

  // PATCH /nota: agrega una entrada a la bitácora sin tocar nada más. Anda
  // en cualquier estado, incluidos los finales - es la única escritura que
  // acepta una propuesta que ya salió de la oficina.
  const agregarNota = async (nota) => {
    setEnviando('NOTA');
    setNotaError(null);
    try {
      setData(await agregarNotaPropuestaArt(token, propuestaId, nota));
      return true;
    } catch (err) {
      setNotaError(err.message);
      return false;
    } finally {
      setEnviando(null);
    }
  };

  const anularPropuesta = async (motivo) => {
    setEnviando('ANULAR');
    setAnularError(null);
    try {
      const propuesta = await anularPropuestaArt(token, propuestaId, motivo);
      setData(propuesta);
      // Las advertencias que hubiera (masa estimada, vault caído) eran del
      // armado o de la entrega: ya no describen a esta propuesta.
      setAdvertencias([]);
      setAccionError(null);
      setAnularAbierto(false);
    } catch (err) {
      // El error se muestra DENTRO del modal, con el motivo todavía
      // escrito: si se cerrara, habría que volver a tipearlo.
      setAnularError(err.message);
    } finally {
      setEnviando(null);
    }
  };

  const descargarPdf = async () => {
    setEnviando('PDF');
    setAccionError(null);
    try {
      const blob = await descargarPdfPropuestaArt(token, propuestaId);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `propuesta-v${data?.version ?? ''}-${data?.aseguradora ?? ''}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);
    } catch (err) {
      setAccionError(err.message);
    } finally {
      setEnviando(null);
    }
  };

  const volverBtn = (
    <button
      type="button"
      onClick={onVolver}
      className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition"
    >
      <Icon name="arrow-left" size={14} />
      {volverLabel}
    </button>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {volverBtn}
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="h-40 bg-slate-800/50 rounded-xl border border-slate-700" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        {volverBtn}
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-200 text-sm">No se pudo cargar la propuesta. {error}</p>
            <button type="button" onClick={cargar} className="mt-2 text-sm text-red-300 hover:text-white underline">
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const estado = estadoPropuestaInfo(data.estado_efectivo);
  const confianza = confianzaMasaInfo(data.confianza_masa);
  const acciones = ACCIONES_POR_ESTADO[data.estado] || [];
  const puedeAnular = ESTADOS_ANULABLES.includes(data.estado);
  const anulada = data.estado === 'ANULADA';
  const origenAlicuota = confianzaAlicuotaInfo(data.origen_alicuota);
  // Una propuesta anulada no "vence": ya tuvo su desenlace. Mostrarle
  // "venció hace 3 días" al lado sugeriría que sigue en el circuito.
  const validez = anulada ? null : diasRestantesTexto(data.dias_restantes);

  return (
    <div className="space-y-6">
      {volverBtn}

      {/* Cabecera + acciones */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold">
              Propuesta v{data.version} · {aseguradoraLabel(data.aseguradora)}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Emitida el {fechaCorta(data.fecha_emision) || VACIO}
              {data.fecha_entrega ? ` · entregada el ${fechaCorta(data.fecha_entrega)}` : ''}
            </p>
            {/* El motivo va acá arriba, no escondido: es lo que explica por
                qué esta propuesta está fuera del circuito. */}
            {anulada && (
              <p className="text-amber-300/90 text-sm mt-2">
                Anulada{data.fecha_anulacion ? ` el ${fechaCorta(data.fecha_anulacion)}` : ''}
                {data.motivo_anulacion ? `: ${data.motivo_anulacion}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded text-xs font-medium ${estado.badge}`}>
              {estado.label}
            </span>
            {/* La bandera que decide la leyenda del PDF. Va como badge y no
                en letra chica: es la diferencia entre una referencia y una
                cotización en firme. */}
            {data.sujeta_a_f931 && (
              <span className="px-2.5 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-300">
                Sujeta a F.931
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={descargarPdf}
            disabled={enviando === 'PDF'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700/50 hover:bg-slate-700 text-slate-200 transition disabled:opacity-50"
          >
            <Icon name="document-text" size={14} />
            {enviando === 'PDF' ? 'Generando...' : 'Descargar PDF'}
          </button>
          {acciones.map((accion) => (
            <button
              key={accion.estado}
              type="button"
              onClick={() => ejecutarAccion(accion)}
              disabled={enviando !== null}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${accion.clase}`}
            >
              {enviando === accion.estado ? 'Guardando...' : accion.label}
            </button>
          ))}
          {/* Anular va separado y al final, con borde en vez de relleno: no
              es un paso más del circuito comercial (entregar, aceptar,
              rechazar) sino la salida para una propuesta que se armó mal.
              Se indexa por `estado` guardado y no por `estado_efectivo`,
              igual que las otras acciones: una VENCIDA sigue siendo un
              BORRADOR o una ENTREGADA por debajo, y esas se anulan. */}
          {puedeAnular && (
            <button
              type="button"
              onClick={() => { setAnularError(null); setAnularAbierto(true); }}
              disabled={enviando !== null}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-red-500/50 text-red-300 hover:bg-red-500/10 transition disabled:opacity-50"
            >
              Anular
            </button>
          )}
        </div>

        {accionError && (
          <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-200 text-sm">{accionError}</p>
          </div>
        )}

        {advertencias.length > 0 && (
          <ul className="text-xs text-amber-300/90 space-y-0.5">
            {advertencias.map((texto, idx) => (
              <li key={idx}>· {texto}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Resumen del cliente: lo mismo que dice el PDF */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
          Lo que ve el cliente
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Dato label="Alícuota ofertada">
            <span className="text-lg font-semibold text-slate-100">
              {decimalAr(data.alicuota_ofertada, { maximumFractionDigits: 3 })}%
            </span>
            {/* De dónde salió el número, como badge y con el MISMO estilo
                de contorno que en la grilla. Distinto del badge de la masa
                (pastilla llena, más abajo) a propósito: una masa
                confirmada por F.931 no dice nada sobre si la alícuota es
                una cotización real o una mediana de mercado. */}
            <span
              className={`inline-block w-fit mt-1 px-2 py-0.5 rounded text-[11px] font-medium ${origenAlicuota.badge}`}
              title={origenAlicuota.ayuda}
            >
              {origenAlicuota.label}
            </span>
          </Dato>

          <Dato label="Alícuota actual">
            {data.tarifa_actual === null || data.tarifa_actual === undefined ? (
              <span className="text-slate-600">{VACIO}</span>
            ) : (
              <>
                {decimalAr(data.tarifa_actual, { maximumFractionDigits: 3 })}%
                <span className="block text-[11px] text-slate-500">
                  {aseguradoraLabel(data.art_actual)}
                </span>
              </>
            )}
          </Dato>

          <Dato label="Ahorro anual">
            {/* null NO es 0: sin tarifa actual conocida no hay ahorro que
                calcular, y un "$ 0" diría que no ahorra nada. */}
            <Importe
              valor={data.ahorro_anual}
              className={Number(data.ahorro_anual) > 0 ? 'text-green-400 font-semibold' : 'text-red-400'}
            />
            {(data.ahorro_anual === null || data.ahorro_anual === undefined) && (
              <span className="block text-[11px] text-slate-500">
                falta confirmar qué paga hoy
              </span>
            )}
          </Dato>

          <Dato label="Validez">
            {fechaCorta(data.valida_hasta) || VACIO}
            {validez && (
              <span className={`block text-[11px] ${data.dias_restantes < 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                {validez}
              </span>
            )}
          </Dato>

          <Dato label="LRT mensual"><Importe valor={data.lrt_mensual} /></Dato>
          <Dato label="LRT anual"><Importe valor={data.lrt_anual} /></Dato>
          <Dato label="Costo × trabajador (mes)">
            <Importe valor={data.costo_x_trabajador_mensual} />
          </Dato>
          <Dato label="Masa salarial / dotación">
            <Importe valor={data.masa_salarial} />
            <span className="block text-[11px] text-slate-500">
              {data.dotacion} trabajadores
            </span>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-medium ${confianza.badge}`}>
              {confianza.label}
            </span>
          </Dato>
        </div>

        {data.observaciones && (
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wide">Observaciones</p>
            <p className="text-slate-300 text-sm mt-1">{data.observaciones}</p>
          </div>
        )}
      </div>

      {/* Bloque interno, colapsado */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <button
          type="button"
          onClick={() => setInternoAbierto((abierto) => !abierto)}
          aria-expanded={internoAbierto}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-700/30 transition"
        >
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
              Rentabilidad (interno)
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              No sale en el PDF del cliente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data.bajo_umbral && (
              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300">
                Bajo umbral
              </span>
            )}
            <Icon
              name="chevron-down"
              size={16}
              className={`text-slate-400 transition-transform ${internoAbierto ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {internoAbierto && (
          <div className="px-6 pb-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-700 pt-4">
            <Dato label="Comisión bruta"><Importe valor={data.comision_bruta} /></Dato>
            <Dato label="Comisión neta"><Importe valor={data.comision_neta} /></Dato>
            <Dato label="Win"><Importe valor={data.win} className="text-blue-300" /></Dato>
            <Dato label="Win × trabajador"><Importe valor={data.w_x_trbj} className="text-blue-300" /></Dato>
          </div>
        )}
      </div>

      <ConstanciaDocumento data={data} />

      {/* Bitácora: debajo del resumen y de la rentabilidad, que es el orden
          en que se lee la pantalla (qué se ofreció -> cuánto deja -> qué
          pasó). `notas` puede no venir en una respuesta vieja cacheada, de
          ahí el fallback a lista vacía. */}
      <Bitacora
        notas={data.notas || []}
        enviando={enviando === 'NOTA'}
        error={notaError}
        onAgregar={agregarNota}
      />

      {accionPendiente && (
        <MotivoModal
          titulo={`${accionPendiente.titulo} · v${data.version}`}
          descripcion={accionPendiente.descripcion}
          placeholder={accionPendiente.placeholder}
          confirmarLabel={accionPendiente.confirmar}
          enviandoLabel={accionPendiente.enviandoLabel}
          claseConfirmar={accionPendiente.claseConfirmar}
          maxLength={1000}
          pie="Los números y el PDF de la propuesta no se tocan: la nota cuenta lo que pasó después."
          enviando={enviando === accionPendiente.estado}
          error={motivoError}
          onCancelar={() => setAccionPendiente(null)}
          onConfirmar={confirmarMotivo}
        />
      )}

      {anularAbierto && (
        <MotivoModal
          titulo={`Anular propuesta v${data.version}`}
          descripcion={'Anular no es lo mismo que rechazar: "rechazada" es la respuesta del cliente. Se anula una propuesta que no debió existir (alícuota mal cargada, empresa equivocada, precio que la aseguradora dio de baja).'}
          placeholder="Por qué se anula"
          confirmarLabel="Anular propuesta"
          enviandoLabel="Anulando..."
          claseConfirmar="bg-red-600 hover:bg-red-500 text-white"
          pie="Si la propuesta ya se entregó, el PDF que tiene el cliente y su constancia no se tocan."
          enviando={enviando === 'ANULAR'}
          error={anularError}
          onCancelar={() => setAnularAbierto(false)}
          onConfirmar={anularPropuesta}
        />
      )}
    </div>
  );
};

export default ArtPropuestaDetalle;
