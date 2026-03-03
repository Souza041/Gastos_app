import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const linkStyle = ({ isActive }) => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 14,
  textDecoration: "none",
  color: "inherit",
  border: "1px solid rgba(255,255,255,.10)",
  background: isActive ? "rgba(56,189,248,.14)" : "rgba(255,255,255,.04)",
});

export default function AppShell() {
  const { user, signOut } = useAuth();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" }}>
      <aside className="app-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 12 }}>Gastos</div>
        <div className="app-muted" style={{ fontSize: 12, marginBottom: 16 }}>Controle financeiro</div>

        <nav style={{ display: "grid", gap: 8 }}>
          <NavLink to="/dashboard" style={linkStyle}>Dashboard</NavLink>
          <NavLink to="/transactions" style={linkStyle}>Lançamentos</NavLink>
          <NavLink to="/categories" style={linkStyle}>Categorias</NavLink>
          <NavLink to="/budgets" style={linkStyle}>Orçamentos</NavLink>
          <NavLink to="/recurring" style={linkStyle}>Recorrências</NavLink>
        </nav>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.10)" }}>
          <div className="app-muted" style={{ fontSize: 12, marginBottom: 6 }}>Logado como</div>
          <div style={{ fontSize: 14, marginBottom: 10 }}>{user?.email}</div>
          <button className="app-btn" onClick={signOut}>Sair</button>
        </div>
      </aside>

      <main style={{ padding: 4 }}>
        <Outlet />
      </main>
    </div>
  );
}