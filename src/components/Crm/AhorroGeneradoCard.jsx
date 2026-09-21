import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { ahorroGenerado } from './oportunidadCatalogos';
import { formatMoneda } from './oportunidadConstants';

// D-B8 - "Ahorro generado al mercado", en el Dashboard.
//
// ES LA LECTURA DEL PAQUETE. Cuando AYMA cotiza y el cliente le lleva el
// número a su compañía actual, ésta le baja la tarifa para defender la cuenta:
// no hay venta, pero el cliente paga menos por nuestra intervención. Eso caía
// en LOOP y contaba CERO, igual que un "no me interesa". Esta tarjeta es donde
// ese trabajo aparece.
//
// LOS TRES NÚMEROS VAN JUNTOS Y NO SÓLO EL TOTAL:
//
//   - el total en pesos,
//   - cuántos NO dejaron efecto y cuántos no (3 de 40 y 3 de 4 son dos
//     negocios distintos: sin el denominador el porcentaje lo inventa quien
//     mira), y
//   - cuántos CON_EFECTO todavía no tienen número, porque un total que no
//     declara lo que no pudo contar se lee como si lo hubiera contado.

const AhorroGeneradoCard = ({ token }) => {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let vigente = true;
    ahorroGenerado(token)
      .then((d) => { if (vigente) { setDatos(d); setError(null); } })
      .catch((err) => { if (vigente) { setDatos(null); setError(err.message); } });
    return () => { vigente = false; };
  }, [token]);

  const total = datos ? datos.cantidad_con_efecto + datos.cantidad_sin_efecto : 0;

  return (
    <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 shadow-xl">
      <div className="flex justify-between items-start">
        <div className="min-w-0">
          <p className="text-emerald-200 text-sm">Ahorro generado al mercado</p>
          {/* NUNCA un 0 cuando la consulta falló: un 0 acá se lee como "no
              generamos valor este período", que es lo contrario de "no se
              pudo medir". Mismo criterio que la métrica de hallazgos
              críticos de Dirección → Seguridad. */}
          <p className="text-3xl font-bold mt-2 break-words">
            {error ? 'Sin medir' : datos ? formatMoneda(datos.total_ahorro) : '—'}
          </p>
        </div>
        <Icon name="currency-dollar" size={36} className="text-emerald-200 shrink-0" />
      </div>

      {error ? (
        <p className="text-emerald-200/80 text-xs mt-4">No se pudo leer la métrica: {error}</p>
      ) : (
        <>
          <p className="text-emerald-200 text-sm mt-4">
            {datos
              ? `${datos.cantidad_con_efecto} con efecto de ${total} NO declarados`
              : 'Cargando...'}
          </p>
          {datos?.con_efecto_sin_ahorro > 0 && (
            <p className="text-emerald-100/80 text-xs mt-1">
              {datos.con_efecto_sin_ahorro} con efecto sin importe cargado: no están sumados en el total.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default AhorroGeneradoCard;
