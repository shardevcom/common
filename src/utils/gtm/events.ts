import TagManager from "react-gtm-module";

interface GTMEventProps {
    event: string;
    category: string;
    action: string;
    label: string;
    value?: number | string;
}

export const gtmEvent = ({ event, category, action, label, value }: GTMEventProps): void => {
    const dataLayer: Record<string, any> = {
        event,
        category,
        action,
        label,
    };

    if (value !== undefined) {
        dataLayer.value = value;
    }

    TagManager.dataLayer({ dataLayer });
};
