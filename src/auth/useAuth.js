import { useContext } from "react";
import { AuthCtx } from "./AuthProvider";

export const useAuth = () => useContext(AuthCtx);