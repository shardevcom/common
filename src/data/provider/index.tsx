import React from 'react';
import {DataAdapter} from "../types";
import {DataContext} from "../context";

interface DataProviderProps {
    adapter: DataAdapter;
    children: React.ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ adapter, children }) => {
    return (
        <DataContext.Provider value={{ adapter }}>
            {children}
        </DataContext.Provider>
    );
};

DataProvider.displayName = "DataProvider";


