// Alta encadenada del CRM: crear la entidad relacionada desde el formulario de
// origen, sin cerrarlo, y volver con el enlace hecho.
//
// Este módulo es la parte pura (sin React): límites de la pila, normalización
// del payload y detección de duplicados contra GET /api/v1/crm/buscar. La pila
// en sí vive en AltaEncadenada.jsx.

// Oportunidad -> persona -> empresa. En el tercer nivel ya no se ofrece seguir
// anidando: `puedeAnidar(2)` es false.
export const PROFUNDIDAD_MAXIMA = 3;

export const puedeAnidar = (nivel) => nivel + 1 < PROFUNDIDAD_MAXIMA;

// '' -> null: el backend valida Optional[str], no cadenas vacías.
export const normalizarPayload = (form, transformar = {}) =>
  Object.fromEntries(
    Object.entries(form).map(([k, v]) => {
      if (transformar[k] && v) return [k, transformar[k](v)];
      return [k, v === '' ? null : v];
    })
  );

const soloDigitos = (v) => String(v || '').replace(/\D/g, '');
const minus = (v) => String(v || '').trim().toLowerCase();

// Claves por las que una persona se considera la misma persona.
const CLAVES_PERSONA = [
  {
    campo: 'numero_documento',
    etiqueta: 'documento',
    normalizar: soloDigitos,
    coincide: (cand, valor) => soloDigitos(cand.numero_documento) === valor,
  },
  {
    campo: 'email',
    etiqueta: 'email',
    normalizar: minus,
    coincide: (cand, valor) => minus(cand.email) === valor,
  },
  {
    campo: 'celular',
    etiqueta: 'celular',
    normalizar: soloDigitos,
    // El backend guarda el número en `telefono` o en `celular` según de dónde
    // vino el dato, así que un celular repetido puede aparecer en cualquiera.
    coincide: (cand, valor) =>
      soloDigitos(cand.celular) === valor || soloDigitos(cand.telefono) === valor,
  },
  {
    campo: 'telefono',
    etiqueta: 'teléfono',
    normalizar: soloDigitos,
    coincide: (cand, valor) =>
      soloDigitos(cand.telefono) === valor || soloDigitos(cand.celular) === valor,
  },
];

const CLAVES_EMPRESA = [
  {
    campo: 'cuit',
    etiqueta: 'CUIT',
    normalizar: soloDigitos,
    coincide: (cand, valor) => soloDigitos(cand.cuit) === valor,
  },
];

export const CLAVES_DUPLICADO = { persona: CLAVES_PERSONA, empresa: CLAVES_EMPRESA };

export const etiquetaPersona = (p) =>
  `${p?.nombre || ''} ${p?.apellido || ''}`.trim() || '(sin nombre)';

export const etiquetaEmpresa = (e) => e?.razon_social || '(sin razón social)';

export const etiquetaEntidad = (tipo, entidad) =>
  tipo === 'empresa' ? etiquetaEmpresa(entidad) : etiquetaPersona(entidad);

// Busca, por cada clave con valor, si ya existe la entidad. `buscar(q)` recibe
// el término y devuelve { personas: [], empresas: [] } (el shape de
// GET /api/v1/crm/buscar). Devuelve una lista deduplicada por id:
// [{ entidad, motivo }]. Un error de red no bloquea el alta: se devuelve [].
export const buscarDuplicados = async ({ tipo, form, buscar }) => {
  const claves = CLAVES_DUPLICADO[tipo] || [];
  const porId = new Map();

  for (const clave of claves) {
    const valor = clave.normalizar(form[clave.campo]);
    if (!valor) continue;
    let data;
    try {
      data = await buscar(valor);
    } catch {
      continue;
    }
    const candidatos = (tipo === 'empresa' ? data?.empresas : data?.personas) || [];
    for (const cand of candidatos) {
      if (!clave.coincide(cand, valor)) continue;
      if (porId.has(cand.id)) continue;
      porId.set(cand.id, { entidad: cand, motivo: clave.etiqueta });
    }
  }

  return [...porId.values()];
};

// Roles posibles de un vínculo persona-empresa (los mismos que ofrece la ficha
// de empresa en "Vincular persona"). Sin default: el rol es obligatorio y lo
// elige quien vincula.
export const ROLES_VINCULO = ['TITULAR', 'GERENTE', 'RRHH', 'CONTADOR', 'COMPRAS', 'OTRO'];

export const VINCULO_INICIAL = { rol: '', es_decisor: false, es_contacto_principal: false };
