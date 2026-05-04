import {createContext} from "react";
import {AuthUser, PermissionAdapter} from "../types";

export const AuthContext = createContext<PermissionAdapter<AuthUser> | null>(null);
