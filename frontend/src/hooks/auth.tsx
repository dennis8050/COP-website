import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Amplify } from "aws-amplify";
import {
  signIn,
  signOut,
  signUp,
  confirmSignUp,
  resetPassword,
  confirmResetPassword,
  fetchAuthSession,
} from "aws-amplify/auth";
import { api, setToken } from "../services/api";
const local = import.meta.env.VITE_AUTH_MODE === "local";
if (!local)
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      },
    },
  });
type User = { id: string; name: string; email: string; role: string };
const C = createContext<{
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        if (!local && (await fetchAuthSession()).tokens)
          setUser(await api("/me"));
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  async function login(email: string, password: string) {
    if (local) {
      const x = await api("/auth/login", "POST", { email, password });
      setToken(x.token);
      setUser(x.user);
    } else {
      const result = await signIn({ username: email, password });
      if (!result.isSignedIn)
        throw new Error(
          "Complete account verification or MFA in your Cognito account before signing in.",
        );
      setUser(await api("/me"));
    }
  }
  async function logout() {
    if (!local) await signOut({ global: true });
    setToken("");
    setUser(null);
  }
  return (
    <C.Provider value={{ user, loading, login, logout }}>{children}</C.Provider>
  );
}
export const useAuth = () => useContext(C);
export async function register(email: string, password: string, name: string) {
  if (local)
    throw new Error(
      "Local accounts are created by the development seed. Registration is available with Cognito.",
    );
  return signUp({
    username: email,
    password,
    options: { userAttributes: { email, name } },
  });
}
export async function verify(email: string, code: string) {
  return confirmSignUp({ username: email, confirmationCode: code });
}
export async function forgot(email: string) {
  if (local)
    throw new Error(
      "For local development, change DEMO_PASSWORD and run the seed. Production resets use Cognito.",
    );
  return resetPassword({ username: email });
}
export async function reset(email: string, code: string, password: string) {
  return confirmResetPassword({
    username: email,
    confirmationCode: code,
    newPassword: password,
  });
}
