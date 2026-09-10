import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import {
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
import { fechaCorta } from './artFechas';

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
const ACCIONES_POR_ESTADO = {
  BORRADOR: [{ estado: 'ENTREGADA', label: 'Marcar entregada', clase: 'bg-blue-600 hover:bg-blue-500 text-white' }],
  ENTREGADA: [
    { estado: 'ACEPTADA', label: 'Aceptada', clase: 'bg-green-600 hover:bg-green-500 text-white' },
    { estado: 'RECHAZADA', label: 'Rechazada', clase: 'bg-slate-700 hover:bg-slate-600 text-slate-200' },
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

// Modal de anulación. El botón de confirmar arranca DESHABILITADO y sólo
// se habilita con un motivo no vacío: el motivo es lo único que después
// distingue "se cargó mal la alícuota" de "la aseguradora dio de baja la
// cotización", y una propuesta que desaparece de la vista sin decir por
// qué es indistinguible de un dato perdido. La misma regla la vuelve a
// aplicar el backend (422), esto es sólo para no hacer el viaje.
const AnularModal = ({ version, enviando, error, onCancelar, onConfirmar }) => {
  const [motivo, setMotivo] = useState('');
  const vacio = !motivo.trim();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Anular propuesta v{version}</h3>
          <p className="text-slate-400 text-sm mt-1">
            Anular no es lo mismo que rechazar: "rechazada" es la respuesta del cliente.
            Se anula una propuesta que no debió existir (alícuota mal cargada, empresa
            equivocada, precio que la aseguradora dio de baja).
          </p>
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
            maxLength={500}
            placeholder="Por qué se anula"
            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-500"
          />
        </label>

        {error && (
          <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <p className="text-[11px] text-slate-500">
          Si la propuesta ya se entregó, el PDF que tiene el cliente y su constancia no
          se tocan.
        </p>

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
            className="px-3 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando ? 'Anulando...' : 'Anular propuesta'}
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

  const cambiarEstado = async (estado) => {
    setEnviando(estado);
    setAccionError(null);
    try {
      const resultado = await cambiarEstadoPropuestaArt(token, propuestaId, estado);
      setData(resultado.propuesta);
      setAdvertencias(resultado.advertencias || []);
    } catch (err) {
      // El 409 del backend trae la instrucción de qué hacer ("cargar F.931
      // primero"), así que se muestra tal cual en vez de un "no se pudo".
      setAccionError(err.message);
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
              onClick={() => cambiarEstado(accion.estado)}
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

      {anularAbierto && (
        <AnularModal
          version={data.version}
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
