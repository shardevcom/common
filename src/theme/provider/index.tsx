import React, {ReactNode, useState} from "react";
import {CustomFlowbiteTheme, Flowbite} from "flowbite-react";
import {ThemeContext} from "../context";


interface ThemeProviderProps {
    children: ReactNode;
    initialTheme?: CustomFlowbiteTheme;
}

export const ThemeProvider = ({ children, initialTheme }: ThemeProviderProps) => {
    const [theme, setTheme] = useState<CustomFlowbiteTheme>(initialTheme || {});

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            <Flowbite theme={{ theme }}>
                {children}
            </Flowbite>
        </ThemeContext.Provider>
    );
};
