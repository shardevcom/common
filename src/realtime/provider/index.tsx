import React from 'react';
import {RealtimeAdapter} from "../types";
import {RealtimeContext} from "../context";

interface DataProviderProps {
    adapter: RealtimeAdapter;
    children: React.ReactNode;
}

export const RealTimeContextProvider: React.FC<DataProviderProps> = ({ adapter, children }) => {
    return (
        <RealtimeContext.Provider value={{ adapter }}>
            {children}
        </RealtimeContext.Provider>
    );
};

RealTimeContextProvider.displayName = "RealTimeProvider";


