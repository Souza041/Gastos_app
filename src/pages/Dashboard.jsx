import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function monthStartEnd(year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  return { start: toISODate(start), end: toISODate(end) };
}

function monthLabel(year, monthIndex) {
  const d = new Date(year, monthIndex, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function pctChange(curr, prev) {
  if (!Number.isFinite(prev) || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function diff(curr, prev) {
  return (Number(curr) || 0) - (Number(prev) || 0);
}

function formatPct(p) {
  if (p === null) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

function computeTotals(tx) {
  let income = 0;
  let expense = 0;
  for (const it of tx) {
    const v = Number(it.amount) || 0;
    if (it.type === "income") income += v;
    else expense += v;
  }
  return { income, expense, balance: income - expense };
}

function moneyClassForTransaction(type) {
  if (type === "income") return "money money-income";
  if (type === "expense") return "money money-expense";
  return "money money-neutral";
}

function moneyClassForBalance(value) {
  const v = Number(value) || 0;
  return v >= 0 ? "money money-positive" : "money money-negative";
}

function balanceStatusLabel(value) {
  const v = Number(value) || 0;
  return v >= 0 ? "positivo" : "negativo";
}

function balanceHealthWidth(income, expense) {
  const inc = Number(income) || 0;
  const exp = Number(expense) || 0;

  if (inc <= 0 && exp <= 0) return 0;
  if (inc <= 0) return 100;

  const ratio = (exp / inc) * 100;
  return Math.max(0, Math.min(100, ratio));
}

function balanceHealthMessage(balance) {
  const v = Number(balance) || 0;
  if (v > 0) return "Você fechou o mês no azul.";
  if (v < 0) return "Suas saídas passaram das entradas.";
  return "Seu mês está zerado.";
}

export default function Dashboard() {
  const { user } = useAuth();

  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0..11
  const month1 = month + 1; // 1..12

  const [history6, setHistory6] = useState([]);

  const currRange = useMemo(() => monthStartEnd(year, month), [year, month]);

  // mês anterior
  const prevYM = useMemo(() => {
    let py = year;
    let pm = month - 1;
    if (pm < 0) {
      pm = 11;
      py = year - 1;
    }
    return { py, pm };
  }, [year, month]);

  const prevRange = useMemo(() => monthStartEnd(prevYM.py, prevYM.pm), [prevYM]);

  const [loading, setLoading] = useState(true);

  const [currTx, setCurrTx] = useState([]);
  const [prevTx, setPrevTx] = useState([]);
  const [categories, setCategories] = useState([]);

  // ✅ NOVO: budgets do mês atual selecionado
  const [budgets, setBudgets] = useState([]);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  async function loadMonthTx(range) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id,type,amount,date,category_id,description")
      .eq("user_id", user.id)
      .gte("date", range.start)
      .lt("date", range.end);

    if (error) throw error;
    return data ?? [];
  }

  async function loadBudgets(y, m1) {
    const { data, error } = await supabase
      .from("budgets")
      .select("id,category_id,year,month,limit_amount")
      .eq("user_id", user.id)
      .eq("year", y)
      .eq("month", m1);

    if (error) throw error;
    return data ?? [];
  }

  async function loadAll() {
    if (!user) return;
    setLoading(true);

    try {
      const [cRes, currData, prevData, bData, histData] = await Promise.all([
        supabase
          .from("categories")
          .select("id,name,color")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
        loadMonthTx(currRange),
        loadMonthTx(prevRange),
        loadBudgets(year, month1),
        loadHistory6Months(),
      ]);

      if (cRes.error) throw cRes.error;

      setCategories(cRes.data ?? []);
      setCurrTx(currData);
      setPrevTx(prevData);
      setBudgets(bData);
      setHistory6(histData);
    } catch (e) {
      console.error(e);
      alert(e.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currRange.start, currRange.end, prevRange.start, prevRange.end, year, month1]);

  const catById = useMemo(() => {
    const map = new Map();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const currTotals = useMemo(() => computeTotals(currTx), [currTx]);
  const prevTotals = useMemo(() => computeTotals(prevTx), [prevTx]);

  // gráfico comparativo
  const chartData = useMemo(() => {
    return [
      {
        name: "Entradas",
        atual: Number(currTotals.income.toFixed(2)),
        anterior: Number(prevTotals.income.toFixed(2)),
      },
      {
        name: "Saídas",
        atual: Number(currTotals.expense.toFixed(2)),
        anterior: Number(prevTotals.expense.toFixed(2)),
      },
      {
        name: "Saldo",
        atual: Number(currTotals.balance.toFixed(2)),
        anterior: Number(prevTotals.balance.toFixed(2)),
      },
    ];
  }, [currTotals, prevTotals]);

  // top categorias (mês atual)
  const topCategories = useMemo(() => {
    const map = new Map();
    let uncategorized = 0;

    for (const it of currTx) {
      if (it.type !== "expense") continue;
      const v = Number(it.amount) || 0;

      if (!it.category_id) {
        uncategorized += v;
        continue;
      }
      map.set(it.category_id, (map.get(it.category_id) || 0) + v);
    }

    const arr = Array.from(map.entries()).map(([id, sum]) => {
      const c = catById.get(id);
      return {
        id,
        name: c?.name || "Categoria",
        color: c?.color || "#6b7280",
        sum,
      };
    });

    if (uncategorized > 0) {
      arr.push({ id: "none", name: "Sem categoria", color: "#6b7280", sum: uncategorized });
    }

    arr.sort((a, b) => b.sum - a.sum);
    return arr.slice(0, 6);
  }, [currTx, catById]);

  // comparativo por categoria (mês atual vs anterior)
  const categoryComparison = useMemo(() => {
    const sumCurr = new Map();
    const sumPrev = new Map();
    const add = (map, key, v) => map.set(key, (map.get(key) || 0) + v);

    for (const it of currTx) {
      if (it.type !== "expense") continue;
      const v = Number(it.amount) || 0;
      const key = it.category_id || "none";
      add(sumCurr, key, v);
    }

    for (const it of prevTx) {
      if (it.type !== "expense") continue;
      const v = Number(it.amount) || 0;
      const key = it.category_id || "none";
      add(sumPrev, key, v);
    }

    const keys = new Set([...sumCurr.keys(), ...sumPrev.keys()]);

    const rows = Array.from(keys).map((key) => {
      const curr = sumCurr.get(key) || 0;
      const prev = sumPrev.get(key) || 0;
      const name = key === "none" ? "Sem categoria" : (catById.get(key)?.name ?? "Categoria");
      const color = key === "none" ? "#6b7280" : (catById.get(key)?.color ?? "#6b7280");
      const d = curr - prev;
      const p = prev === 0 ? null : ((curr - prev) / prev) * 100;
      return { key, name, color, curr, prev, diff: d, pct: p };
    });

    rows.sort((a, b) => b.curr - a.curr);
    return rows.filter((r) => r.curr !== 0 || r.prev !== 0).slice(0, 8);
  }, [currTx, prevTx, catById]);

  // ✅ NOVO: progresso do orçamento por categoria (mês selecionado)
  const budgetProgress = useMemo(() => {
    // soma despesas por categoria no mês atual
    const spent = new Map(); // category_id -> sum
    for (const it of currTx) {
      if (it.type !== "expense") continue;
      if (!it.category_id) continue; // orçamento só faz sentido em categoria (você pode mudar depois)
      const v = Number(it.amount) || 0;
      spent.set(it.category_id, (spent.get(it.category_id) || 0) + v);
    }

    // transforma budgets em linhas com gasto
    const rows = budgets.map((b) => {
      const cat = catById.get(b.category_id);
      const s = spent.get(b.category_id) || 0;
      const limit = Number(b.limit_amount) || 0;
      const pct = limit === 0 ? null : (s / limit) * 100;
      return {
        id: b.id,
        category_id: b.category_id,
        name: cat?.name || "Categoria",
        color: cat?.color || "#6b7280",
        spent: s,
        limit,
        pct,
      };
    });

    // ordenar por maior % usada (pra aparecer o que tá estourando primeiro)
    rows.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
    return rows;
  }, [budgets, currTx, catById]);

  function CompareNote({ curr, prev, kind }) {
    const d = diff(curr, prev);
    const p = pctChange(curr, prev);

    // despesas: subir = ruim (vermelho), cair = bom (verde)
    const isExpense = kind === "expense";
    const color =
      p === null
        ? "#6b7280"
        : isExpense
          ? (p > 0 ? "#b91c1c" : p < 0 ? "#15803d" : "#6b7280")
          : (p > 0 ? "#15803d" : p < 0 ? "#b91c1c" : "#6b7280");

    const sign = d > 0 ? "+" : "";
    const dText = `${sign}${formatBRL(Math.abs(d))}`.replace("R$", d < 0 ? "-R$" : "R$");

    return (
      <div style={{ marginTop: 6, fontSize: 12, color }}>
        {d === 0 ? "Sem mudança" : `${dText} (${formatPct(p)})`} vs mês anterior
      </div>
    );
  }

  function progressColor(pct) {
    if (pct === null) return "#6b7280";
    if (pct < 70) return "#15803d"; // verde
    if (pct < 100) return "#a16207"; // amarelo
    return "#b91c1c"; // vermelho
  }

  function getLastNMonths(year, monthIndex, count = 6) {
    const result = [];

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(year, monthIndex - i, 1);
      result.push({
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
        month1: d.getMonth() + 1,
        label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        ...monthStartEnd(d.getFullYear(), d.getMonth()),
      });
    }

    return result;
  }

  async function loadHistory6Months() {
    if (!user) return [];

    const months = getLastNMonths(year, month, 6);

    const results = await Promise.all(
      months.map(async (m) => {
        const { data, error } = await supabase
          .from("transactions")
          .select("type,amount,date")
          .eq("user_id", user.id)
          .gte("date", m.start)
          .lt("date", m.end);

        if (error) throw error;

        let income = 0;
        let expense = 0;

        for (const row of data ?? []) {
          const v = Number(row.amount) || 0;
          if (row.type === "income") income += v;
          else expense += v;
        }

        return {
          label: m.label,
          income: Number(income.toFixed(2)),
          expense: Number(expense.toFixed(2)),
          balance: Number((income - expense).toFixed(2)),
        };
      })
    );

    return results;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>

        {/* MonthPicker */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="app-btn" onClick={prevMonth}>{"<"}</button>
          <div style={{ minWidth: 240, textAlign: "center", fontWeight: 900 }}>
            {monthLabel(year, month)}
          </div>
          <button className="app-btn" onClick={nextMonth}>{">"}</button>
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Comparando com: <strong>{monthLabel(prevYM.py, prevYM.pm)}</strong>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div className="app-card" style={{ padding: 14 }}>
          <div className="app-muted" style={{ fontSize: 12 }}>Entradas</div>
          <div className={`money ${moneyClassForTransaction("income")}`} style={{ fontSize: 22 }}>{formatBRL(currTotals.income)}</div>
          <CompareNote curr={currTotals.income} prev={prevTotals.income} kind="income" />
        </div>

        <div className="app-card" style={{ padding: 14 }}>
          <div className="app-muted" style={{ fontSize: 12 }}>Saídas</div>
          <div className={`money ${moneyClassForTransaction("expense")}`} style={{ fontSize: 22 }}>{formatBRL(currTotals.expense)}</div>
          <CompareNote curr={currTotals.expense} prev={prevTotals.expense} kind="expense" />
        </div>

        <div className="app-card" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div className="app-muted" style={{ fontSize: 12 }}>Saldo</div>

            <span
              className="app-badge"
              style={{
                color: currTotals.balance >= 0 ? "#22c55e" : "#ef4444",
                borderColor: currTotals.balance >= 0 ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)",
                background: currTotals.balance >= 0 ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)",
              }}
            >
              {balanceStatusLabel(currTotals.balance)}
            </span>
          </div>

          <div
            className={`money ${moneyClassForBalance(currTotals.balance)}`} 
            style={{ fontSize: 22 }}
          >
            {formatBRL(currTotals.balance)}
          </div>

          <CompareNote 
            curr={currTotals.balance} 
            prev={prevTotals.balance} 
            kind="balance" 
          />

          <div className="balance-health-track">
            <div
              className={`balance-health-fill ${currTotals.balance >= 0 ? "positive" : "negative"}`}
              style={{ width: `${balanceHealthWidth(currTotals.income, currTotals.expense)}%` }}
            />
          </div>

          <div className="app-muted" style={{ fontSize: 12, marginTop: 8 }}>
            {balanceHealthMessage(currTotals.balance)}
          </div>
        </div>
      </div>

      {loading ? (
        <div>Carregando…</div>
      ) : (
        <div className="dashboard-top-grid">
          {/* Gráfico comparativo */}
          <div className="app-card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Atual vs Anterior</div>

            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v) => formatBRL(Number(v))} />
                  <Bar dataKey="atual" />
                  <Bar dataKey="anterior" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {!loading && (
            <div className="app-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap:"wrap",}}>
                <div style={{ fontWeight: 900 }}>Últimos 6 meses</div>
                <div className="app-muted" style={{ fontSize: 12 }}>
                  entradas, saídas e saldo
                </div>
              </div>

              <div className="chart-box" style={{ marginTop: 10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history6}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip formatter={(v) => formatBRL(Number(v))} />
                      <Line type="monotone" dataKey="income" strokeWidth={2} dot />
                      <Line type="monotone" dataKey="expense" strokeWidth={2} dot />
                      <Line type="monotone" dataKey="balance" strokeWidth={3} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Direita: Categorias + Orçamentos */}
          <div style={{ display: "grid", gap: 12 }}>
            {/* Top categorias */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Top categorias (despesas)</div>

              {topCategories.length === 0 ? (
                <div style={{ opacity: 0.7 }}>Sem despesas neste mês.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {topCategories.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: c.color }} />
                        <span style={{ fontWeight: 800 }}>{c.name}</span>
                      </div>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatBRL(c.sum)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ✅ NOVO: Orçamentos (progresso) */}
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontWeight: 900 }}>Orçamentos do mês</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {monthLabel(year, month)}
                </div>
              </div>

              {budgetProgress.length === 0 ? (
                <div style={{ opacity: 0.7, marginTop: 8 }}>
                  Nenhum orçamento definido. Vá em <strong>Orçamentos</strong> e crie metas.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
                  {budgetProgress.slice(0, 8).map((b) => {
                    const pct = b.pct;
                    const barColor = progressColor(pct);
                    const pctText = pct === null ? "—" : `${pct.toFixed(0)}%`;
                    const over = pct !== null && pct > 100;

                    return (
                      <div key={b.id} style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 999, background: b.color }} />
                            <div>
                              <div style={{ fontWeight: 900 }}>{b.name}</div>
                              <div style={{ fontSize: 12, opacity: 0.7 }}>
                                {formatBRL(b.spent)} de {formatBRL(b.limit)}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 900, color: barColor }}>{pctText}</div>
                            {over && <div style={{ fontSize: 12, color: "#b91c1c" }}>Estourou</div>}
                          </div>
                        </div>

                        {/* barra */}
                        <div style={{ marginTop: 8, height: 10, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(100, Math.max(0, pct ?? 0))}%`,
                              background: barColor,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comparativo por categoria */}
      {!loading && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontWeight: 900 }}>Categorias: atual vs anterior (despesas)</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              vs {monthLabel(prevYM.py, prevYM.pm)}
            </div>
          </div>

          {categoryComparison.length === 0 ? (
            <div style={{ opacity: 0.7, marginTop: 8 }}>Sem dados para comparar.</div>
          ) : (
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {categoryComparison.map((r) => {
                // despesas: subir = ruim (vermelho), cair = bom (verde)
                const color =
                  r.pct === null ? "#6b7280" : r.pct > 0 ? "#b91c1c" : r.pct < 0 ? "#15803d" : "#6b7280";

                const sign = r.diff > 0 ? "+" : "";
                const diffText = `${sign}${formatBRL(Math.abs(r.diff))}`.replace("R$", r.diff < 0 ? "-R$" : "R$");
                const pctText = r.pct === null ? "—" : `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(1)}%`;

                return (
                  <div
                    key={r.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 10,
                      paddingTop: 10,
                      borderTop: "1px solid #eee",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: r.color }} />
                      <div>
                        <div style={{ fontWeight: 900 }}>{r.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          atual {formatBRL(r.curr)} • anterior {formatBRL(r.prev)}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900 }}>{formatBRL(r.curr)}</div>
                      <div style={{ fontSize: 12, color }}>
                        {r.diff === 0 ? "Sem mudança" : `${diffText} (${pctText})`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Atual: {currRange.start} até {currRange.end} • Anterior: {prevRange.start} até {prevRange.end}
      </div>
    </div>
  );
}