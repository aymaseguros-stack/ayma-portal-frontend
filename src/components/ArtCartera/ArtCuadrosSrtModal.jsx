import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import { cargarCuadrosSrt } from './artCuadrosSrtApi';
import { buscarCiiu } from './artCarteraApi';
import { decimalAr, numeroAr, pesosAr } from './artCarteraConstants';
import { codigosDelDiff, relacionCuadrosLabel, signado } from './artCuadrosSrtConstants';

const thClass = 'text-left px-2 py-1 font-medium whitespace-nowrap';
const tdClass = 'px-2 py-1';

// Tope de búsquedas de sector: el diff no trae la descripción del CIIU y el
// catálogo sólo se consulta por código. Más allá del tope, el sector sale
// "—" (el código sigue estando).
export const MAX_SECTORES = 60;

const Sector = ({ sectores, ciiu }) => {
  const s = sectores[ciiu];
  return <td className={`${tdClass} text-slate-400`}>{s || '—'}</td>;
};

const Tabla = ({ titulo, testid, cantidad, mostradas, columnas, children }) => (
  <div data-testid={testid} className="space-y-1">
    <p className="text-xs text-slate-400 uppercase">
      {titulo}: <strong className="text-slate-100">{numeroAr(cantidad ?? 0)}</strong>
      {cantidad > mostradas ? ` (se muestran ${numeroAr(mostradas)})` : ''}
    </p>
    {cantidad > 0 && (
      <div className="overflow-x-auto max-h-60 border border-slate-700 rounded-lg">
        <table className="w-full text-xs">
          <thead className="text-slate-400 border-b border-slate-700">
            <tr>{columnas.map((c) => <th key={c} className={thClass}>{c}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">{children}</tbody>
        </table>
      </div>
    )}
  </div>
);

const Diff = ({ diff, sectores }) => {
  if (!diff) {
    return (
      <p className="text-sm text-slate-400" data-testid="cuadros-sin-diff">
        Primera carga: no hay versión vigente contra la que comparar.
      </p>
    );
  }
  const nuevos = diff.ciiu_nuevos || { cantidad: 0, ciiu: [] };
  const desap = diff.ciiu_desaparecen || { cantidad: 0, ciiu: [] };
  const sal = diff.salario_cambia || { cantidad: 0, items: [] };
  const ali = diff.alicuota_tramo_cambia || { cantidad: 0, items: [] };
  return (
    <div className="space-y-3" data-testid="cuadros-diff">
      <p className="text-xs text-slate-500">
        Contra la vigente {diff.contra_version} · umbrales: salario &gt; {decimalAr(diff.umbral_salario_pct)} %,
        alícuota &gt; {decimalAr(diff.umbral_alicuota_pp)} pp
      </p>
      <Tabla titulo="CIIU nuevos" testid="diff-nuevos" cantidad={nuevos.cantidad} mostradas={nuevos.ciiu.length} columnas={['CIIU', 'Sector']}>
        {nuevos.ciiu.map((c) => <tr key={c}><td className={tdClass}>{c}</td><Sector sectores={sectores} ciiu={c} /></tr>)}
      </Tabla>
      <Tabla titulo="CIIU que desaparecen" testid="diff-desaparecen" cantidad={desap.cantidad} mostradas={desap.ciiu.length} columnas={['CIIU', 'Sector']}>
        {desap.ciiu.map((c) => <tr key={c}><td className={tdClass}>{c}</td><Sector sectores={sectores} ciiu={c} /></tr>)}
      </Tabla>
      <Tabla
        titulo="Salario que cambia más del umbral"
        testid="diff-salario"
        cantidad={sal.cantidad}
        mostradas={sal.items.length}
        columnas={['CIIU', 'Sector', 'Antes', 'Después', 'Variación']}
      >
        {sal.items.map((it) => (
          <tr key={it.ciiu}>
            <td className={tdClass}>{it.ciiu}</td>
            <Sector sectores={sectores} ciiu={it.ciiu} />
            <td className={`${tdClass} whitespace-nowrap`}>{pesosAr(it.salario_vigente)}</td>
            <td className={`${tdClass} whitespace-nowrap`}>{pesosAr(it.salario_nuevo)}</td>
            <td className={`${tdClass} whitespace-nowrap font-semibold`}>{signado(it.variacion_pct)} %</td>
          </tr>
        ))}
      </Tabla>
      <Tabla
        titulo="Alícuota de tramo que cambia más del umbral"
        testid="diff-alicuota"
        cantidad={ali.cantidad}
        mostradas={ali.items.length}
        columnas={['CIIU', 'Sector', 'Tramo', 'Antes', 'Después', 'Variación']}
      >
        {ali.items.map((it) => (
          <tr key={`${it.ciiu}-${it.tramo}`}>
            <td className={tdClass}>{it.ciiu}</td>
            <Sector sectores={sectores} ciiu={it.ciiu} />
            <td className={tdClass}>{it.tramo}</td>
            <td className={`${tdClass} whitespace-nowrap`}>{decimalAr(it.alicuota_vigente)} %</td>
            <td className={`${tdClass} whitespace-nowrap`}>{decimalAr(it.alicuota_nueva)} %</td>
            <td className={`${tdClass} whitespace-nowrap font-semibold`}>{signado(it.diferencia_pp)} pp</td>
          </tr>
        ))}
      </Tabla>
    </div>
  );
};

// "Cargar nueva versión" de los Cuadros 1 y 2 SRT (OPERACIONES-0010 paso 3,
// backend PR #221). DOS PASOS, SIEMPRE: elegir el xlsx dispara SÓLO el
// dry_run (el backend no escribe nada) y muestra la versión detectada, la
// cantidad de CIIU y el diff contra la vigente. Grabar es "Confirmar carga",
// que manda el MISMO archivo con dry_run=false. Un 4xx (409 = versión más
// vieja que la vigente) muestra su motivo y NO se reintenta.
const ArtCuadrosSrtModal = ({ token, onCerrar, onCargado }) => {
  const [archivo, setArchivo] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [final, setFinal] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [sectores, setSectores] = useState({});

  const elegir = async (e) => {
    const f = e.target.files?.[0] || null;
    setArchivo(f);
    setPrevia(null);
    setFinal(null);
    setError(null);
    setSectores({});
    if (!f) return;
    setEnviando(true);
    try {
      setPrevia(await cargarCuadrosSrt(token, f, { dryRun: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = async () => {
    if (!archivo || !previa) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await cargarCuadrosSrt(token, archivo, { dryRun: false });
      setFinal(r);
      onCargado?.(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  // Sector de cada CIIU del diff, desde el catálogo (sólo lectura). Una
  // falla deja el sector en "—": no bloquea la carga.
  useEffect(() => {
    if (!previa?.diff) return undefined;
    let cancelado = false;
    codigosDelDiff(previa.diff).slice(0, MAX_SECTORES).forEach((codigo) => {
      buscarCiiu(token, codigo, { limit: 5 })
        .then((r) => {
          const item = (r?.items || []).find((it) => String(it.codigo) === codigo);
          if (!cancelado && item?.descripcion) setSectores((prev) => ({ ...prev, [codigo]: item.descripcion }));
        })
        .catch(() => {});
    });
    return () => { cancelado = true; };
  }, [token, previa]);

  const r = final || previa;
  const bloqueo = previa?.bloquearia_409 || null;
  const confirmarDeshabilitado = !previa || enviando || !!error || !!bloqueo || !!final;

  return (
    <Modal title="Cuadros SRT · cargar nueva versión" onClose={onCerrar} maxWidth="max-w-4xl">
      <div className="space-y-4 text-sm">
        <p className="text-slate-400">
          Subí el xlsx de la SRT (Cuadros 1 y 2). Primero se muestra la versión detectada y el diff contra la vigente;
          no se graba nada hasta confirmar. La versión sale del título de la hoja, no del nombre del archivo.
        </p>
        <div>
          <label className="block text-slate-400 text-xs mb-1" htmlFor="cuadros-xlsx">Archivo xlsx</label>
          <input
            id="cuadros-xlsx"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={elegir}
            disabled={enviando || !!final}
            className="block text-slate-300 text-sm"
          />
        </div>
        {enviando && <p className="text-slate-400">{previa ? 'Grabando…' : 'Leyendo el archivo…'}</p>}

        {r && (
          <div className="space-y-3">
            <p className={final ? 'text-green-300' : 'text-amber-300'} data-testid="cuadros-estado">
              {final
                ? `Cargada: ${final.version} queda como vigente.`
                : `Simulación (no se escribió nada). Confirmá para grabar la versión ${r.version}.`}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1" data-testid="cuadros-version-detectada">
              <dt className="text-slate-400">Versión detectada</dt>
              <dd className="font-semibold text-slate-100">{r.version}</dd>
              {r.titulo && (<><dt className="text-slate-400">Título</dt><dd className="text-slate-300">{r.titulo}</dd></>)}
              {r.periodo_dato && (<><dt className="text-slate-400">Último período (Índice)</dt><dd className="text-slate-300">{r.periodo_dato}</dd></>)}
              <dt className="text-slate-400">Contra la vigente</dt>
              <dd className="text-slate-300">
                {relacionCuadrosLabel(r.relacion_con_vigente)}
                {r.version_vigente_antes?.version ? ` (${r.version_vigente_antes.version})` : ''}
              </dd>
              <dt className="text-slate-400">CIIU</dt>
              <dd className="text-slate-100" data-testid="cuadros-cantidad-ciiu">{numeroAr(r.cantidad_ciiu)}</dd>
            </dl>
            {bloqueo && (
              <p role="alert" className="text-sm text-red-300" data-testid="cuadros-bloquearia">
                No se puede confirmar: {bloqueo}
              </p>
            )}
            {(r.advertencias || []).length > 0 && (
              <ul className="text-xs text-amber-300 list-disc pl-5" data-testid="cuadros-advertencias">
                {r.advertencias.map((a) => <li key={a}>{a}</li>)}
              </ul>
            )}
            {!final && <Diff diff={r.diff} sectores={sectores} />}
            {final?.escritas && (
              <p className="text-xs text-slate-400" data-testid="cuadros-escritas">
                Cuadro 1: {numeroAr(final.escritas.cuadro_1_insertadas)} insertadas · {numeroAr(final.escritas.cuadro_1_actualizadas)} actualizadas · {numeroAr(final.escritas.cuadro_1_borradas)} borradas.
                {' '}Cuadro 2: {numeroAr(final.escritas.cuadro_2_insertadas)} insertadas · {numeroAr(final.escritas.cuadro_2_actualizadas)} actualizadas · {numeroAr(final.escritas.cuadro_2_borradas)} borradas.
              </p>
            )}
          </div>
        )}

        {error && <p role="alert" className="text-sm text-red-300" data-testid="cuadros-error">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="px-3 py-2 rounded-lg bg-slate-700 text-sm">
            {final ? 'Cerrar' : 'Cancelar'}
          </button>
          {!final && (
            // Deshabilitado se ve GRIS y sin verde (mismo criterio que FE #88).
            <button
              type="button"
              onClick={confirmar}
              disabled={confirmarDeshabilitado}
              data-testid="cuadros-confirmar"
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                confirmarDeshabilitado
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              Confirmar carga
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ArtCuadrosSrtModal;
