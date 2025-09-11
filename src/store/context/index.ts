import {createContext} from "react";
import {StoreContextType} from "@/store";

export const StoreContext = createContext<StoreContextType | null>(null);
