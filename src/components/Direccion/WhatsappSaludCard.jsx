import React, { useCallback, useEffect, useState } from 'react';
import { CONFIG_LABEL, horaMeta, saludWhatsapp } from '../Crm/whatsappApi';
import { Cargando, ErrorCarga, Panel, botonSecundario } from './DireccionComunes';
import { cartelSalud } from './direccionConstantes';

// C-4c · Estado de la integración de WhatsApp (GET /admin/whatsapp/salud).
//
// LO QUE FALTA VA EN ROJO Y POR NOMBRE. El backend devuelve la configuración
// en booleanos -nunca un valor- y la lista `faltan`; acá se muestra cada
// variable con su estado, y las que faltan resaltadas, porque "WhatsApp no
// anda" sin decir qué variable de Render no está cargada obliga a abrir el
// código. `campos_a_suscribir` y `webhook_path` van a la vista para cotejar
// contra la consola de Meta.

const Numero = ({ label, valor, alerta }) => (
  <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
    <p className="text-slate-400 text-[11px] uppercase tracking-wide">{label}</p>
    <p className={`mt-1 text-lg font-semibold ${alerta ? 'text-red-300' : 'text-white'}`}>{valor ?? '—'}</p>
  </div>
);

const suma = (obj) => Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);

const WhatsappSaludCard = ({ token }) => {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try { setDatos(await saludWhatsapp(token)); }
    catch (err) { setError(err.message); setDatos(null); }
    finally { setCargando(false); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const faltan = new Set(datos?.faltan || []);
  const config = datos?.configuracion || {};
  // C-4a3: el veredicto es del backend (whatsapp.evaluar_estado) y vale
  // OK | DEGRADADO | ALERTA. No se recalcula acá: hasta C-4a3 el front
  // pintaba verde todo lo que no fuera ALERTA, o sea OK con las cuatro
  // credenciales vacías.
  const estado = datos?.estado || null;
  const fallidos = (datos?.texto_por_estado?.FALLIDO || 0) + (datos?.media_por_estado?.FALLIDO || 0);

  return (
    <Panel
      titulo="WhatsApp"
      subtitulo="Estado de la integración con Meta (coexistencia)."
      acciones={
        <button type="button" className={botonSecundario} onClick={cargar} disabled={cargando}>
          {cargando ? 'Consultando…' : 'Actualizar'}
        </button>
      }
    >
      <div className="p-4 space-y-4" data-testid="whatsapp-salud">
        {cargando && !datos && <Cargando texto="Consultando…" />}
        {error && !cargando && <ErrorCarga mensaje={error} que="el estado de WhatsApp" onReintentar={cargar} />}

        {datos && (
          <>
            <div
              role="status"
              data-estado={estado || 'SIN_DATO'}
              className={`rounded-lg border p-3 text-sm font-semibold ${cartelSalud(estado)}`}
            >
              {estado || 'SIN DATO'}
              {!config.WHATSAPP_ENABLED && ' · módulo apagado (el webhook contesta 200 sin procesar)'}
              {(datos.alertas || []).length > 0 && (
                <ul className="mt-2 list-disc pl-5 font-normal space-y-1">
                  {datos.alertas.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
            </div>

            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Configuración (Render)</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.keys(config).map((clave) => {
                  const falta = faltan.has(clave) || (clave === 'WHATSAPP_ENABLED' && !config[clave]);
                  const esFaltante = faltan.has(clave);
                  return (
                    <li
                      key={clave}
                      data-testid={`cfg-${clave}`}
                      data-falta={esFaltante ? 'si' : 'no'}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                        esFaltante
                          ? 'bg-red-500/15 border-red-500/60 text-red-200'
                          : falta
                            ? 'bg-slate-800 border-slate-600 text-slate-300'
                            : 'bg-green-500/10 border-green-500/40 text-green-200'
                      }`}
                    >
                      <span>
                        <span className="font-mono text-xs">{clave}</span>
                        <span className="block text-xs opacity-80">{CONFIG_LABEL[clave] || ''}</span>
                      </span>
                      <span className="font-semibold text-xs whitespace-nowrap">
                        {esFaltante ? 'FALTA' : config[clave] ? 'Cargada' : 'Apagado'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Numero label="Último mensaje" valor={datos.ultimo_mensaje_recibido_en ? horaMeta(datos.ultimo_mensaje_recibido_en) : 'Nunca'} />
              <Numero label="Últimas 24 h" valor={suma(datos.ultimas_24h_por_origen)} />
              <Numero label="Números sin clasificar" valor={datos.numeros_sin_clasificar} />
              <Numero label="En FALLIDO" valor={fallidos} alerta={fallidos > 0} />
              <Numero label="Textos en cola" valor={datos.textos_en_cola} />
              <Numero label="Mensajes sin persona" valor={datos.mensajes_sin_persona} />
              <Numero label="Evidencias emitidas" valor={datos.evidencias_emitidas} />
            </div>

            <p className="text-xs text-slate-400">
              Webhook: <code>{datos.webhook_path}</code>
              {datos.campos_a_suscribir && (
                <> · campos a suscribir en Meta: <code>{datos.campos_a_suscribir.join(', ')}</code> (no <code>history</code>)</>
              )}
            </p>
          </>
        )}
      </div>
    </Panel>
  );
};

export default WhatsappSaludCard;
