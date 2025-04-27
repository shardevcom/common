import {createContext} from "react";
import {PermissionAdapter} from "../types";

export const AuthContext = createContext<PermissionAdapter | null>(null);
