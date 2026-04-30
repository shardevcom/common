// En @shardev/common, modifica la definición del Provider
// realTime.provider.tsx
import React from 'react';
import {RealtimeAdapter} from "../types";
import {RealtimeContext} from "../context";

interface DataProviderProps {
    adapter: RealtimeAdapter | null; // 👈 Permitir null
    children: React.ReactNode;
}

export const RealTimeProvider: React.FC<DataProviderProps> = ({ adapter, children }) => {
    // Proveer un adapter dummy si es null para evitar crashes
    const safeAdapter = adapter || {
        subscribe: async () => ({ unsubscribe: () => {} }),
        connect: () => {},
        disconnect: () => {},
        unsubscribe: () => {},
    };

    return (
        <RealtimeContext.Provider value={{ adapter: safeAdapter }}>
            {children}
        </RealtimeContext.Provider>
    );
};


