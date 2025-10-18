import {useContext, useMemo} from "react";
import {DataContext} from "@/data";

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context.adapter;
};