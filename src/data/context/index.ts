import {createContext} from "react";
import {DataAdapter} from "../types";

interface DataContextProps {
    adapter: DataAdapter;
}

export const DataContext = createContext<DataContextProps | undefined>(undefined);
