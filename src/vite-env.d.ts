/// <reference types="vite/client" />

declare module 'react-gtm-module' {
    interface TagManagerArgs {
        gtmId: string;
        dataLayer?: Record<string, unknown>;
        dataLayerName?: string;
        auth?: string;
        preview?: string;
    }

    interface TagManager {
        initialize(args: TagManagerArgs): void;
        dataLayer(args: { dataLayer: Record<string, unknown> }): void;
    }

    const TagManager: TagManager;
    export default TagManager;
}