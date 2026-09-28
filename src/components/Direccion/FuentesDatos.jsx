import React, { useCallback, useEffect, useState } from 'react';
import ConfirmarModal from '../ConfirmarModal';
import { altaDirectorio, listarFuentesDatos } from '../ArtCartera/artPazApi';
import { fechaHora } from '../../utils/fechas';
import {
  DELAY_MAX_S, MAX_PAGINAS_MAX, PROVINCIAS_AR, TIPOS_DIRECTORIO,
  bodyDirectorio, codigoGuardado, erroresDirectorio,
} from './fuentesDatosConstantes';
import {
  Campo, Cargando, ErrorCarga, EstadoVacio, Panel, Tabla, botonPrimario, botonSecundario, inputClase,
} from './DireccionComunes';

const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';
const guion = <span className="text-slate-500">—</span>;
const esHttp = (url) => /^https?:\/\//i.test(String(url || '').trim());

// Permitida / prohibida sale de `permitida_worker` EFECTIVA del backend: una
// prohibida por código (MATER II, LinkedIn, Nosis, Google Places...) sigue
// prohibida aunque alguien haya puesto el flag a mano. Esta pantalla no
// tiene -ni puede tener- un botón para habilitarla: el backend no expone
// ningún endpoint que la edite.
const ChipEstado = ({ f }) => {
  if (f.permitida_worker) return <span className={`${badgeBase} bg-green-500/20 text-green-300`}>Permitida</span>;
  return (
    <span
      className={`${badgeBase} bg-red-500/20 text-red-300`}
      title={f.prohibida_por_codigo ? 'Prohibida por código: no se habilita' : 'No habilitada para el worker'}
    >
      Prohibida{f.prohibida_por_codigo ? ' (código)' : ''}
    </span>
  );
};

const Enlace = ({ url, texto }) => {
  if (!url) return guion;
  if (!esHttp(url)) return <span className="text-slate-400 break-all">{url}</span>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 text-xs">{texto}</a>;
};

const FORM_VACIO = {
  codigo: '',
  nombre: '',
  url_semilla: '',
  terminos_url: '',
  robots_ok: false,
  requiere_login: false,
  tipos_permitidos: [...TIPOS_DIRECTORIO],
  licencia: '',
  nota: '',
  delay_min_s: '',
  max_paginas_corrida: '',
  localidad_default: '',
  provincia_default: '',
};

const FilaPrevia = ({ label, valor }) => (
  <div className="flex gap-3 text-sm">
    <dt className="text-slate-400 w-44 shrink-0">{label}</dt>
    <dd className="text-slate-200 break-all">{valor === null || valor === undefined || valor === '' ? '—' : String(valor)}</dd>
  </div>
);

// Alta de un directorio (POST /art/fuentes-datos/directorios). PROC-2:
// Previsualizar = dry_run=true (no escribe) → Confirmar = dry_run=false,
// con ConfirmarModal. Si el formulario cambia después de previsualizar, la
// previsualización se descarta: lo que se confirma es lo que se miró.
const AltaDirectorio = ({ token, onCreada }) => {
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState({});
  const [previa, setPrevia] = useState(null);
  const [error, setError] = useState(null);
  const [enCurso, setEnCurso] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [aviso, setAviso] = useState(null);

  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setPrevia(null);
    setAviso(null);
  };
  const alternarTipo = (t) => set(
    'tipos_permitidos',
    form.tipos_permitidos.includes(t) ? form.tipos_permitidos.filter((x) => x !== t) : [...form.tipos_permitidos, t],
  );

  const previsualizar = async (e) => {
    e.preventDefault();
    const errs = erroresDirectorio(form);
    setErrores(errs);
    setError(null);
    setPrevia(null);
    if (Object.keys(errs).length) return;
    setEnCurso(true);
    try {
      setPrevia(await altaDirectorio(token, bodyDirectorio(form), { dryRun: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setEnCurso(false);
    }
  };

  const confirmarAlta = async () => {
    const r = await altaDirectorio(token, bodyDirectorio(form), { dryRun: false });
    setConfirmar(false);
    setPrevia(null);
    setForm(FORM_VACIO);
    setAviso(`Directorio ${r?.codigo || codigoGuardado(form.codigo)} dado de alta.`);
    onCreada?.();
  };

  const err = (k) => errores[k] && <span className="block text-[11px] text-red-300 mt-1">{errores[k]}</span>;

  return (
    <Panel titulo="Alta de directorio" subtitulo="Confianza siempre BAJA. Previsualizar no escribe nada; Confirmar da de alta.">
      <form onSubmit={previsualizar} className="p-4 space-y-3" aria-label="Alta de directorio">
        {aviso && <p role="status" className="text-sm text-green-300 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">{aviso}</p>}
        {error && <ErrorCarga mensaje={error} que="previsualizar el directorio" />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label="Código (sin prefijo)" ayuda={<>Se guarda como <span className="text-slate-300 font-mono" data-testid="codigo-guardado">{codigoGuardado(form.codigo)}</span></>}>
            <input className={inputClase} value={form.codigo} onChange={(e) => set('codigo', e.target.value)} maxLength={60} />
            {err('codigo')}
          </Campo>
          <Campo label="Nombre">
            <input className={inputClase} value={form.nombre} onChange={(e) => set('nombre', e.target.value)} maxLength={150} />
            {err('nombre')}
          </Campo>
          <Campo label="URL semilla (página de socios)">
            <input className={inputClase} value={form.url_semilla} onChange={(e) => set('url_semilla', e.target.value)} maxLength={500} />
            {err('url_semilla')}
          </Campo>
          <Campo label="URL de términos">
            <input className={inputClase} value={form.terminos_url} onChange={(e) => set('terminos_url', e.target.value)} maxLength={500} />
            {err('terminos_url')}
          </Campo>
          <Campo label="Localidad por defecto">
            <input className={inputClase} value={form.localidad_default} onChange={(e) => set('localidad_default', e.target.value)} maxLength={150} />
          </Campo>
          <Campo label="Provincia por defecto">
            <select className={inputClase} value={form.provincia_default} onChange={(e) => set('provincia_default', e.target.value)}>
              <option value="">Sin provincia</option>
              {PROVINCIAS_AR.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {err('provincia_default')}
          </Campo>
          <Campo label="Pausa mínima por dominio (s)" ayuda={`0 a ${DELAY_MAX_S}. Vacío = la del robots.txt o 1 s.`}>
            <input type="number" min={0} max={DELAY_MAX_S} className={inputClase} value={form.delay_min_s} onChange={(e) => set('delay_min_s', e.target.value)} />
            {err('delay_min_s')}
          </Campo>
          <Campo label="Tope de páginas por corrida" ayuda={`1 a ${MAX_PAGINAS_MAX}. Aplica con pausa de 30 s o más.`}>
            <input type="number" min={1} max={MAX_PAGINAS_MAX} className={inputClase} value={form.max_paginas_corrida} onChange={(e) => set('max_paginas_corrida', e.target.value)} />
            {err('max_paginas_corrida')}
          </Campo>
          <Campo label="Licencia">
            <input className={inputClase} value={form.licencia} onChange={(e) => set('licencia', e.target.value)} maxLength={100} />
          </Campo>
          <Campo label="Nota">
            <input className={inputClase} value={form.nota} onChange={(e) => set('nota', e.target.value)} maxLength={1000} />
          </Campo>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <fieldset>
            <legend className="text-slate-400 text-xs mb-1">Tipos que aporta</legend>
            <div className="flex gap-3">
              {TIPOS_DIRECTORIO.map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-slate-200">
                  <input type="checkbox" checked={form.tipos_permitidos.includes(t)} onChange={() => alternarTipo(t)} />
                  {t}
                </label>
              ))}
            </div>
            {err('tipos_permitidos')}
          </fieldset>
          <div>
            <label className="flex items-center gap-1.5 text-slate-200">
              <input type="checkbox" checked={form.robots_ok} onChange={(e) => set('robots_ok', e.target.checked)} />
              El robots.txt permite leer la página
            </label>
            {err('robots_ok')}
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-slate-200">
              <input type="checkbox" checked={form.requiere_login} onChange={(e) => set('requiere_login', e.target.checked)} />
              Requiere login
            </label>
            {err('requiere_login')}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={botonSecundario} disabled={enCurso}>
            {enCurso ? 'Previsualizando…' : 'Previsualizar'}
          </button>
          <button type="button" className={botonPrimario} disabled={!previa || enCurso} onClick={() => setConfirmar(true)}>
            Confirmar alta
          </button>
        </div>

        {previa && (
          <div className="border border-slate-600 rounded-lg p-3 space-y-1" data-testid="previa-directorio">
            <p className="text-sm text-amber-300 mb-2">
              Previsualización: {previa.escritura ? 'escrita' : 'no se escribió nada'}.
            </p>
            <dl className="space-y-1">
              <FilaPrevia label="Código" valor={previa.codigo} />
              <FilaPrevia label="Nombre" valor={previa.nombre} />
              <FilaPrevia label="Fuente" valor={previa.fuente} />
              <FilaPrevia label="Estado" valor={previa.permitida_worker ? 'Permitida' : 'Prohibida'} />
              <FilaPrevia label="Confianza máxima" valor={previa.confianza_max} />
              <FilaPrevia label="Tipos" valor={(previa.tipos_permitidos || []).join(', ')} />
              <FilaPrevia label="URL semilla" valor={previa.url_semilla} />
              <FilaPrevia label="Términos" valor={previa.terminos_url} />
              <FilaPrevia label="Localidad por defecto" valor={previa.localidad_default} />
              <FilaPrevia label="Provincia por defecto" valor={previa.provincia_default} />
              <FilaPrevia label="Pausa mínima (s)" valor={previa.delay_min_s} />
              <FilaPrevia label="Tope de páginas" valor={previa.max_paginas_corrida} />
            </dl>
          </div>
        )}
      </form>
      {confirmar && previa && (
        <ConfirmarModal
          titulo="Confirmar alta de directorio"
          mensaje={`Se da de alta ${previa.codigo} (${previa.nombre}), habilitado para @PAZ con confianza ${previa.confianza_max}.`}
          textoConfirmar="Dar de alta"
          onConfirmar={confirmarAlta}
          onCancelar={() => setConfirmar(false)}
        />
      )}
    </Panel>
  );
};

// Vista "Fuentes de datos" de Dirección → Proveedores (@PAZ,
// OPERACIONES-0016). El listado es de sólo lectura; lo único que se escribe
// desde acá es el alta de un directorio nuevo.
const FuentesDatos = ({ token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setData(await listarFuentesDatos(token)); }
    catch (err) { setError(err.message); setData(null); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <div className="space-y-4">
      {error && <ErrorCarga mensaje={error} que="las fuentes de datos" onReintentar={cargar} />}
      <Panel titulo="Fuentes de datos" subtitulo="De dónde puede sacar contactos @PAZ. Las prohibidas no se habilitan desde acá.">
        {loading ? <Cargando /> : error ? null : items.length === 0 ? (
          <EstadoVacio titulo="Todavía no hay fuentes cargadas" detalle="La semilla la carga el backend al arrancar." icono="document-text" />
        ) : (
          <Tabla columnas={['Código', 'Nombre', 'Estado', 'Confianza máx.', 'Tipos', 'Términos', 'Localidad', 'Provincia', 'Pausa (s)', 'Tope páginas', 'Alta']}>
            {items.map((f) => (
              <tr key={f.codigo} data-testid="fila-fuente" data-permitida={f.permitida_worker ? 'true' : 'false'}>
                <td className="px-4 py-2.5 text-slate-200 font-mono text-xs whitespace-nowrap">
                  {f.codigo}
                  {f.es_plantilla && <span className="block text-[11px] text-slate-500 font-sans">plantilla</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-200">{f.nombre}</td>
                <td className="px-4 py-2.5"><ChipEstado f={f} /></td>
                <td className="px-4 py-2.5 text-slate-300">{f.confianza_max}</td>
                <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{(f.tipos_permitidos || []).join(', ') || '—'}</td>
                <td className="px-4 py-2.5"><Enlace url={f.terminos_url} texto="Ver" /></td>
                <td className="px-4 py-2.5 text-slate-300">{f.localidad_default || guion}</td>
                <td className="px-4 py-2.5 text-slate-300">{f.provincia_default || guion}</td>
                <td className="px-4 py-2.5 text-slate-300">{f.delay_min_s ?? guion}</td>
                <td className="px-4 py-2.5 text-slate-300">{f.max_paginas_corrida ?? guion}</td>
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap text-xs">{fechaHora(f.creado_en) || '—'}</td>
              </tr>
            ))}
          </Tabla>
        )}
      </Panel>
      <AltaDirectorio token={token} onCreada={cargar} />
    </div>
  );
};

export default FuentesDatos;
