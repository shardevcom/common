import {createContext} from "react";
import {DataAdapter} from "@/data";

interface DataContextProps {
    adapter: DataAdapter;
}

export const DataContext = createContext<DataContextProps | undefined>(undefined);
