import React, { useState } from 'react';
import Modal from '../Modal';
import { subirF931Pdf } from './artF931Api';
import {
  chequeosF931, estadoF931Info, mensajeErrorF931, motivoF931Label, motivosDesconocidos, periodoF931,
} from './artF931Constants';
import { pctDosDecimales } from './artCerviConstants';
import { decimalAr, numeroAr, pesosAr } from './artCarteraConstants';

const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';

const Fila = ({ label, valor, testid }) => (
  <div className="flex justify-between gap-3 py-1 border-b border-slate-700/50 last:border-0" data-testid={testid}>
    <span className="text-slate-400">{label}</span>
    <span className="text-slate-100 text-right">{valor ?? '—'}</span>
  </div>
);

const Foto = ({ titulo, f }) => (
  <div className="bg-slate-700/30 rounded-lg p-3 text-sm">
    <p className="text-xs text-slate-400 uppercase mb-1">{titulo}</p>
    <p className="text-slate-100">
      {f?.dotacion === null || f?.dotacion === undefined ? '—' : numeroAr(f.dotacion)} trabajadores
    </p>
    <p className="text-xs text-slate-400">
      {f?.dotacion_fuente || 'sin fuente'} · {f?.dotacion_confianza_lectura || '—'}
    </p>
    <p className="text-xs text-slate-400">Masa estimada {pesosAr(f?.masa_estimada_lectura) || '—'}</p>
  </div>
);

// "Subir F931 (PDF)" de la ficha ART (OPERACIONES-0010 · @VALENTINI,
// backend PR #216).
//
// DOS PASOS, SIEMPRE. Elegir el archivo dispara SÓLO el dry_run: el backend
// lee el PDF, valida y dice qué pasaría (APLICADO o PROPUESTO) sin escribir.
// Grabar es el botón "Confirmar", que manda el MISMO archivo con
// dry_run=false. Ningún número se calcula acá.
//
// UN 4xx NO SE REINTENTA: se muestra y queda en pantalla. Para probar con
// otro PDF se elige otro archivo.
const ArtF931PdfModal = ({ token, cuit, razonSocial, onClose, onGrabado }) => {
  const [archivo, setArchivo] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [final, setFinal] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const elegir = async (e) => {
    const f = e.target.files?.[0] || null;
    setArchivo(f);
    setPrevia(null);
    setFinal(null);
    setError(null);
    if (!f) return;
    setEnviando(true);
    try {
      setPrevia(await subirF931Pdf(token, cuit, f, { dryRun: true }));
    } catch (err) {
      setError(mensajeErrorF931(err));
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = async () => {
    if (!archivo || !previa) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await subirF931Pdf(token, cuit, archivo, { dryRun: false });
      setFinal(r);
      onGrabado?.(r);
    } catch (err) {
      setError(mensajeErrorF931(err));
    } finally {
      setEnviando(false);
    }
  };

  const r = final || previa;
  const ex = r?.extraido;
  const val = r?.validacion;
  const motivos = val?.motivos || [];
  const ev = val?.evidencia || {};
  const info = estadoF931Info(val?.estado);
  const extras = motivosDesconocidos(motivos);

  return (
    <Modal title={`Subir F931 (PDF) · ${razonSocial || cuit}`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4 text-sm">
        <p className="text-slate-400">
          Subí el F.931 descargado de ARCA. Primero se muestra lo que se leyó y la validación; no se graba nada hasta
          confirmar. No se guarda el PDF ni ningún CUIL.
        </p>
        <div>
          <label className="block text-slate-400 text-xs mb-1" htmlFor="f931-pdf">Archivo PDF</label>
          <input
            id="f931-pdf"
            type="file"
            accept="application/pdf,.pdf"
            onChange={elegir}
            disabled={enviando || !!final}
            className="block w-full text-sm text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-200"
          />
        </div>

        {enviando && <p className="text-slate-400" role="status">{previa ? 'Grabando…' : 'Leyendo el PDF…'}</p>}
        {error && (
          <p role="alert" className="text-red-200 bg-red-500/15 border border-red-500/50 rounded-lg px-3 py-2" data-testid="f931-error">
            {error}
          </p>
        )}

        {r && ex && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400 uppercase mb-1">Leído del PDF</p>
                <Fila label="CUIT" valor={ex.cuit} testid="f931-cuit" />
                <Fila label="Período" valor={periodoF931(ex.periodo)} testid="f931-periodo" />
                <Fila label="Rectificativa" valor={ex.rectificativa === 0 ? 'Original (0)' : ex.rectificativa} />
                <Fila label="Dotación (CUILES con ART)" valor={numeroAr(ex.dotacion_f931)} testid="f931-dotacion" />
                <Fila label="Masa (Remun. con ART)" valor={pesosAr(ex.masa_f931)} testid="f931-masa" />
                <Fila label="LRT fijo" valor={pesosAr(ex.lrt_fijo)} />
                <Fila label="LRT variable" valor={pesosAr(ex.lrt_variable)} />
                <Fila label="LRT total" valor={pesosAr(ex.lrt_total)} />
                <Fila label="Alícuota variable" valor={pctDosDecimales(ex.alicuota_variable_f931)} testid="f931-alicuota" />
                {(ex.dotacion_etiqueta || ex.masa_etiqueta) && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Etiquetas: {ex.dotacion_etiqueta || '—'} · {ex.masa_etiqueta || '—'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase mb-1">Validaciones</p>
                <ul className="space-y-1" data-testid="f931-validaciones">
                  {chequeosF931(motivos).map((c) => (
                    <li key={c.clave} className="flex items-start gap-2" data-testid={`f931-chequeo-${c.clave}`}>
                      <span className={`${badgeBase} ${c.ok ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {c.ok ? 'OK' : 'NO'}
                      </span>
                      <span className="text-slate-300">
                        {c.label}
                        {!c.ok && <span className="block text-xs text-red-300">{c.fallados.map(motivoF931Label).join(' · ')}</span>}
                      </span>
                    </li>
                  ))}
                  {extras.map((m) => (
                    <li key={m} className="flex items-start gap-2">
                      <span className={`${badgeBase} bg-red-500/20 text-red-300`}>NO</span>
                      <span className="text-slate-300">{m}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                  {ev.meses_antiguedad !== undefined && ev.meses_antiguedad !== null && (
                    <p>Antigüedad del período: {numeroAr(ev.meses_antiguedad)} meses</p>
                  )}
                  {ev.salario_f931 && <p>Salario F.931: {pesosAr(ev.salario_f931)}</p>}
                  {ev.salario_promedio_ciiu && (
                    <p>Salario CIIU {ev.ciiu || ''}{ev.version_cuadro ? ` (Cuadro 1 ${ev.version_cuadro})` : ''}: {pesosAr(ev.salario_promedio_ciiu)}</p>
                  )}
                  {ev.ratio && <p>Ratio: ×{decimalAr(ev.ratio)}</p>}
                  {ev.aplicado_posterior && <p>F.931 posterior aplicado: {periodoF931(ev.aplicado_posterior)}</p>}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Foto titulo="Antes" f={r.antes} />
              <Foto titulo={final ? 'Después' : 'Después (si se confirma)'} f={r.despues} />
            </div>

            <div className="rounded-lg border border-slate-700 p-3" data-testid={final ? 'f931-estado-final' : 'f931-estado-previo'}>
              <p className="text-xs text-slate-400 uppercase mb-1">{final ? 'Estado final' : 'Qué pasaría'}</p>
              <span className={`${badgeBase} ${info.clase}`}>{info.label}</span>
              <span className="ml-2 text-slate-300">{info.texto}</span>
              {final && final.f931_id !== null && final.f931_id !== undefined && (
                <span className="block text-xs text-slate-500 mt-1">F.931 #{final.f931_id}</span>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg bg-slate-700 text-sm">
            {final ? 'Cerrar' : 'Cancelar'}
          </button>
          {!final && (
            <button
              type="button"
              onClick={confirmar}
              disabled={!previa || enviando || !!error}
              className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium disabled:opacity-50"
            >
              Confirmar
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ArtF931PdfModal;
