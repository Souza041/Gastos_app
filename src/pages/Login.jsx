import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

export default function Login() {
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [msg, setMsg] = useState("");

  // ✅ Se já estiver logado, sai do /login
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    const fn = mode === "signin" ? signIn : signUp;
    const { error } = await fn(email, password);

    if (error) {
      setMsg(error.message);
      return;
    }

    // ✅ No signIn, já manda direto (signUp pode depender de confirmação de email)
    if (mode === "signin") {
      navigate("/dashboard", { replace: true });
    } else {
      setMsg("Conta criada! Se pedir confirmação, verifique seu e-mail.");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: 24 }}>
      <h1>Gastos</h1>
      <p>Entre para usar seu controle financeiro.</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input className="app-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <input className="app-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="senha" type="password" />

        <button className="app-btn" type="submit">{mode === "signin" ? "Entrar" : "Criar conta"}</button>

        <button className="app-btn" type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Quero me cadastrar" : "Já tenho conta"}
        </button>

        {msg && <div>{msg}</div>}
      </form>
      <div style={{ marginTop: 16 }}>
        <Link to="/privacy" className="app-muted">
          Política de Privacidade
        </Link>
      </div>
    </div>
  );
}
