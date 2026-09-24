import React, { useCallback, useEffect, useState } from 'react';
import { saludSistema } from './direccionApi';
import { cartelSalud, etiqueta } from './direccionConstantes';
import { Badge, Cargando, ErrorCarga, Panel, Tabla, botonSecundario } from './DireccionComunes';

// C-4a3 · Estado global del sistema (GET /admin/salud).
//
// TRES VALORES, NO DOS. ALERTA (rojo) si alguna señal lo está; si no,
// DEGRADADO (ámbar) si alguna lo está; si no, OK. DEGRADADO es "apagado o a
// medio configurar" -hoy, WhatsApp sin credenciales- y no manda mail: por
// eso se lista aparte de las señales en alerta. Mezclarlas pintaría de rojo
// algo que puede estar apagado a propósito, y una alerta que suena siempre
// se ignora.
const ListaSenales = ({ titulo, senales, clase, testid }) => {
  if (!senales || senales.length === 0) return null;
  return (
    <div data-testid={testid}>
      <p className="text-xs uppercase tracking-wide opacity-80 mt-2">{titulo}</p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {senales.map((s) => (
          <li key={s} className={`px-2 py-0.5 rounded-full text-xs font-medium ${clase}`}>{etiqueta(s)}</li>
        ))}
      </ul>
    </div>
  );
};

const SaludSistemaCard = ({ token }) => {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try { setDatos(await saludSistema(token)); }
    catch (err) { setError(err.message); setDatos(null); }
    finally { setCargando(false); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const senales = Object.entries(datos?.senales || {});

  return (
    <Panel
      titulo="Estado del sistema"
      subtitulo="Las señales de detección, en vivo (no es el histórico)."
      acciones={
        <button type="button" className={botonSecundario} onClick={cargar} disabled={cargando}>
          {cargando ? 'Consultando…' : 'Actualizar'}
        </button>
      }
    >
      <div className="p-4 space-y-4" data-testid="salud-sistema">
        {cargando && !datos && <Cargando texto="Consultando…" />}
        {error && !cargando && <ErrorCarga mensaje={error} que="el estado del sistema" onReintentar={cargar} />}

        {datos && (
          <>
            <div
              role="status"
              data-estado={datos.estado}
              className={`rounded-lg border p-3 text-sm font-semibold ${cartelSalud(datos.estado)}`}
            >
              {datos.estado || 'SIN DATO'}
              {datos.estado === 'DEGRADADO' && (
                <span className="font-normal"> · hay algo apagado o a medio configurar (no manda mail)</span>
              )}
              <ListaSenales
                titulo="Señales en alerta"
                senales={datos.senales_en_alerta}
                clase="bg-red-500/20 text-red-200"
                testid="senales-en-alerta"
              />
              <ListaSenales
                titulo="Señales degradadas"
                senales={datos.senales_degradadas}
                clase="bg-amber-500/20 text-amber-200"
                testid="senales-degradadas"
              />
            </div>

            {senales.length > 0 && (
              <Tabla columnas={['Señal', 'Estado', 'Nota']}>
                {senales.map(([nombre, s]) => (
                  <tr key={nombre}>
                    <td className="px-4 py-2.5 text-white">{etiqueta(nombre)}</td>
                    <td className="px-4 py-2.5"><Badge valor={s?.estado} /></td>
                    <td className="px-4 py-2.5 text-slate-300 text-xs">
                      {s?.nota || (Array.isArray(s?.alertas) && s.alertas.length > 0 ? s.alertas.join(' · ') : '—')}
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
          </>
        )}
      </div>
    </Panel>
  );
};

export default SaludSistemaCard;
