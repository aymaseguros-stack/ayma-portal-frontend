import React, { useState } from 'react';
import { Icon } from '../Icons';
import { DIAGNOSTICOS, sanear } from './diagnosticosCatalogo';
import { Cargando, ErrorCarga, Panel, botonPrimario, botonSecundario } from './DireccionComunes';

// Diagnósticos del sistema, en pantalla.
//
// POR QUÉ EXISTE: `GET /api/v1/admin/drive/estado` contesta las cuatro
// preguntas que el 19 y el 20-Sep hubo que ir a buscar a los logs de Render
// (¿autentica?, ¿como quién?, ¿con qué scopes?, ¿puede escribir?), pero pide
// un JWT de admin, así que la única forma de leerlo era un script de consola.
// Un diagnóstico que sólo se puede correr desde la consola no lo corre nadie:
// es el mismo modo de falla que el endpoint venía a terminar.
//
// EL REGISTRO ES EL PUNTO DE EXTENSIÓN. Sumar salud o migraciones es agregar
// una entrada a DIAGNOSTICOS con su `ejecutar` y su `destacados`; el botón,
// el estado de carga, el cartel de error, el saneo de secretos y el bloque
// copiable ya están escritos una sola vez, acá abajo. El registro vive en
// diagnosticosCatalogo.js.

const textoValor = (v) => {
  if (v === true) return 'Sí';
  if (v === false) return 'No';
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.join('\n');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const Destacado = ({ label, valor }) => {
  const booleano = typeof valor === 'boolean';
  const color = !booleano ? 'text-white' : valor ? 'text-green-300' : 'text-red-300';
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 min-w-0">
      <p className="text-slate-400 text-[11px] uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-sm font-semibold break-all whitespace-pre-wrap ${color}`}>{textoValor(valor)}</p>
    </div>
  );
};

// El error de Google TAL CUAL lo devolvió el backend. No se reescribe, no se
// resume y no se reemplaza por "hubo un problema": los dos incidentes de
// Drive se diagnosticaron leyendo literalmente `storageQuotaExceeded` y
// `unauthorized_client`, y un mensaje maquillado los habría tapado.
const ErrorDeGoogle = ({ resultado }) => {
  if (!resultado?.error) return null;
  return (
    <div role="alert" className="bg-red-500/15 border border-red-500/50 rounded-lg p-4">
      <p className="text-red-200 text-sm font-semibold flex items-center gap-2">
        <Icon name="exclamation-triangle" size={16} className="shrink-0" />
        Error que devolvió Google, sin retocar
      </p>
      <pre className="mt-2 text-red-100 text-xs whitespace-pre-wrap break-all">{resultado.error}</pre>
      {resultado.reason && (
        <p className="text-red-200/80 text-xs mt-2">reason: <code>{resultado.reason}</code></p>
      )}
    </div>
  );
};

const BloqueCrudo = ({ resultado }) => {
  const texto = JSON.stringify(sanear(resultado), null, 2);
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS): el texto está a la vista
      // y es seleccionable, así que no se rompe nada. No se avisa un error
      // por algo que el usuario puede resolver con Ctrl+C.
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-slate-400 text-xs">
          Respuesta completa del endpoint. Pegala tal cual si hay que pedir ayuda.
        </p>
        <button type="button" className={botonSecundario} onClick={copiar}>
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre
        data-testid="respuesta-cruda"
        className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 text-xs overflow-x-auto max-h-96 whitespace-pre"
      >
        {texto}
      </pre>
    </div>
  );
};

const TarjetaDiagnostico = ({ token, diagnostico }) => {
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [corriendo, setCorriendo] = useState(false);

  const correr = async () => {
    setCorriendo(true); setError(null);
    try { setResultado(await diagnostico.ejecutar(token)); }
    catch (err) { setError(err.message); setResultado(null); }
    finally { setCorriendo(false); }
  };

  const veredicto = resultado ? diagnostico.veredicto(resultado) : undefined;

  return (
    <Panel
      titulo={diagnostico.titulo}
      subtitulo={diagnostico.descripcion}
      acciones={
        <button className={botonPrimario} onClick={correr} disabled={corriendo}>
          {corriendo ? 'Probando…' : diagnostico.boton}
        </button>
      }
    >
      <div className="p-4 space-y-4">
        {corriendo && <Cargando texto="Probando…" />}

        {/* Un fallo del PEDIDO (401, 403, 502, red) no es lo mismo que un
            fallo de Drive: se muestra distinto para no confundir "no pude
            preguntar" con "Drive no anda". */}
        {error && !corriendo && (
          <ErrorCarga mensaje={error} que="el diagnóstico" onReintentar={correr} />
        )}

        {!corriendo && !error && !resultado && (
          <p className="text-slate-400 text-sm">
            Todavía no se corrió. Apretá <strong>{diagnostico.boton}</strong> para probarlo ahora con tu sesión.
          </p>
        )}

        {!corriendo && resultado && (
          <>
            <div
              role="status"
              className={`rounded-lg border p-3 text-sm font-semibold ${
                veredicto === true
                  ? 'bg-green-500/15 border-green-500/50 text-green-200'
                  : 'bg-red-500/15 border-red-500/50 text-red-200'
              }`}
            >
              {veredicto === true
                ? 'Escribe en Drive correctamente.'
                : veredicto === false
                  ? 'NO pudo escribir en Drive.'
                  : 'No se llegó a probar la escritura: la credencial no autenticó.'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {diagnostico.destacados(resultado).map((d) => <Destacado key={d.label} {...d} />)}
            </div>

            {veredicto !== true && <ErrorDeGoogle resultado={resultado} />}

            <BloqueCrudo resultado={resultado} />
          </>
        )}
      </div>
    </Panel>
  );
};

const DireccionDiagnosticos = ({ token }) => (
  <div className="space-y-4">
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 flex items-start gap-3">
      <Icon name="magnifying-glass" size={18} className="text-slate-400 shrink-0 mt-0.5" />
      <p className="text-slate-300 text-sm">
        Cada prueba corre <strong>en el momento</strong> y con tu sesión de admin, contra el backend de producción.
        La respuesta se muestra entera, sin resumir. No se guarda nada.
      </p>
    </div>

    {DIAGNOSTICOS.map((d) => <TarjetaDiagnostico key={d.id} token={token} diagnostico={d} />)}
  </div>
);

export default DireccionDiagnosticos;
