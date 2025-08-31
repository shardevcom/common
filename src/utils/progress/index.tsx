import NProgress from "nprogress";
import {useEffect} from "react";
import "nprogress/nprogress.css";

export const Progress: React.FC = () => {
    useEffect(() => {
        NProgress.start();
        return () => {
            NProgress.done();
        };
    }, []);

    return null; // No renderiza nada, solo controla la barra
};