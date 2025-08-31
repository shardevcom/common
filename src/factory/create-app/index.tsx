// createApp.tsx
import React, {ReactNode, ComponentType, Suspense} from "react";
import {StateFromReducersMapObject, StoreConfig} from "../../store";
import {ReducersMapObject} from "@reduxjs/toolkit";
import {withStore} from "../../utils";
import {Progress} from "../../utils/progress";

const appKey: string = process.env.VITE_APP_KEY ?? "my-secret-key";

type AppOption =
    | ComponentType<any>
    | (() => ReactNode)
    | ((params: { props?: Record<string, any> }) => ReactNode);

interface SetupOptions<TSlices> {
    name: string;
    app: AppOption;
    slices?: ReducersMapObject<TSlices>;
    fallback?: ReactNode; // 👈 nuevo parámetro
    initialState?: Partial<StateFromReducersMapObject<ReducersMapObject<TSlices>>>;
    props?: Record<string, any>;
}

export function createApp<TSlices>({
                                                                name,
                                                                app,
                                                                slices,
                                                                fallback,
                                                                initialState = {},
                                                                props = {},
                                                            }: SetupOptions<TSlices>) {
    let element: ReactNode;

    if (slices) {
        const storeConfig: StoreConfig<ReducersMapObject<TSlices>> = {
            keyName: name,
            secretKey: appKey,
            slices,
            initialState,
        };

        const Component =
            typeof app === "function" && !(app as any).prototype?.isReactComponent
                ? (app as any)(props) // 👈 ya no pasamos el store aquí
                : (app as ComponentType<any>);

        // ✅ el store se inyecta con el provider de withStore
        element = withStore(Component, storeConfig)(props);
    } else {
        element = React.createElement(app as ComponentType<any>, props);
    }

    return(
        <React.StrictMode>
            <Suspense fallback={fallback ?? <Progress />}>
                {element}
            </Suspense>
        </React.StrictMode>
    );
}
