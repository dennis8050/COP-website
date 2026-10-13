import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, register, verify, forgot, reset } from "../hooks/auth";
import { action } from "../components/UI";
import { useData } from "../hooks/data";
export default function Login() {
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const districts=useData("/public/districts");
  const navigate = useNavigate();
  return (
    <div className="auth-wrap">
      <form
        className="card auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
            string,
            string
          >;
          const ok = await action(
            async () => {
              if (mode === "login") {
                if (!d.district_id) throw new Error("Please select your district");
                await login(d.email, d.password,d.district_id);
                navigate("/dashboard");
              }
              if (mode === "register") {
                await register(d.email, d.password, d.name);
                setMode("verify");
              }
              if (mode === "verify") {
                await verify(d.email, d.code);
                setMode("login");
              }
              if (mode === "forgot") {
                await forgot(d.email);
                setMode("reset");
              }
              if (mode === "reset") {
                await reset(d.email, d.code, d.password);
                setMode("login");
              }
            },
            mode === "login" ? "Welcome back" : "Request completed",
          );
          setBusy(false);
        }}
      >
        <p className="eyebrow">THE CHURCH OF PENTECOST CANADA · PEEL HALTON AREA</p>
        <h1>
          {
            (
              {
                login: "Welcome back",
                register: "Join our community",
                verify: "Verify your email",
                forgot: "Reset your password",
                reset: "Choose a password",
              } as any
            )[mode]
          }
        </h1>
        <p className="muted">Sign in to connect with your church community.</p>
        {mode === "login" && <label>
          Select Your District
          <select name="district_id" required defaultValue="">
            <option value="">Choose your district</option>
            {districts.data?.map((d:{id:string;name:string})=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>}
        {mode === "register" && (
          <label>
            Full name
            <input name="name" required />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        {["login", "register", "reset"].includes(mode) && (
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "login" ? 1 : 12}
              required
            />
          </label>
        )}
        {["verify", "reset"].includes(mode) && (
          <label>
            Verification code
            <input name="code" required inputMode="numeric" />
          </label>
        )}
        <button disabled={busy}>{busy ? "Please wait…" : "Continue"}</button>
        <div className="buttons">
          {["login", "register", "forgot"]
            .filter((x) => x !== mode)
            .map((x) => (
              <button
                type="button"
                className="link-button"
                onClick={() => setMode(x)}
                key={x}
              >
                {x === "login"
                  ? "Sign in"
                  : x === "register"
                    ? "Create account"
                    : "Forgot password?"}
              </button>
            ))}
        </div>
        {import.meta.env.VITE_AUTH_MODE === "local" && (
          <p className="notice">
            Local development mode. Use a seeded example.test account and your
            DEMO_PASSWORD.
          </p>
        )}
      </form>
    </div>
  );
}
