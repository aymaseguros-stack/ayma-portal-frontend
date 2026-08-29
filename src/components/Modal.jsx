import React from 'react';
import { Icon } from './Icons';

const Modal = ({ title, onClose, children, maxWidth = 'max-w-lg' }) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className={`bg-slate-800 rounded-2xl ${maxWidth} w-full max-h-[90vh] overflow-y-auto border border-slate-700`}>
        <div className="p-6 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800">
          <h3 className="text-xl font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
            aria-label="Cerrar"
          >
            <Icon name="x-mark" size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
