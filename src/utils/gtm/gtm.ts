import {useEffect} from "react";
import TagManager from 'react-gtm-module';

declare global {
    interface Window {
        dataLayer: any;
    }
}

const getCSPNonce = () => {
    const meta = document.querySelector('meta[name="csp-nonce"]');
    return meta ? meta.getAttribute('content') : undefined;
};

export const initGTM = (gtmId: string) => {
    if (!gtmId) return;

    TagManager.initialize({
        gtmId,
        // @ts-expect-error: scriptProps no está tipado oficialmente
        scriptProps: {
            nonce: getCSPNonce(),
        },
    });
};

export const useGTM = (gtmId: string) => {
    useEffect(() => {
        if (gtmId) {
            initGTM(gtmId);
        }
    }, [gtmId]);
};