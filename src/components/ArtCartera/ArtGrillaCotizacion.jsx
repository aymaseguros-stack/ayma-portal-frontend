import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import { obtenerGrillaArt } from './artCarteraApi';
import ArtF931Modal from './ArtF931Modal';
import ArtPropuestaForm from './ArtPropuestaForm';
import ArtPropuestaDetalle from './ArtPropuestaDetalle';
import {
  aseguradoraLabel,
  confianzaMasaInfo,
  decimalAr,
  estadoArtInfo,
  origenAlicuotaInfo,
  pesosAr,
  riesgoBadgeClass,
  variacionPct,
} from './artCarteraConstants';

const fechaCorta = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString('es-AR');
};

// El guion medio para "no hay dato". Se usa uno solo en todo el archivo a
// propósito: mezclar '-', '—' y '' hace que la tabla se lea como si
// hubiera tres clases distintas de vacío cuando hay una sola.
const VACIO = '—';

// Columnas del CSV que exporta el botón. Se arma en el CLIENTE sobre el
// JSON que ya está en pantalla (no hay un endpoint de CSV por empresa):
// lo que se baja es exactamente lo que se está viendo, sin una segunda
// llamada que podría traer otra cosa si alguien cargó una alícuota entre
// medio.
const COLUMNAS_CSV = [
  ['Aseguradora', (f) => aseguradoraLabel(f.aseguradora)],
  ['Estado', (f) => estadoArtInfo(f.estado_efectivo).label],
  ['Motivo', (f) => f.estado_motivo || ''],
  ['Vence', (f) => fechaCorta(f.estado_vence) || ''],
  ['Alicuota ref (%)', (f) => (f.alicuota_ref ?? '')],
  ['Origen alicuota', (f) => (f.origen_alicuota ? origenAlicuotaInfo(f.origen_alicuota).label : '')],
  ['Delta vs actual', (f) => (f.delta_vs_actual ?? '')],
  ['LRT mensual', (f) => (f.lrtm ?? '')],
  ['Ahorro anual', (f) => (f.ahorro_anual ?? '')],
  ['Comision neta', (f) => (f.comision_neta ?? '')],
];

// Escapa una celda para CSV: comillas dobles duplicadas y el valor entre
// comillas si trae coma, comilla o salto de línea. Sin esto, una razón
// social con coma parte la fila en dos al abrirla en Excel.
const celdaCsv = (valor) => {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

const armarCsv = (grilla) => {
  const encabezado = COLUMNAS_CSV.map(([titulo]) => celdaCsv(titulo)).join(',');
  const filas = (grilla.aseguradoras || []).map((fila) =>
    COLUMNAS_CSV.map(([, leer]) => celdaCsv(leer(fila))).join(','),
  );
  return [encabezado, ...filas].join('\n');
};

const descargarCsv = (grilla) => {
  const blob = new Blob([armarCsv(grilla)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `grilla-${grilla.cuit || grilla.empresa_id}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
};

// Un importe de la grilla. `null` NO se renderiza como 0 ni como "$ 0":
// cuando el backend no pudo estimar la masa manda null en todos los pesos
// (advertencia SIN_MASA), y un cero ahí afirmaría que no hay ahorro cuando
// lo que pasa es que no se sabe.
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

// Fila de la matriz. Las no cotizables van en gris con su motivo y su
// vencimiento a la vista: quien mira la grilla tiene que poder contestar
// "¿por qué no puedo cotizar acá y desde cuándo voy a poder?" sin abrir
// otra pantalla.
const FilaAseguradora = ({ fila, esMejor, onArmarPropuesta }) => {
  const cotizable = fila.estado_efectivo === 'COTIZABLE';
  const info = estadoArtInfo(fila.estado_efectivo);
  const origen = fila.origen_alicuota ? origenAlicuotaInfo(fila.origen_alicuota) : null;
  const benchmark = fila.alicuota_benchmark;
  const delta = fila.delta_vs_actual;
  const deltaNumero = delta === null || delta === undefined ? null : Number(delta);

  return (
    <tr
      className={
        esMejor
          ? 'bg-green-500/10 ring-1 ring-inset ring-green-500/40'
          : cotizable ? '' : 'opacity-50'
      }
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {esMejor && <Icon name="check-badge" size={14} className="text-green-400 shrink-0" />}
          <span className={esMejor ? 'font-semibold text-green-200' : 'text-slate-200'}>
            {aseguradoraLabel(fila.aseguradora)}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${info.badge}`}>
          {info.label}
        </span>
        {fila.estado_motivo && (
          <p className="text-[11px] text-slate-500 mt-1">{fila.estado_motivo}</p>
        )}
        {fila.estado_vence && (
          <p className="text-[11px] text-slate-500 mt-0.5">
            {fila.estado_efectivo === 'TECNICA' ? 'seguimiento: ' : 'hasta: '}
            {fechaCorta(fila.estado_vence)}
          </p>
        )}
      </td>

      <td className="px-4 py-3">
        {fila.alicuota_ref === null || fila.alicuota_ref === undefined ? (
          <span className="text-slate-600">{VACIO}</span>
        ) : (
          <>
            <span className="text-slate-100 font-semibold">
              {decimalAr(fila.alicuota_ref, { maximumFractionDigits: 3 })}%
            </span>
            {origen && (
              <p className="text-[11px] text-slate-500 mt-0.5" title={origen.ayuda}>
                {origen.label}
                {fila.origen_alicuota === 'BENCHMARK' && benchmark
                  ? ` · ${benchmark.nivel === 'SECCION' ? 'sector' : 'global'} (n=${benchmark.n_muestras})`
                  : ''}
              </p>
            )}
          </>
        )}
      </td>

      <td className="px-4 py-3">
        {deltaNumero === null ? (
          <span className="text-slate-600">{VACIO}</span>
        ) : (
          <span className={deltaNumero < 0 ? 'text-green-400' : 'text-red-400'}>
            {variacionPct(delta)}
          </span>
        )}
      </td>

      <td className="px-4 py-3"><Importe valor={fila.lrtm} /></td>

      <td className="px-4 py-3">
        <Importe
          valor={fila.ahorro_anual}
          className={Number(fila.ahorro_anual) > 0 ? 'text-green-400' : 'text-red-400'}
        />
      </td>

      <td className="px-4 py-3"><Importe valor={fila.comision_neta} /></td>

      {/* "Armar propuesta" SOLO en las filas cotizables y con alícuota: sin
          precio no hay nada que ofrecer, y sobre una bloqueada/rechazada/en
          técnica el botón prometería una gestión que hoy no se puede hacer.
          Las demás filas dejan la celda vacía en vez de un botón
          deshabilitado, que se lee como "algo salió mal". */}
      <td className="px-4 py-3 text-right">
        {cotizable && fila.alicuota_ref !== null && fila.alicuota_ref !== undefined && (
          <button
            type="button"
            onClick={() => onArmarPropuesta(fila)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition whitespace-nowrap"
          >
            <Icon name="document-text" size={13} />
            Armar propuesta
          </button>
        )}
      </td>
    </tr>
  );
};

// Grilla de cotización de una empresa (BLOQUE 1.2) - GET
// /art/empresas/{id}/grilla.
//
// NO ES UNA RUTA /art/empresas/:id/grilla: esta app no usa un router de
// URLs (todo el portal navega por estado, ver App.jsx y el docstring de
// ArtCarteraView.jsx, donde la ficha de empresa ya se abre con estado
// local en vez de una ruta /art/:cuit real). Se abre como drill-down desde
// la ficha, que es la única pantalla que tiene el `id` de la empresa - el
// listado (GET /art/empresas) devuelve CUIT pero no id.
const ArtGrillaCotizacion = ({ token, empresaId, onVolver }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalF931, setModalF931] = useState(false);
  // Drill-down a la propuesta, un nivel MÁS ADENTRO de la grilla: mismo
  // mecanismo de estado local que usa la grilla dentro de la ficha (la app
  // no tiene router de URLs - ver el docstring de ArtCarteraView.jsx). Al
  // volver, la grilla que quedó detrás sigue cargada.
  const [filaPropuesta, setFilaPropuesta] = useState(null);
  const [propuestaId, setPropuestaId] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await obtenerGrillaArt(token, empresaId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, empresaId]);

  useEffect(() => { cargar(); }, [cargar]);

  const mejorAseguradora = data?.mejor_oferta?.aseguradora ?? null;
  const sinMasa = useMemo(
    () => (data?.advertencias || []).includes('SIN_MASA'),
    [data],
  );

  if (propuestaId) {
    return (
      <ArtPropuestaDetalle
        token={token}
        propuestaId={propuestaId}
        onVolver={() => {
          setPropuestaId(null);
          // Se recarga la grilla al volver: entregar una propuesta con
          // origen COTIZACION_REAL asienta esa alícuota como propia de la
          // empresa, así que la fila de esa aseguradora ya no dice lo
          // mismo que antes de entrar.
          cargar();
        }}
      />
    );
  }

  const volverBtn = (
    <button
      type="button"
      onClick={onVolver}
      className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition"
    >
      <Icon name="arrow-left" size={14} />
      Volver a la ficha
    </button>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {volverBtn}
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="h-32 bg-slate-800/50 rounded-xl border border-slate-700" />
          <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700" />
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
            <p className="text-red-200 text-sm">No se pudo cargar la grilla. {error}</p>
            <button type="button" onClick={cargar} className="mt-2 text-sm text-red-300 hover:text-white underline">
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const masa = data.masa || {};
  const confianza = confianzaMasaInfo(data.confianza_masa);
  const filas = data.aseguradoras || [];

  return (
    <div className="space-y-6">
      {volverBtn}

      {/* Cabecera */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold">{data.razon_social || 'Empresa'}</h2>
            <p className="text-slate-400 text-sm mt-1">
              CUIT {data.cuit || VACIO}
              {data.ciiu ? ` · CIIU ${data.ciiu}` : ''}
              {data.ciiu_seccion ? ` (sección ${data.ciiu_seccion})` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded text-xs font-medium ${riesgoBadgeClass(data.riesgo_suscripcion)}`}>
              Riesgo {data.riesgo_suscripcion}
            </span>
            <button
              type="button"
              onClick={() => descargarCsv(data)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 transition"
            >
              <Icon name="clipboard" size={14} />
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Dato label="ART actual">
            {data.art_actual_display || aseguradoraLabel(data.art_actual)}
            {data.art_actual_origen === 'SRT' && (
              <span className="block text-[11px] text-slate-500">verificada en la SRT</span>
            )}
          </Dato>

          <Dato label="Tarifa actual">
            {data.tarifa_actual === null || data.tarifa_actual === undefined ? (
              <span className="text-slate-600">{VACIO}</span>
            ) : (
              <>
                {decimalAr(data.tarifa_actual, { maximumFractionDigits: 3 })}%
                {/* La tarifa sale de la planilla histórica, no de la
                    póliza: todo el delta y todo el ahorro cuelgan de
                    ella, así que la leyenda va al lado del número. */}
                <span className="block text-[11px] text-amber-400/90">a confirmar</span>
              </>
            )}
          </Dato>

          <Dato label="Masa salarial estimada">
            <Importe valor={masa.masa_mensual} />
            <span className={`block w-fit mt-1 px-2 py-0.5 rounded text-[11px] font-medium ${confianza.badge}`}>
              {confianza.label}
            </span>
          </Dato>

          <Dato label="Ahorro potencial">
            <Importe valor={data.ahorro_potencial_max} className="text-green-400 font-semibold" />
            {mejorAseguradora && (
              <span className="block text-[11px] text-slate-500">
                con {aseguradoraLabel(mejorAseguradora)}
              </span>
            )}
          </Dato>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
          <p className="text-xs text-slate-500">
            Dotación usada: {data.dotacion ?? VACIO}
            {masa.periodo_ref ? ` · período de referencia ${masa.periodo_ref}` : ''}
          </p>
          <button
            type="button"
            onClick={() => setModalF931(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition"
          >
            <Icon name="document-text" size={14} />
            Cargar F.931
          </button>
        </div>

        {sinMasa && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 flex items-start gap-2">
            <Icon name="exclamation-triangle" size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-200 text-sm">
              No se pudo estimar la masa salarial, así que los importes no se calculan
              (las alícuotas y la comparación contra la tarifa actual siguen siendo
              válidas). Cargá el F.931 para completarlos.
            </p>
          </div>
        )}

        {(masa.advertencias || []).length > 0 && (
          <ul className="text-xs text-slate-500 space-y-0.5">
            {masa.advertencias.map((texto, idx) => (
              <li key={idx}>· {texto}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Matriz */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="font-semibold">Grilla de cotización</h3>
          <p className="text-slate-500 text-sm mt-0.5">
            {filas.length} aseguradoras · {(data.ranking || []).length} cotizables hoy
            {mejorAseguradora ? ` · mejor oferta: ${aseguradoraLabel(mejorAseguradora)}` : ''}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-2 text-left text-slate-300 font-medium">Aseguradora</th>
                <th className="px-4 py-2 text-left text-slate-300 font-medium">Estado</th>
                <th className="px-4 py-2 text-left text-slate-300 font-medium">Alícuota ref.</th>
                <th className="px-4 py-2 text-left text-slate-300 font-medium">vs. actual</th>
                <th className="px-4 py-2 text-left text-slate-300 font-medium">LRT mensual</th>
                <th className="px-4 py-2 text-left text-slate-300 font-medium">Ahorro anual</th>
                <th className="px-4 py-2 text-left text-slate-300 font-medium">Comisión neta</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filas.map((fila) => (
                <FilaAseguradora
                  key={fila.aseguradora}
                  fila={fila}
                  esMejor={fila.aseguradora === mejorAseguradora}
                  onArmarPropuesta={setFilaPropuesta}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filaPropuesta && (
        <ArtPropuestaForm
          token={token}
          empresaId={empresaId}
          aseguradora={filaPropuesta.aseguradora}
          alicuotaSugerida={filaPropuesta.alicuota_ref}
          origenSugerido={filaPropuesta.origen_alicuota}
          onClose={() => setFilaPropuesta(null)}
          onCreada={(resultado) => {
            setFilaPropuesta(null);
            setPropuestaId(resultado.propuesta.id);
          }}
        />
      )}

      {modalF931 && (
        <ArtF931Modal
          token={token}
          empresaId={empresaId}
          razonSocial={data.razon_social}
          onClose={() => setModalF931(false)}
          onCargado={() => {
            setModalF931(false);
            cargar();
          }}
        />
      )}
    </div>
  );
};

export default ArtGrillaCotizacion;
