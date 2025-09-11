import React from 'react';
import {DataAdapter} from "@/data";
import {DataContext} from "@/data";

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


