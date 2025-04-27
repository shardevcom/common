import { useState } from "react";
import {faInfo} from "@fortawesome/free-solid-svg-icons";
import {IconProp} from "@fortawesome/fontawesome-svg-core";


export type Variant = 'success' | 'danger' | 'warning' | 'info' ;

export interface ActionButton {
    link: string
    label: string
}

export interface Notify {
    visible: boolean;
    close: (show: boolean) => void
    message: string;
    variant?: Variant
    action?: ActionButton[]
    icon?: IconProp
    notify: (text: string, variant?: Variant, action?: ActionButton[], icon?: IconProp, ms?: number) => void;
}


export const useNotify = (): Notify => {
    const [visible, setVisible] = useState(false);
    const [action, setAction] = useState<ActionButton[]>();
    const [message, setMessage] = useState("");
    const [variant, setVariant] = useState<Variant>("success");
    const [icon, setIcon] = useState<IconProp>(faInfo);

    const notify = (text: string, variant: Variant = "success", action: ActionButton[] | undefined, icon: IconProp = faInfo,  ms = 20000 ): void => {
        setVisible(true);
        setMessage(text);
        setAction(action);
        setVariant(variant);
        setIcon(icon);
        setTimeout(() => {
            setVisible(false);
        }, ms);
    };

    const close = (show: boolean) => {
        setVisible(show)
    }

    return {
        visible,
        close,
        message,
        variant,
        icon,
        action,
        notify
    };
}
