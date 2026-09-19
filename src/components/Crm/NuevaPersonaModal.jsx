import React, { useEffect, useRef, useState } from 'react';
import Modal from '../Modal';
import FieldForm from '../FieldForm';
import { PERSONA_FIELD_SECTIONS, PERSONA_INITIAL_FORM } from './personaFields';
import { authHeader } from '../../utils/api';
import { buscarDuplicados, normalizarPayload, etiquetaEmpresa } from './altaEncadenada';
import { AvisoDuplicados, BotonAnidar, ChipsVinculos } from './altaEncadenadaUI';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

// Alta de persona, usable sola (tab Personas) o como nivel de la pila de alta
// encadenada. Las empresas que llegan por `precarga` o por `inyeccion` quedan
// enlazadas con un POST /crm/vinculos apenas la persona existe: el backend no
// acepta empresa_id en PersonaCreate, el vínculo es una llamada aparte.
const NuevaPersonaModal = ({
  token,
  precarga = null,
  puedeAnidar = false,
  onAnidar,
  inyeccion = null,
  onResuelto,
  onCancelar,
  zClass = 'z-50',
}) => {
  const [form, setForm] = useState(PERSONA_INITIAL_FORM);
  const [empresas, setEmpresas] = useState(precarga?.empresas || []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [duplicados, setDuplicados] = useState(null);
  const inyeccionAplicada = useRef(null);

  const headers = { ...authHeader(token), 'Content-Type': 'application/json' };

  // Una empresa creada en el nivel de arriba vuelve por acá.
  useEffect(() => {
    if (!inyeccion || inyeccion.tipo !== 'empresa') return;
    if (inyeccionAplicada.current === inyeccion.seq) return;
    inyeccionAplicada.current = inyeccion.seq;
    setEmpresas((prev) => (prev.some(e => e.id === inyeccion.entidad.id) ? prev : [...prev, inyeccion.entidad]));
  }, [inyeccion]);

  const buscar = async (q) => {
    const res = await fetch(`${API_URL}/api/v1/crm/buscar?q=${encodeURIComponent(q)}`, { headers: authHeader(token) });
    if (!res.ok) throw new Error('Error ' + res.status);
    return res.json();
  };

  // Vincula la persona (nueva o existente) con cada empresa de la pila. Un 409
  // "ya existe ese vínculo" no es un error para el usuario: el enlace está.
  const vincularEmpresas = async (personaId) => {
    for (const empresa of empresas) {
      try {
        await fetch(`${API_URL}/api/v1/crm/vinculos`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            persona_id: personaId,
            empresa_id: empresa.id,
            rol: 'TITULAR',
            es_contacto_principal: true,
          }),
        });
      } catch (err) {
        console.error('Error vinculando persona con empresa:', err);
      }
    }
  };

  const crear = async () => {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/personas`, {
        method: 'POST',
        headers,
        body: JSON.stringify(normalizarPayload(form)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo crear la persona');
      }
      const creada = await res.json();
      await vincularEmpresas(creada.id);
      onResuelto?.(creada);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const usarExistente = async (persona) => {
    setGuardando(true);
    try {
      await vincularEmpresas(persona.id);
      onResuelto?.(persona, { existente: true });
    } finally {
      setGuardando(false);
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!form.nombre?.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setError(null);
    setGuardando(true);
    const coincidencias = await buscarDuplicados({ tipo: 'persona', form, buscar });
    setGuardando(false);
    if (coincidencias.length > 0) {
      setDuplicados(coincidencias);
      return;
    }
    await crear();
  };

  return (
    <Modal title="Nueva persona" onClose={onCancelar} maxWidth="max-w-3xl" zClass={zClass}>
      <form onSubmit={enviar} className="space-y-6">
        {(empresas.length > 0 || puedeAnidar) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="text-slate-400 text-sm">Empresa vinculada</label>
              {puedeAnidar && (
                <BotonAnidar
                  tipo="empresa"
                  disabled={guardando}
                  onClick={() => onAnidar?.('empresa', { persona: null })}
                />
              )}
            </div>
            <ChipsVinculos
              tipo="empresa"
              items={empresas}
              onQuitar={(id) => setEmpresas(prev => prev.filter(e => e.id !== id))}
              vacio="Sin empresa vinculada"
            />
            {empresas.length > 0 && (
              <p className="text-slate-500 text-xs">
                Al guardar se enlaza como contacto principal de {empresas.map(etiquetaEmpresa).join(', ')}.
              </p>
            )}
          </div>
        )}

        <FieldForm sections={PERSONA_FIELD_SECTIONS} values={form} onChange={setForm} />

        {duplicados && (
          <AvisoDuplicados
            tipo="persona"
            duplicados={duplicados}
            trabajando={guardando}
            onUsarExistente={usarExistente}
            onCrearIgual={() => { setDuplicados(null); crear(); }}
          />
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-4 pt-2">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
          >
            {guardando ? 'Guardando...' : 'Crear persona'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default NuevaPersonaModal;
