import {createContext} from "react";
import {AuthUser, PermissionAdapter} from "@/auth";

export const AuthContext = createContext<PermissionAdapter<AuthUser> | null>(null);
