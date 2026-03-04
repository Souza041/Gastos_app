import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function parseAmountBR(value) {
  const s = String(value).trim();
  if (s.includes(".") && !s.includes(",")) {
    const v2 = Number(s);
    return Number.isFinite(v2) ? v2 : NaN;
  }
  const v = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
}

export default function Recurring() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);

  // form
  const [active, setActive] = useState(true);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState(5);
  const [categoryId, setCategoryId] = useState("");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");

  const catById = useMemo(() => {
    const m = new Map();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  async function load() {
    if (!user) return;
    setLoading(true);

    const [cRes, rRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id,name,color")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),
      supabase
        .from("recurring_rules")
        .select("id,active,type,amount,description,day_of_month,category_id,method,notes,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (cRes.error) return alert(cRes.error.message);
    if (rRes.error) return alert(rRes.error.message);

    setCategories(cRes.data ?? []);
    setRules(rRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function add(e) {
    e.preventDefault();
    if (!user) return;

    const v = parseAmountBR(amount);
    if (!description.trim()) return alert("Descrição obrigatória");
    if (!Number.isFinite(v) || v <= 0) return alert("Valor inválido");
    const dom = Number(dayOfMonth);
    if (!Number.isFinite(dom) || dom < 1 || dom > 31) return alert("Dia do mês inválido");

    const { error } = await supabase.from("recurring_rules").insert({
      user_id: user.id,
      active,
      type,
      amount: v,
      description: description.trim(),
      day_of_month: dom,
      category_id: categoryId || null,
      method: method.trim() || null,
      notes: notes.trim() || null,
    });

    if (error) return alert(error.message);

    // reset leve
    setAmount("");
    setDescription("");
    setDayOfMonth(5);
    setCategoryId("");
    setMethod("");
    setNotes("");
    setType("expense");
    setActive(true);

    await load();
  }

  async function toggleActive(rule) {
    const { error } = await supabase
      .from("recurring_rules")
      .update({ active: !rule.active })
      .eq("id", rule.id);

    if (error) return alert(error.message);
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)));
  }

  async function remove(id) {
    const ok = confirm("Excluir esta recorrência?");
    if (!ok) return;

    const { error } = await supabase.from("recurring_rules").delete().eq("id", id);
    if (error) return alert(error.message);

    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Recorrências</h1>

      <form onSubmit={add} className="app-card form-row">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <input className="app-input" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Ativa
          </label>

          <select className="app-input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="expense">Saída</option>
            <option value="income">Entrada</option>
          </select>

          <input className="app-input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor (ex: 199,90)" inputMode="decimal" style={{ width: 160 }} />
          <input className="app-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (ex: Internet)" style={{ width: 260 }} />

          <input
            className="app-input"
            type="number"
            min="1"
            max="31"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            title="Dia do mês"
            style={{ width: 110 }}
          />

          <select className="app-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ minWidth: 220 }}>
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <input className="app-input" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Método (opcional)" style={{ width: 180 }} />
        </div>

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações (opcional)" rows={2} />

        <div>
          <button className="app-btn" type="submit">Adicionar recorrência</button>
        </div>
      </form>

      {loading ? (
        <div>Carregando…</div>
      ) : rules.length === 0 ? (
        <div>Nenhuma recorrência cadastrada.</div>
      ) : (
        <div className="app-card table-wrap" style={{ border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
          <table className="table" width="100%" cellPadding="10" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "rgba(0,0,0,0.04)" }}>
                <th>Status</th>
                <th>Dia</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th style={{ textAlign: "right" }}>Valor</th>
                <th style={{ width: 220 }}></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const cat = r.category_id ? catById.get(r.category_id) : null;
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                    <td>{r.active ? "Ativa" : "Pausada"}</td>
                    <td>Dia {r.day_of_month}</td>
                    <td>{r.type === "income" ? "Entrada" : "Saída"}</td>
                    <td style={{ fontWeight: 800 }}>{r.description}</td>
                    <td>
                      {cat ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: cat.color || "#6b7280" }} />
                          {cat.name}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 900 }}>{formatBRL(Number(r.amount))}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <button className="app-btn" type="button" onClick={() => toggleActive(r)}>
                          {r.active ? "Pausar" : "Ativar"}
                        </button>
                        <button className="app-btn" type="button" onClick={() => remove(r.id)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}