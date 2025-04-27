import {createTransform} from 'redux-persist';
import CryptoJS from 'crypto-js';

export function createEncryptor(secretKey: string) {
    return createTransform(
        // Transform state on its way to being serialized and persisted.
        (inboundState: any) => {
            if (!inboundState) return inboundState;
            return CryptoJS.AES.encrypt(
                JSON.stringify(inboundState),
                secretKey
            ).toString();
        },
        // Transform state being rehydrated
        (outboundState: any) => {
            if (!outboundState) return outboundState;
            const bytes = CryptoJS.AES.decrypt(outboundState, secretKey);
            const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
            return JSON.parse(decryptedData);
        }
    );
}
