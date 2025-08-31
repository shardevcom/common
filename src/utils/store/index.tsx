import {ReducersMapObject} from "@reduxjs/toolkit";
import {StoreConfig, StoreContext, StoreProvider} from "../../store";
import {useContext} from "react";


export function withStore<C,Slices extends ReducersMapObject>(
    Component: React.ComponentType<C>,
    config: StoreConfig<Slices>
) {
    return function Wrapper(props: any) {
        const existing = useContext(StoreContext);
        if (existing) {
            // estamos en store global → inyectar reducers
            if(config.slices) {
                existing.addReducers(config.slices);
            }
            return <Component {...props} />;
        }

        // standalone → crear un store solo para este módulo
        return (
            <StoreProvider config={config}>
                <Component {...props} />
            </StoreProvider>
        );
    }
}