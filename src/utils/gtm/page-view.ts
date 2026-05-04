import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import TagManager from "react-gtm-module";

const useGTMPageView = (pageTitle = 'Página sin título') => {
    const location = useLocation();

    useEffect(() => {
        const path = location.pathname;

        TagManager.dataLayer({
            dataLayer: {
                event: 'pageview',
                page: {
                    url: path,
                    title: pageTitle,
                },
            },
        });

    }, [location.pathname, pageTitle]);
};

export default useGTMPageView;
