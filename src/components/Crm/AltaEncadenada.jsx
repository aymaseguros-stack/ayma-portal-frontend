import React, { useRef, useState } from 'react';
import NuevaOportunidadModal from './NuevaOportunidadModal';
import NuevaPersonaModal from './NuevaPersonaModal';
import NuevaEmpresaModal from './NuevaEmpresaModal';
import { puedeAnidar as puedeAnidarEn } from './altaEncadenada';

// Pila de altas encadenadas del CRM.
//
// Cada nivel es un modal completo. Los niveles de abajo NO se desmontan: se
// quedan montados debajo del que se abrió encima, así lo tipeado no se pierde
// al ir y volver (ni al cancelar el nivel de arriba). Al guardar, el nivel se
// desapila y la entidad creada baja al nivel anterior por `inyeccion`, que la
// deja seleccionada (oportunidad) o enlazada (persona/empresa).
//
// Profundidad máxima 3: en el tercer nivel no se ofrecen los botones de seguir
// anidando.

// Capas z crecientes: el nivel N tapa al N-1.
const CAPAS = ['z-50', 'z-[60]', 'z-[70]'];

const precargaDesde = (tipo, contexto) => {
  if (!contexto) return null;
  if (tipo === 'persona' && contexto.empresa) return { empresas: [contexto.empresa] };
  if (tipo === 'empresa' && contexto.persona) return { personas: [contexto.persona] };
  return null;
};

const AltaEncadenada = ({ token, raiz, onCerrar, onResuelto }) => {
  const [niveles, setNiveles] = useState([{
    clave: 'nivel-0',
    tipo: raiz.tipo,
    preset: raiz.preset || null,
    precarga: raiz.precarga || null,
  }]);
  // clave del nivel -> { seq, tipo, entidad } pendiente de aplicar ahí.
  const [inyecciones, setInyecciones] = useState({});
  const contador = useRef(0);
  const seq = useRef(0);

  const anidar = (indice) => (tipo, contexto) => {
    contador.current += 1;
    const nivel = {
      clave: `nivel-${indice + 1}-${contador.current}`,
      tipo,
      preset: null,
      precarga: precargaDesde(tipo, contexto),
    };
    setNiveles(prev => [...prev.slice(0, indice + 1), nivel]);
  };

  // Cancelar en un nivel vuelve al anterior sin crear nada; en el nivel raíz
  // cierra la pila entera.
  const cancelar = (indice) => () => {
    if (indice === 0) { onCerrar?.(); return; }
    setNiveles(prev => prev.slice(0, indice));
  };

  const resolver = (indice) => (entidad) => {
    if (indice === 0) { onResuelto?.(entidad, niveles[0].tipo); return; }
    const padre = niveles[indice - 1];
    seq.current += 1;
    const inyeccion = { seq: seq.current, tipo: niveles[indice].tipo, entidad };
    setInyecciones(prev => ({ ...prev, [padre.clave]: inyeccion }));
    setNiveles(prev => prev.slice(0, indice));
  };

  return (
    <>
      {niveles.map((nivel, indice) => {
        const comun = {
          token,
          zClass: CAPAS[indice] || CAPAS[CAPAS.length - 1],
          puedeAnidar: puedeAnidarEn(indice),
          onAnidar: anidar(indice),
          inyeccion: inyecciones[nivel.clave] || null,
        };

        if (nivel.tipo === 'oportunidad') {
          return (
            <NuevaOportunidadModal
              key={nivel.clave}
              {...comun}
              preset={nivel.preset}
              onClose={cancelar(indice)}
              onCreated={resolver(indice)}
            />
          );
        }

        const Formulario = nivel.tipo === 'empresa' ? NuevaEmpresaModal : NuevaPersonaModal;
        return (
          <Formulario
            key={nivel.clave}
            {...comun}
            precarga={nivel.precarga}
            onCancelar={cancelar(indice)}
            onResuelto={resolver(indice)}
          />
        );
      })}
    </>
  );
};

export default AltaEncadenada;
