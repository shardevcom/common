import React, {ComponentType, ReactNode} from 'react';
import {Middleware, ReducersMapObject} from '@reduxjs/toolkit';
import {useSafeContext} from "@/utils";
import {StateFromReducersMapObject, StoreConfig, StoreContext, StoreProvider} from "@/store";


type AppOption =
    | ComponentType<any>
    | (() => ReactNode)
    | ((params: { props?: Record<string, any> }) => ReactNode);

interface SetupOptions<TSlices> {
    name: string;
    app: AppOption;
    appKey?: string;
    slices?: ReducersMapObject<TSlices>;
    middlewares?: Middleware[];
    initialState?: Partial<StateFromReducersMapObject<ReducersMapObject<TSlices>>>;
    props?: Record<string, any>;
}

export function createApp<TSlices>({
                                       name,
                                       app,
                                       appKey = 'my-key-app',
                                       slices,
                                       middlewares = [],
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
                initialState,
                middlewares
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