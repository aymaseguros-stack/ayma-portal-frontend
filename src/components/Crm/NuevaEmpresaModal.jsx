import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../Modal';
import FieldForm from '../FieldForm';
import CiiuCampoExtra from '../Ciiu/CiiuCampoExtra';
import { EMPRESA_FIELD_SECTIONS, EMPRESA_INITIAL_FORM } from './empresaFields';
import { esCuitValido, formatearCuit } from '../../utils/cuit';
import { authHeader } from '../../utils/api';
import { buscarDuplicados, normalizarPayload, etiquetaPersona } from './altaEncadenada';
import { AvisoDuplicados, BotonAnidar, ChipsVinculos } from './altaEncadenadaUI';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

// Alta de empresa, usable sola (tab Empresas) o como nivel de la pila de alta
// encadenada. Las personas de `precarga` / `inyeccion` quedan enlazadas como
// contacto con un POST /crm/vinculos apenas la empresa existe.
const NuevaEmpresaModal = ({
  token,
  precarga = null,
  puedeAnidar = false,
  onAnidar,
  inyeccion = null,
  onResuelto,
  onCancelar,
  zClass = 'z-50',
}) => {
  const [form, setForm] = useState(EMPRESA_INITIAL_FORM);
  const [personas, setPersonas] = useState(precarga?.personas || []);
  const [cuitInvalido, setCuitInvalido] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [duplicados, setDuplicados] = useState(null);
  const inyeccionAplicada = useRef(null);

  const headers = { ...authHeader(token), 'Content-Type': 'application/json' };

  const extrasCiiu = useMemo(() => ({
    ciiu_codigo: (props) => <CiiuCampoExtra token={token} {...props} />,
  }), [token]);

  useEffect(() => {
    if (!inyeccion || inyeccion.tipo !== 'persona') return;
    if (inyeccionAplicada.current === inyeccion.seq) return;
    inyeccionAplicada.current = inyeccion.seq;
    setPersonas((prev) => (prev.some(p => p.id === inyeccion.entidad.id) ? prev : [...prev, inyeccion.entidad]));
  }, [inyeccion]);

  const cambiarForm = (values) => {
    setForm(values);
    setCuitInvalido(Boolean(values.cuit?.trim()) && !esCuitValido(values.cuit));
  };

  const buscar = async (q) => {
    const res = await fetch(`${API_URL}/api/v1/crm/buscar?q=${encodeURIComponent(q)}`, { headers: authHeader(token) });
    if (!res.ok) throw new Error('Error ' + res.status);
    return res.json();
  };

  const vincularPersonas = async (empresaId) => {
    for (const persona of personas) {
      try {
        await fetch(`${API_URL}/api/v1/crm/vinculos`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            persona_id: persona.id,
            empresa_id: empresaId,
            rol: 'TITULAR',
            es_contacto_principal: true,
          }),
        });
      } catch (err) {
        console.error('Error vinculando empresa con persona:', err);
      }
    }
  };

  const crear = async () => {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/empresas`, {
        method: 'POST',
        headers,
        body: JSON.stringify(normalizarPayload(form, { cuit: formatearCuit })),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo crear la empresa');
      }
      const creada = await res.json();
      await vincularPersonas(creada.id);
      onResuelto?.(creada);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const usarExistente = async (empresa) => {
    setGuardando(true);
    try {
      await vincularPersonas(empresa.id);
      onResuelto?.(empresa, { existente: true });
    } finally {
      setGuardando(false);
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!form.razon_social?.trim()) {
      setError('La razón social es obligatoria');
      return;
    }
    if (form.cuit && !esCuitValido(form.cuit)) {
      setError('El CUIT ingresado no es válido (dígito verificador incorrecto)');
      return;
    }
    setError(null);
    setGuardando(true);
    const coincidencias = await buscarDuplicados({ tipo: 'empresa', form, buscar });
    setGuardando(false);
    if (coincidencias.length > 0) {
      setDuplicados(coincidencias);
      return;
    }
    await crear();
  };

  return (
    <Modal title="Nueva empresa" onClose={onCancelar} maxWidth="max-w-3xl" zClass={zClass}>
      <form onSubmit={enviar} className="space-y-6">
        {(personas.length > 0 || puedeAnidar) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="text-slate-400 text-sm">Contacto vinculado</label>
              {puedeAnidar && (
                <BotonAnidar
                  tipo="persona"
                  disabled={guardando}
                  onClick={() => onAnidar?.('persona', { empresa: null })}
                />
              )}
            </div>
            <ChipsVinculos
              tipo="persona"
              items={personas}
              onQuitar={(id) => setPersonas(prev => prev.filter(p => p.id !== id))}
              vacio="Sin contacto vinculado"
            />
            {personas.length > 0 && (
              <p className="text-slate-500 text-xs">
                Al guardar se enlaza como contacto principal a {personas.map(etiquetaPersona).join(', ')}.
              </p>
            )}
          </div>
        )}

        <FieldForm
          sections={EMPRESA_FIELD_SECTIONS}
          values={form}
          onChange={cambiarForm}
          errors={cuitInvalido ? { cuit: 'CUIT inválido (dígito verificador incorrecto)' } : {}}
          extras={extrasCiiu}
        />

        {duplicados && (
          <AvisoDuplicados
            tipo="empresa"
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
            disabled={guardando || cuitInvalido}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold transition"
          >
            {guardando ? 'Guardando...' : 'Crear empresa'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default NuevaEmpresaModal;
