import {useContext} from "react";
import {RealtimeContext} from "../context";

export const useRealTime = () => {
    const context = useContext(RealtimeContext);
    if (!context) {
        throw new Error('useData must be used within a RealTimeProvider');
    }
    return context.adapter;
};
