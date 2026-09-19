import React, { useState } from 'react';
import Modal from '../Modal';
import { importarSemilla } from './facturacionApi';
import { Campo, Tabla, botonPrimario, botonSecundario, inputClase } from './DireccionComunes';

// Importador de la semilla de Dirección.
// Backend: POST /api/v1/direccion/importar-semilla?dry_run=… (ADMIN).
//
// LA CORRIDA EN SECO ES OBLIGATORIA Y NO SE PUEDE SALTEAR. El primer POST
// SIEMPRE va con dry_run=true y lo único que hace es mostrar qué crearía.
// Recién con la propuesta a la vista aparece "Confirmar importación", y
// aparece HABILITADO sólo si:
//   - la corrida que se está mirando NO escribió (`escritura === false`), y
//   - no hay NI UNA fila rechazada.
// Una semilla con rechazados importada igual deja la base a medio cargar y
// nadie sabe qué quedó adentro; se arregla el archivo y se vuelve a correr
// en seco.
//
// UN 4xx NO SE REINTENTA. Se muestra el texto del backend tal cual: es un
// problema del archivo, y mandarlo otra vez da exactamente el mismo error.

const TABLAS = ['frentes', 'decisiones', 'workers', 'proveedores', 'hallazgos', 'credenciales'];

const ModalImportarSemilla = ({ token, onCerrar, onImportado }) => {
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [datos, setDatos] = useState(null);
  const [errorArchivo, setErrorArchivo] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const elegir = async (e) => {
    const file = e.target.files?.[0];
    setNombreArchivo(file?.name || '');
    setDatos(null); setPrevia(null); setResultado(null); setError(null); setErrorArchivo(null);
    if (!file) return;
    try {
      const texto = await file.text();
      const json = JSON.parse(texto);
      if (!json || typeof json !== 'object' || Array.isArray(json)) {
        throw new Error('El archivo tiene que ser un objeto JSON con las tablas de la semilla.');
      }
      setDatos(json);
    } catch (err) {
      setErrorArchivo(`No se pudo leer el archivo: ${err.message}`);
    }
  };

  const correr = async (dryRun) => {
    setTrabajando(true); setError(null);
    try {
      const r = await importarSemilla(token, datos, dryRun);
      if (dryRun) { setPrevia(r); setResultado(null); }
      else { setResultado(r); setPrevia(r); onImportado?.(); }
    } catch (err) {
      // Un 4xx es el archivo, no la red: se muestra textual y no se
      // reintenta solo.
      setError(err.message);
    } finally { setTrabajando(false); }
  };

  const rechazados = previa?.rechazados || [];
  // Habilitado SÓLO si lo que estoy mirando es una corrida en seco limpia.
  const puedeConfirmar = Boolean(previa) && previa.escritura === false && rechazados.length === 0;

  return (
    <Modal title="Importar semilla de Dirección" onClose={onCerrar}>
      <div className="space-y-4">
        <p className="text-slate-400 text-xs">
          Carga inicial idempotente: lo que ya existe no se toca. Siempre se corre primero en seco y recién
          después se confirma.
        </p>

        <Campo label="Archivo .json de la semilla" ayuda={nombreArchivo || undefined}>
          <input type="file" accept="application/json,.json" className={inputClase} onChange={elegir} />
        </Campo>

        {errorArchivo && (
          <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
            {errorArchivo}
          </div>
        )}

        {error && (
          <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm">
            <p className="font-medium">El backend rechazó la importación</p>
            <p className="text-xs mt-1 break-words">{error}</p>
            <p className="text-red-200/80 text-xs mt-1">
              No se reintenta: corregí el archivo y volvé a correr la simulación.
            </p>
          </div>
        )}

        {datos && !previa && (
          <button className={botonPrimario} onClick={() => correr(true)} disabled={trabajando}>
            {trabajando ? 'Simulando…' : 'Simular importación (dry run)'}
          </button>
        )}

        {previa && (
          <div className="space-y-3">
            <div
              role="status"
              className={`rounded-lg border px-3 py-2 text-sm ${previa.escritura
                ? 'bg-green-500/15 border-green-500/50 text-green-100'
                : 'bg-blue-500/15 border-blue-500/40 text-blue-100'}`}
            >
              {previa.escritura
                ? 'Importación ejecutada: lo de abajo YA se escribió en la base.'
                : 'Corrida en seco: NO se escribió nada todavía. Esto es lo que se crearía.'}
            </div>

            <Tabla columnas={['Tabla', 'A crear', 'Ya existen']}>
              {TABLAS.filter((t) => previa.tablas?.[t]).map((t) => {
                const fila = previa.tablas[t];
                return (
                  <tr key={t}>
                    <td className="px-4 py-2 text-slate-200">{t}</td>
                    <td className="px-4 py-2 text-white">
                      {fila.a_crear?.length || 0}
                      {fila.a_crear?.length > 0 && (
                        <span className="block text-slate-500 text-[11px] break-words">{fila.a_crear.join(', ')}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {fila.ya_existen?.length || 0}
                      {fila.ya_existen?.length > 0 && (
                        <span className="block text-slate-600 text-[11px] break-words">{fila.ya_existen.join(', ')}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Tabla>

            {rechazados.length > 0 ? (
              <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-100 text-sm font-medium">
                  {rechazados.length} fila(s) rechazada(s): no se puede confirmar
                </p>
                <Tabla columnas={['Tabla', 'Clave', 'Motivo']}>
                  {rechazados.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-slate-200">{r.tabla}</td>
                      <td className="px-4 py-2 text-slate-300">{r.clave || '—'}</td>
                      <td className="px-4 py-2 text-red-200 text-xs break-words">{r.motivo}</td>
                    </tr>
                  ))}
                </Tabla>
                <p className="text-red-200/80 text-xs mt-2">
                  Corregí esas filas en el archivo y volvé a simular. Importar con rechazados deja la carga a medias.
                </p>
              </div>
            ) : (
              <p className="text-slate-500 text-xs">Ninguna fila rechazada.</p>
            )}

            {resultado && (
              <div role="status" className="bg-green-500/15 border border-green-500/50 rounded-lg p-3 text-green-100 text-sm">
                Importación terminada.
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button className={botonSecundario} onClick={onCerrar}>Cerrar</button>
          {previa && !resultado && (
            <>
              <button className={botonSecundario} onClick={() => correr(true)} disabled={trabajando}>
                Volver a simular
              </button>
              <button
                className={botonPrimario}
                disabled={!puedeConfirmar || trabajando}
                title={puedeConfirmar ? undefined : 'Sólo se puede confirmar una corrida en seco sin filas rechazadas'}
                onClick={() => correr(false)}
              >
                {trabajando ? 'Importando…' : 'Confirmar importación'}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ModalImportarSemilla;
