import {useContext} from "react";
import {TypedUseSelectorHook, useDispatch, useSelector} from "react-redux";
import {createStoreFactory} from "../factory";
import {StoreContext} from "../context";
import {StoreContextType} from "../types";


export const useAppDispatch = () => {
    const store = useContext(StoreContext);
    if (!store) {
        throw new Error("useAppDispatch debe ser usado dentro de un <StoreProvider>");
    }
    return useDispatch<typeof store.store.dispatch>();
};

export const useStoreContext = (): StoreContextType => {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error("useStoreContext debe ser usado dentro de un StoreProvider");
    }
    return context;
};


export const useAppSelector: TypedUseSelectorHook<
    ReturnType<ReturnType<typeof createStoreFactory>["store"]["getState"]>
> = (selector, equalityFn) => {
    const store = useContext(StoreContext);
    if (!store) {
        throw new Error("useAppSelector debe ser usado dentro de un <StoreProvider>");
    }
    return useSelector(selector, equalityFn);
};
