import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    
    if (!token || userRole !== 'admin') {
      navigate('/login');
    }
    
    // Datos hardcodeados por ahora
    setUserData({
      email: 'aymaseguros@hotmail.com',
      role: 'admin'
    });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-600 text-white p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">AYMA Advisors - Admin</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 rounded hover:bg-red-700"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold">Clientes</h2>
            <p className="text-3xl font-bold text-blue-600 mt-2">3</p>
            <p className="text-sm text-gray-500">Grupo Batista</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold">Pólizas</h2>
            <p className="text-3xl font-bold text-green-600 mt-2">7</p>
            <p className="text-sm text-gray-500">Vigentes</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold">Vehículos</h2>
            <p className="text-3xl font-bold text-purple-600 mt-2">7</p>
            <p className="text-sm text-gray-500">Asegurados</p>
          </div>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Panel de Administración</h2>
          <p>Bienvenido, {userData?.email}</p>
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              El módulo completo de gestión de clientes se activará cuando el backend complete la actualización.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
