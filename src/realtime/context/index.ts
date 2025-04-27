import {createContext} from "react";
import {RealtimeAdapter} from "../types";

interface RealtimeContextProps {
    adapter: RealtimeAdapter
}

export const RealtimeContext = createContext<RealtimeContextProps | undefined>(undefined);
