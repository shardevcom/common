import {CustomFlowbiteTheme} from "flowbite-react";

export interface ThemeContextType {
    theme: CustomFlowbiteTheme;
    setTheme: (theme: CustomFlowbiteTheme) => void;
}
