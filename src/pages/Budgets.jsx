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

function monthLabel(year, monthIndex0) {
  const d = new Date(year, monthIndex0, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function Budgets() {
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth()); // 0..11
  const month1 = month0 + 1; // 1..12

  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]); // rows
  const [loading, setLoading] = useState(true);

  const [categoryId, setCategoryId] = useState("");
  const [limitAmount, setLimitAmount] = useState("");

  const budgetByCategory = useMemo(() => {
    const map = new Map();
    for (const b of budgets) map.set(b.category_id, b);
    return map;
  }, [budgets]);

  function prevMonth() {
    if (month0 === 0) {
      setMonth0(11);
      setYear((y) => y - 1);
    } else setMonth0((m) => m - 1);
  }

  function nextMonth() {
    if (month0 === 11) {
      setMonth0(0);
      setYear((y) => y + 1);
    } else setMonth0((m) => m + 1);
  }

  async function load() {
    if (!user) return;
    setLoading(true);

    const [cRes, bRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id,name,color")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),
      supabase
        .from("budgets")
        .select("id,category_id,year,month,limit_amount,created_at")
        .eq("user_id", user.id)
        .eq("year", year)
        .eq("month", month1),
    ]);

    if (cRes.error) {
      console.error(cRes.error);
      alert(cRes.error.message);
      setLoading(false);
      return;
    }
    if (bRes.error) {
      console.error(bRes.error);
      alert(bRes.error.message);
      setLoading(false);
      return;
    }

    setCategories(cRes.data ?? []);
    setBudgets(bRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, year, month1]);

  async function upsertBudget(e) {
    e.preventDefault();
    if (!user) return;

    if (!categoryId) return alert("Selecione uma categoria");
    const v = parseAmountBR(limitAmount);
    if (!Number.isFinite(v) || v < 0) return alert("Valor inválido");

    const existing = budgetByCategory.get(categoryId);

    if (existing) {
      const { error } = await supabase
        .from("budgets")
        .update({ limit_amount: v })
        .eq("id", existing.id);

      if (error) {
        console.error(error);
        return alert(error.message);
      }
    } else {
      const { error } = await supabase.from("budgets").insert({
        user_id: user.id,
        category_id: categoryId,
        year,
        month: month1,
        limit_amount: v,
      });

      if (error) {
        console.error(error);
        return alert(error.message);
      }
    }

    setCategoryId("");
    setLimitAmount("");
    await load();
  }

  async function removeBudget(id) {
    const ok = confirm("Remover orçamento desta categoria?");
    if (!ok) return;

    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) {
      console.error(error);
      return alert(error.message);
    }
    setBudgets((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Orçamentos</h1>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="app-btn" onClick={prevMonth}>{"<"}</button>
          <div style={{ minWidth: 240, textAlign: "center", fontWeight: 900 }}>
            {monthLabel(year, month0)}
          </div>
          <button className="app-btn" onClick={nextMonth}>{">"}</button>
        </div>
      </div>

      <form onSubmit={upsertBudget} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select className="app-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ minWidth: 240 }}>
          <option value="">Selecione a categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <input
          className="app-input"
          value={limitAmount}
          onChange={(e) => setLimitAmount(e.target.value)}
          placeholder="Meta (ex: 800,00)"
          inputMode="decimal"
          style={{ width: 160 }}
        />

        <button className="app-btn" type="submit">Salvar</button>
      </form>

      {loading ? (
        <div>Carregando…</div>
      ) : budgets.length === 0 ? (
        <div>Nenhum orçamento definido para este mês.</div>
      ) : (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
          <table width="100%" cellPadding="10" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "rgba(0,0,0,0.04)" }}>
                <th>Categoria</th>
                <th style={{ textAlign: "right" }}>Meta</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {budgets
                .slice()
                .sort((a, b) => Number(b.limit_amount) - Number(a.limit_amount))
                .map((b) => {
                  const c = categories.find((x) => x.id === b.category_id);
                  return (
                    <tr key={b.id} style={{ borderTop: "1px solid #eee" }}>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: c?.color || "#6b7280" }} />
                          <span style={{ fontWeight: 800 }}>{c?.name || "Categoria"}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 900 }}>
                        {formatBRL(Number(b.limit_amount))}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className="app-btn" type="button" onClick={() => removeBudget(b.id)}>Remover</button>
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