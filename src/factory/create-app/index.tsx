import React, {ComponentType, ReactNode} from 'react';
import {ReducersMapObject} from '@reduxjs/toolkit';
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
                                   }: SetupOptions<TSlices>): React.FC {
    const Component = app as ComponentType<any>;

    return () => { // ← Devuelve directamente la función componente
        const existing = useSafeContext(StoreContext);
        const storeConfig: StoreConfig<TSlices> | undefined = slices
            ? {
                keyName: name,
                secretKey: appKey,
                slices,
                initialState
            }
            : undefined;

        if (existing && slices) {
            if (storeConfig?.slices) {
                existing.addReducers(storeConfig.slices as ReducersMapObject);
            }
            return <Component {...props} />;
        }

        if (storeConfig) {
            return (
                <StoreProvider config={storeConfig}>
                    <Component {...props} />
                </StoreProvider>
            );
        }

        return <Component {...props} />;
    };
}