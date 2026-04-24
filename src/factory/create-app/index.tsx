import React, { ComponentType, ReactNode } from 'react';
import { Middleware, ReducersMapObject } from '@reduxjs/toolkit';
import { useSafeContext } from "@/utils";
import {
    StateFromReducersMapObject,
    StoreConfig,
    StoreContext,
    StoreProvider
} from "@/store";

export type AppOption =
    | ComponentType<any>
    | (() => ReactNode)
    | ((params: { props?: Record<string, any> }) => ReactNode);

export interface SetupOptions<TSlices> {
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
                                   }: SetupOptions<TSlices>): React.FC<any> {

    const Component = app as ComponentType<any>;

    return (incomingProps: any) => {
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

        const mergedProps = { ...props, ...incomingProps };

        if (existing && slices) {
            existing.addReducers(slices as ReducersMapObject);
            return <Component {...mergedProps} />;
        }

        if (storeConfig) {
            return (
                <StoreProvider config={storeConfig}>
                    <Component {...mergedProps} />
                </StoreProvider>
            );
        }

        return <Component {...mergedProps} />;
    };
}