import { useState, useEffect } from "react";

export interface Geolocation {
    latitude: string;
    longitude: string;
}

export const useGeolocation = () => {
    const [location, setLocation] = useState<Geolocation | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setError("Geolocalización no soportada por tu navegador");
            return;
        }

        const success = (position: GeolocationPosition) => {
            const { latitude, longitude } = position.coords;
            setLocation({ latitude: latitude.toString(), longitude: longitude.toString() });
        };

        const errorHandler = (err: GeolocationPositionError) => {
            setError(err.message);
        };

        navigator.geolocation.getCurrentPosition(success, errorHandler);

    }, []);

    return { location, error };
};

