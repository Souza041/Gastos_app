import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

export default function Categories() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("tag");
  const [color, setColor] = useState("#6b7280"); // cinza

  async function load() {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("categories")
      .select("id,name,icon,color,created_at")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      alert(error.message);
      setLoading(false);
      return;
    }

    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function add(e) {
    e.preventDefault();
    if (!user) return;

    const clean = name.trim();
    if (!clean) return alert("Nome obrigatório");

    const { error } = await supabase.from("categories").insert({
      user_id: user.id,
      name: clean,
      icon,
      color,
    });

    if (error) {
      console.error(error);
      return alert(error.message);
    }

    setName("");
    await load();
  }

  async function remove(id) {
    const ok = confirm("Excluir esta categoria?");
    if (!ok) return;

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      console.error(error);
      return alert(error.message);
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1>Categorias</h1>

      <form onSubmit={add} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="app-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex: Alimentação)" />
        <input className="app-input" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Ícone (texto)" />
        <div style={{ display: "flex", alignItems: "center", gap: 10}}>
          <div className="color-picker-wrap" title="Selecionar cor">
            <input
              type="color" 
              className="color-picker-native" 
              value={color} 
              onChange={(e) => setColor(e.target.value)} 
            />
            <div className="color-picker-preview" style={{background: color}} />
          </div>

          <code className="app-muted" style={{ fontSize: 12 }}>
            {(color || "").toUpperCase()}
          </code>
        </div>
        <button className="app-btn" type="submit">Adicionar</button>
      </form>

      {loading ? (
        <div>Carregando…</div>
      ) : items.length === 0 ? (
        <div>Nenhuma categoria ainda.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: 999, background: c.color || "#6b7280" }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>icon: {c.icon || "-"}</div>
                </div>
              </div>

              <button className="app-btn" onClick={() => remove(c.id)}>Excluir</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}