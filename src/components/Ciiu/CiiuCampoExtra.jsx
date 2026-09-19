import React, { useState } from 'react';
import CiiuBuscador from './CiiuBuscador';

// Buscador de catálogo colgado del campo `ciiu_codigo` del formulario de
// empresa (bloque D3). Acá SÍ escribe: `ciiu_codigo` es un campo editable de
// la empresa del CRM (EmpresaUpdate del backend), a diferencia de
// `empresas.ciiu` de la cartera ART, que lo cargan los backfills de padrón.
//
// Elegir una actividad completa los TRES campos de la sección en un solo
// cambio - código, descripción y sección salen de la misma fila del catálogo,
// y dejar la descripción vieja al lado de un código nuevo es peor que no
// tener descripción.
const CiiuCampoExtra = ({ token, valor, setValores }) => {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        className="text-blue-400 hover:text-blue-300 text-xs underline"
      >
        {abierto ? 'cerrar buscador' : 'cambiar'}
      </button>
      {abierto && (
        <div className="mt-2">
          <CiiuBuscador
            token={token}
            valorInicial={valor}
            onCerrar={() => setAbierto(false)}
            onElegir={(item) => {
              setValores({
                ciiu_codigo: item.codigo,
                ciiu_descripcion: item.descripcion,
                ciiu_seccion: item.seccion || '',
              });
              setAbierto(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CiiuCampoExtra;
