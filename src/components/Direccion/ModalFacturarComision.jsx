import React, { useState } from 'react';
import Modal from '../Modal';
import { facturarComision } from './facturacionApi';
import {
  CONDICIONES_IVA, RECEPTOR_VACIO, TIPOS_DOCUMENTO, claseAmbiente, esProduccion,
  nuevaClaveIdempotencia, textoAmbiente,
} from './facturacionConstantes';
import { etiqueta, formatearMonto } from './direccionConstantes';
import { periodoLegible } from './finanzasConstantes';
import {
  CartelAmbiente, CartelApagado, DetalleArca, ResumenComprobante,
} from './DireccionFacturacion';
import { Campo, botonPrimario, botonSecundario, inputClase } from './DireccionComunes';

// "Emitir Factura C" desde una comisión liquidada.
// Backend: POST /api/v1/finanzas/comisiones-liquidadas/{id}/facturar (PR #169).
//
// TRES RESPUESTAS QUE ESTA PANTALLA TIENE QUE DISTINGUIR:
//
//  - 201/200: el comprobante se creó. `estado` dice si ARCA lo autorizó; un
//    201 NO es "autorizado".
//  - 422 `datos_de_la_compania_incompletos`: el padrón de proveedores no
//    alcanzó. NO es un error a mostrar y listo: se abre el mini formulario
//    del receptor para completarlo y reenviar, y se sugiere cargar el CUIT
//    en Proveedores para que la próxima salga sola.
//  - 409: ya está facturada (o la liquidación está anulada). Es un mensaje
//    claro, no un error crudo: no hay nada que reintentar.
//
// El cuerpo normal va VACÍO: la compañía, el importe, la moneda y el período
// los saca el backend de la liquidación y del padrón.
const ModalFacturarComision = ({ token, comision, ambiente, onCerrar, onEmitida }) => {
  const [paso, setPaso] = useState('confirmar');
  const [receptor, setReceptor] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [apagado, setApagado] = useState(null);
  const [yaFacturada, setYaFacturada] = useState(null);
  const [faltantes, setFaltantes] = useState([]);
  const [candidatos, setCandidatos] = useState([]);
  const [resultado, setResultado] = useState(null);

  // Una clave por intento, conservada entre reintentos del MISMO envío.
  const [clave, setClave] = useState(() => nuevaClaveIdempotencia());

  const enviar = async (conReceptor, claveEnvio = clave) => {
    setEnviando(true); setError(null); setApagado(null); setYaFacturada(null);
    try {
      const factura = await facturarComision(
        token, comision.id, conReceptor ? { receptor: conReceptor } : {}, claveEnvio,
      );
      setResultado(factura);
      setPaso('resultado');
      onEmitida?.();
    } catch (err) {
      if (err.status === 422 && err.faltantes) {
        // El padrón no alcanzó: se pide el snapshot fiscal a mano.
        setFaltantes(err.faltantes);
        setCandidatos(err.candidatos || []);
        setReceptor((previo) => previo || { ...RECEPTOR_VACIO, razon_social: comision.compania });
        setError(err.message);
        setPaso('receptor');
      } else if (err.status === 409) {
        setYaFacturada(err.message);
      } else if (err.apagado) {
        setApagado(err);
      } else {
        setError(err.message);
      }
    } finally { setEnviando(false); }
  };

  const set = (campo) => (e) => setReceptor({ ...receptor, [campo]: e.target.value });

  return (
    <Modal title="Emitir Factura C a la compañía" onClose={onCerrar}>
      {apagado && <CartelApagado mensaje={apagado.message} faltantes={apagado.faltantes} />}

      {yaFacturada && (
        <div role="alert" className="bg-yellow-500/15 border border-yellow-500/50 rounded-lg p-3 text-sm">
          <p className="text-yellow-100 font-medium">Esta liquidación ya está facturada</p>
          <p className="text-yellow-200/90 text-xs mt-1">{yaFacturada}</p>
          <p className="text-yellow-200/80 text-xs mt-1">
            No hay nada que reintentar. Para volver a facturarla hay que anular ese comprobante con una nota de
            crédito, y eso libera la liquidación automáticamente.
          </p>
        </div>
      )}

      {error && !yaFacturada && (
        <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm mb-3">
          {error}
        </div>
      )}

      {paso === 'confirmar' && !yaFacturada && (
        <div className="space-y-4">
          {/* EL AMBIENTE, EN GRANDE, ANTES DE EMITIR. */}
          <CartelAmbiente ambiente={ambiente} />
          {esProduccion(ambiente) && (
            <p role="alert" className="text-red-200 text-sm">
              Esto emite un comprobante REAL ante ARCA a nombre de la compañía.
            </p>
          )}

          <div className="bg-slate-900/60 border border-slate-600 rounded-lg p-3 space-y-2 text-sm">
            <p className="text-slate-400 text-xs">Compañía</p>
            <p className="text-white font-medium">{comision.compania}</p>
            <p className="text-slate-400 text-xs pt-2">Período</p>
            <p className="text-slate-100">{periodoLegible(comision.periodo)} ({comision.periodo})</p>
            <p className="text-slate-400 text-xs pt-2">Importe</p>
            <p className="text-white font-bold text-lg">{formatearMonto(comision.monto, comision.moneda)}</p>
            <p className="text-slate-500 text-xs pt-2">
              Concepto: Comisiones {comision.ramo} período {comision.periodo}. El receptor se resuelve contra el
              padrón de proveedores (ASEGURADORA/ART, con CUIT).
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button className={botonSecundario} onClick={onCerrar} disabled={enviando}>Cancelar</button>
            <button className={botonPrimario} onClick={() => enviar(null)} disabled={enviando}>
              {enviando ? 'Emitiendo…' : `Emitir en ${textoAmbiente(ambiente)}`}
            </button>
          </div>
        </div>
      )}

      {paso === 'receptor' && receptor && (
        <div className="space-y-4">
          <div role="alert" className="bg-yellow-500/15 border border-yellow-500/50 rounded-lg p-3 text-sm">
            <p className="text-yellow-100 font-medium">Faltan los datos fiscales de la compañía</p>
            <p className="text-yellow-200/90 text-xs mt-1">
              Falta: <strong>{faltantes.join(', ')}</strong>. Completalos acá para emitir ahora — no se adivinan.
            </p>
            <p className="text-yellow-200/80 text-xs mt-1">
              Para que la próxima salga sola, cargá el CUIT de <strong>{comision.compania}</strong> en
              Dirección &gt; Proveedores (tipo ASEGURADORA o ART).
            </p>
            {candidatos.length > 0 && (
              <p className="text-yellow-200/80 text-xs mt-1">
                Proveedores candidatos: {candidatos.map((c) => c.nombre || c).join(', ')}
              </p>
            )}
          </div>

          <div className={`rounded-lg border px-3 py-2 ${claseAmbiente(ambiente)}`}>
            <span className="text-xs">Se emite en ambiente </span>
            <strong className="text-sm">{textoAmbiente(ambiente)}</strong>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Campo label="Razón social">
              <input className={inputClase} value={receptor.razon_social} onChange={set('razon_social')} required />
            </Campo>
            <Campo label="Tipo de documento">
              <select className={inputClase} value={receptor.tipo_documento} onChange={set('tipo_documento')}>
                {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}
              </select>
            </Campo>
            <Campo label="CUIT">
              <input className={inputClase} value={receptor.numero_documento} onChange={set('numero_documento')} required />
            </Campo>
            <Campo label="Condición frente al IVA">
              <select className={inputClase} value={receptor.condicion_iva} onChange={set('condicion_iva')} required>
                <option value="">Elegir…</option>
                {CONDICIONES_IVA.map((c) => <option key={c} value={c}>{etiqueta(c)}</option>)}
              </select>
            </Campo>
            <Campo label="Domicilio">
              <input className={inputClase} value={receptor.domicilio || ''} onChange={set('domicilio')} />
            </Campo>
            <Campo label="Email">
              <input type="email" className={inputClase} value={receptor.email || ''} onChange={set('email')} />
            </Campo>
          </div>

          <div className="flex gap-3 justify-end">
            <button className={botonSecundario} onClick={onCerrar} disabled={enviando}>Cancelar</button>
            <button
              className={botonPrimario}
              disabled={enviando || !receptor.razon_social || !receptor.numero_documento || !receptor.condicion_iva}
              onClick={() => {
                // Cambió lo que se va a emitir -> clave nueva. La anterior
                // identifica un envío que el backend rechazó sin emitir.
                const nueva = nuevaClaveIdempotencia();
                setClave(nueva);
                enviar(receptor, nueva);
              }}
            >
              {enviando ? 'Emitiendo…' : 'Emitir con estos datos'}
            </button>
          </div>
        </div>
      )}

      {paso === 'resultado' && resultado && (
        <div className="space-y-4">
          {resultado.__reusado && (
            <div role="status" className="bg-blue-500/15 border border-blue-500/40 rounded-lg p-3 text-blue-100 text-sm">
              Ya se había enviado con la misma clave de idempotencia: este es el comprobante original, no se emitió
              uno nuevo.
            </div>
          )}
          <ResumenComprobante factura={resultado} />
          <DetalleArca factura={resultado} />
          <div className="flex justify-end">
            <button className={botonSecundario} onClick={onCerrar}>Cerrar</button>
          </div>
        </div>
      )}

      {(yaFacturada || apagado) && paso !== 'resultado' && (
        <div className="flex justify-end pt-4">
          <button className={botonSecundario} onClick={onCerrar}>Cerrar</button>
        </div>
      )}
    </Modal>
  );
};

export default ModalFacturarComision;
