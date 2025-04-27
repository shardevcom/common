import React from "react";
import { useNavigate } from "react-router-dom";

const Unauthorized: React.FC = () => {
   // const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
            <div className="bg-white shadow-lg rounded-lg p-8 text-center">
                <h1 className="text-4xl font-bold text-red-600">Acceso Denegado</h1>
                <p className="text-gray-700 mt-4">
                    No tienes los permisos necesarios para acceder a esta página.
                </p>

                <div className="mt-6 flex space-x-4">
                    <button
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Unauthorized;
