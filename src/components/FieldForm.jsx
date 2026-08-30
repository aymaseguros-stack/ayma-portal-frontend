import React from 'react';

const baseInputClass = 'w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';

// Formulario genérico dirigido por config: [{ titulo, campos: [{name,label,type,required,placeholder}] }]
const FieldForm = ({ sections, values, onChange, errors = {} }) => {
  const handle = (name, value) => onChange({ ...values, [name]: value });

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.titulo}>
          <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
            {section.titulo}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.campos.map((campo) => (
              <div key={campo.name} className={campo.type === 'textarea' ? 'md:col-span-2' : ''}>
                <label className="block text-slate-400 text-sm mb-1.5">
                  {campo.label}{campo.required ? ' *' : ''}
                </label>
                {campo.type === 'textarea' ? (
                  <textarea
                    value={values[campo.name] ?? ''}
                    onChange={(e) => handle(campo.name, e.target.value)}
                    placeholder={campo.placeholder}
                    rows={3}
                    className={baseInputClass}
                  />
                ) : campo.type === 'select' ? (
                  <select
                    value={values[campo.name] ?? ''}
                    onChange={(e) => handle(campo.name, e.target.value)}
                    required={campo.required}
                    className={baseInputClass}
                  >
                    <option value="">Seleccionar...</option>
                    {campo.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={campo.type}
                    value={values[campo.name] ?? ''}
                    onChange={(e) => handle(campo.name, e.target.value)}
                    placeholder={campo.placeholder}
                    required={campo.required}
                    className={baseInputClass}
                  />
                )}
                {errors[campo.name] && (
                  <p className="text-red-400 text-xs mt-1">{errors[campo.name]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FieldForm;
