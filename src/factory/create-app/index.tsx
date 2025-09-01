// createApp.tsx
import React, { ReactNode, ComponentType } from 'react';
import { ReducersMapObject } from '@reduxjs/toolkit';
import {getEnv, useSafeContext} from "../../utils";
import {StateFromReducersMapObject, StoreConfig, StoreContext, StoreProvider} from "../../store";


const appKey: string = getEnv('VITE_APP_KEY', 'my-secret-key');

type AppOption =
    | ComponentType<any>
    | (() => ReactNode)
    | ((params: { props?: Record<string, any> }) => ReactNode);

interface SetupOptions<TSlices> {
    name: string;
    app: AppOption;
    slices?: ReducersMapObject<TSlices>;
    initialState?: Partial<StateFromReducersMapObject<ReducersMapObject<TSlices>>>;
    props?: Record<string, any>;
}

export function createApp<TSlices>({
                                       name,
                                       app,
                                       slices,
                                       initialState = {},
                                       props = {}
                                   }: SetupOptions<TSlices>) {

    const Component = app as ComponentType<any>;

    const Wrapper: React.FC = () => {
        // 1️⃣ Hook siempre se llama
        const existing = useSafeContext(StoreContext);

        // 2️⃣ Configuración del store
        const storeConfig: StoreConfig<TSlices> | undefined = slices
            ? {
                keyName: name,
                secretKey: appKey,
                slices,
                initialState
            }
            : undefined;

        // 3️⃣ Lógica condicional segura
        if (existing && slices) {
            // estamos en store global → inyectar reducers
            if (storeConfig?.slices) {
                existing.addReducers(storeConfig.slices as ReducersMapObject);
            }
            return <Component {...props} />;
        }

        if (storeConfig) {
            // no hay store global → envolver en provider
            return (
                <StoreProvider config={storeConfig}>
                    <Component {...props} />
                </StoreProvider>
            );
        }

        return <Component {...props} />;
    };

    return <Wrapper />;
}
