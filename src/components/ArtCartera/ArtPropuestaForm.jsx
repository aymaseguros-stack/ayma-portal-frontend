import React, { useState } from 'react';
import Modal from '../Modal';
import { crearPropuestaArt } from './artCarteraApi';
import {
  ORIGENES_ALICUOTA_PROPUESTA,
  aseguradoraLabel,
  decimalAr,
} from './artCarteraConstants';

const labelClass = 'block text-slate-400 text-sm mb-1.5';
const inputClass = 'w-full px-3 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

// Rango COMERCIAL de la alícuota ofertada: 0,5% a 20%, los dos extremos
// incluidos. No es el rango del backend -que valida (0, 10], ver
// RANGO_TARIFA_MAX en app/services/motor_art.py- sino el de lo que una ART
// cotiza de verdad: por debajo de 0,5% no existe precio de mercado y un
// 0,25% tipeado es casi siempre un 2,5% al que se le fue la coma, que es
// el error caro (la propuesta sale con un precio diez veces menor al que
// la aseguradora pasó).
//
// Entre 10 y 20 la validación de acá deja pasar y el backend rechaza con
// 422; ese mensaje se muestra tal cual y dice el rango exacto y el valor
// que llegó. El backend sigue siendo la fuente de verdad.
const ALICUOTA_MIN = 0.5;
const ALICUOTA_MAX = 20;

// "0,5" con coma: la pantalla está en español y el separador decimal
// argentino es la coma, aunque el input numérico use punto.
const decimalTexto = (n) => String(n).replace('.', ',');

// Modal "Armar propuesta" de la grilla de cotización -> POST
// /art/empresas/{id}/propuestas.
//
// VIENE PRELLENADO CON LA FILA desde la que se abrió: la aseguradora y su
// alícuota de referencia. La alícuota queda EDITABLE porque el número de
// la grilla puede ser una mediana de mercado y lo que se va a ofrecer es
// el precio que la aseguradora terminó pasando - obligar a re-tipearlo
// desde cero invita a errores de tipeo sobre un dato que ya estaba bien.
//
// El selector de origen arranca en lo que dice la grilla (BENCHMARK si la
// alícuota es de referencia, COTIZACION_REAL si es propia): al entregar,
// sólo una COTIZACION_REAL se asienta como alícuota de la empresa en el
// backend, así que la elección tiene consecuencias más allá de esta
// pantalla y está a la vista con su explicación, no en un tooltip.
const ArtPropuestaForm = ({
  token,
  empresaId,
  aseguradora,
  alicuotaSugerida,
  origenSugerido,
  onClose,
  onCreada,
}) => {
  const [alicuota, setAlicuota] = useState(
    alicuotaSugerida === null || alicuotaSugerida === undefined ? '' : String(alicuotaSugerida),
  );
  const [origen, setOrigen] = useState(
    origenSugerido === 'PROPIA_VIGENTE' || origenSugerido === 'PROPIA_CADUCADA'
      ? 'COTIZACION_REAL'
      : 'BENCHMARK',
  );
  const [observaciones, setObservaciones] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const validar = () => {
    const numero = Number(alicuota);
    if (!alicuota.trim() || !Number.isFinite(numero)) {
      return 'Cargá la alícuota ofertada.';
    }
    if (numero < ALICUOTA_MIN || numero > ALICUOTA_MAX) {
      return `La alícuota ofertada tiene que estar entre ${decimalTexto(ALICUOTA_MIN)}% y ${decimalTexto(ALICUOTA_MAX)}% (llegó ${decimalTexto(numero)}%).`;
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const mensaje = validar();
    if (mensaje) {
      setError(mensaje);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const resultado = await crearPropuestaArt(token, empresaId, {
        aseguradora,
        alicuota_ofertada: Number(alicuota),
        origen_alicuota: origen,
        observaciones: observaciones.trim() || null,
      });
      onCreada(resultado);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  const seleccionado = ORIGENES_ALICUOTA_PROPUESTA.find((o) => o.id === origen);

  return (
    <Modal onClose={onClose} title="Armar propuesta">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-400">
          Propuesta para <span className="text-slate-200">{aseguradoraLabel(aseguradora)}</span>.
          Los números quedan congelados con la masa salarial y los parámetros de hoy:
          después no cambian aunque cambie la grilla.
        </p>

        <div>
          <label className={labelClass} htmlFor="propuesta-alicuota">Alícuota ofertada (%)</label>
          {/* Sin `min`/`max` nativos a propósito: con ellos el browser
              bloquea el submit y muestra su propio globo ("Value must be
              less than or equal to 20"), en inglés y sin decir por qué ese
              es el tope. El rango se valida en `validar()`, en el mismo
              idioma que el resto de la pantalla.

              `select()` al enfocar porque el campo VIENE PRELLENADO con la
              alícuota de la grilla: lo normal es reemplazarla entera por
              el precio que pasó la aseguradora, y sin esto el cursor cae
              donde se hizo clic y queda "2.52.850". Es el error que no se
              ve al tipearlo. */}
          <input
            id="propuesta-alicuota"
            type="number"
            step="0.001"
            value={alicuota}
            onFocus={(e) => e.target.select()}
            onChange={(e) => { setAlicuota(e.target.value); setError(null); }}
            className={inputClass}
            placeholder="Ej: 2.850"
          />
          <p className="text-xs text-slate-500 mt-1.5">
            {alicuotaSugerida !== null && alicuotaSugerida !== undefined && (
              <>
                La grilla trae {decimalAr(alicuotaSugerida, { maximumFractionDigits: 3 })}%. Editala
                si la aseguradora pasó otro precio.{' '}
              </>
            )}
            Entre {decimalTexto(ALICUOTA_MIN)}% y {decimalTexto(ALICUOTA_MAX)}%.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="propuesta-origen">Origen de la alícuota</label>
          <select
            id="propuesta-origen"
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            className={inputClass}
          >
            {ORIGENES_ALICUOTA_PROPUESTA.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>{opcion.label}</option>
            ))}
          </select>
          {seleccionado && (
            <p className="text-xs text-slate-500 mt-1.5">{seleccionado.ayuda}</p>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="propuesta-observaciones">Observaciones</label>
          <textarea
            id="propuesta-observaciones"
            rows={3}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className={inputClass}
            placeholder="Opcional. Sale impreso en el PDF que recibe la empresa."
          />
        </div>

        {error && (
          <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
          >
            {enviando ? 'Armando...' : 'Armar propuesta'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ArtPropuestaForm;
