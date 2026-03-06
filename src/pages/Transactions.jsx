import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function monthStartEnd(year, monthIndex) {
  // monthIndex: 0..11
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  return { start: toISODate(start), end: toISODate(end) };
}

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function parseAmountBR(value) {
  // aceita "12.50" ou "12,50"
  const v = Number(String(value).replace(".", "").replace(",", "."));
  // atenção: linha acima remove separador de milhar "1.234,56" => "1234,56"
  // para "12.50" vira "1250" (ruim), então tratamos:
  // se tiver "." e não tiver "," assume decimal com "."
  const s = String(value);
  if (s.includes(".") && !s.includes(",")) {
    const v2 = Number(s);
    return Number.isFinite(v2) ? v2 : NaN;
  }
  return Number.isFinite(v) ? v : NaN;
}

function monthLabel(year, monthIndex) {
  const d = new Date(year, monthIndex, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function clampDayToMonth(year, monthIndex0, day) {
  // monthIndex0: 0..11
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate(); // último dia do mês
  return Math.min(Math.max(1, day), lastDay);
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

export default function Transactions() {
  const { user } = useAuth();

  // ======= Mês selecionado =======
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0..11

  const range = useMemo(() => monthStartEnd(year, month), [year, month]);

  // ======= Dados =======
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);

  // ======= Form (criar) =======
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [categoryId, setCategoryId] = useState("");

  // ======= Edição =======
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({
    type: "expense",
    amount: "",
    description: "",
    date: toISODate(new Date()),
    category_id: "",
  });

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const it of items) {
      const v = Number(it.amount) || 0;
      if (it.type === "income") income += v;
      else expense += v;
    }
    return { income, expense, balance: income - expense };
  }, [items]);

  const catById = useMemo(() => {
    const map = new Map();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

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

  function csvEscape(value) {
    const s = String(value ?? "");
    return `"${s.replace(/"/g, '""')}"`;
  }

  function downloadTextFile(filename, text, mime = "text/csv;charset=utf-8") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  async function exportMonthCSV() {
    if (!user) return;

    try {
      // 1- pega transações do mês selecionado
      const { data, error } = await supabase
      .from("transactions")
      .select("id,date,type,description,amount,method,notes,source,category_id,categories(name)")
      .eq("user_id", user.id)
      .gte("date", range.start)
      .lt("date", range.end)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });
    
    if (error) throw error;

    const rows = data ?? [];

    // 2- monta csv
    const header = [
      "date",
      "type",
      "description",
      "category",
      "amount",
      "method",
      "notes",
      "source",
    ];

    const lines = [header.map(csvEscape).join(";")]

    for (const r of rows) {
      const categoryName = r.categories?.name ?? "";
      lines.push(
        [
          r.date,
          r.type,
          r.description,
          categoryName,
          r.amount,
          r.method ?? "",
          r.notes ?? "",
          r.source ?? "",
        ].map(csvEscape).join(";")
      );
    }

    const filename = `gastos_${year}-${String(month + 1).padStart(2, "0")}.csv`;
    downloadTextFile(lines.join("\n") ? filename : "gastos.csv", lines.join("\n"));
    } catch (e) {
      console.error(e);
      alert(e.message || "Erro ao exportar CSV");
    }
  }
  async function exportYarCSV() {
    if (!user) return;

    try {
      const start = `${year}-01-01`;
      const end = `${year + 1}-01-01`;

      const { data, error } = await supabase
      .from("transactions")
      .select("id,date,type,description,amount,method,notes,source,category_id,categories(name)")
      .eq("user_id", user.id)
      .gte("date", range.start)
      .lt("date", range.end)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });
    
    if (error) throw error;

    const rows = data ?? [];

    // 2- monta csv
    const header = [
      "date",
      "type",
      "description",
      "category",
      "amount",
      "method",
      "notes",
      "source",
    ];

    const lines = [header.map(csvEscape).join(";")]

    for (const r of rows) {
      const categoryName = r.categories?.name ?? "";
      lines.push(
        [
          r.date,
          r.type,
          r.description,
          categoryName,
          r.amount,
          r.method ?? "",
          r.notes ?? "",
          r.source ?? "",
        ].map(csvEscape).join(";")
      );
    }

    const filename = `gastos_${year}.csv`;
    downloadTextFile(filename, lines.join("\n"));
    } catch (e) {
      console.error(e);
      alert(e.message || "Erro ao exportar CSV do ano");
    }
  }

  // ======= Load categories =======
  async function loadCategories() {
    if (!user) return;

    const { data, error } = await supabase
      .from("categories")
      .select("id,name,color,icon,created_at")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setCategories(data ?? []);
  }

  // ======= Load transactions =======
  async function loadTransactions() {
    if (!user) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("transactions")
      .select("id,type,amount,description,date,category_id,created_at")
      .eq("user_id", user.id)
      .gte("date", range.start)
      .lt("date", range.end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

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
    if (!user) return;
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, range.start, range.end]);

  // ======= Create =======
  async function addTransaction(e) {
    e.preventDefault();
    if (!user) return;

    const v = parseAmountBR(amount);
    if (!description.trim()) return alert("Descrição obrigatória");
    if (!date) return alert("Data obrigatória");
    if (!Number.isFinite(v) || v <= 0) return alert("Valor inválido");

    const payload = {
      user_id: user.id,
      type,
      amount: v,
      description: description.trim(),
      date,
      category_id: categoryId || null,
    };

    const { error } = await supabase.from("transactions").insert(payload);
    if (error) {
      console.error(error);
      return alert(error.message);
    }

    setAmount("");
    setDescription("");
    setType("expense");
    setDate(toISODate(new Date()));
    setCategoryId("");

    await loadTransactions();
  }

  // ======= Delete =======
  async function removeTransaction(id) {
    const ok = confirm("Excluir este lançamento?");
    if (!ok) return;

    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      console.error(error);
      return alert(error.message);
    }

    setItems((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) setEditingId(null);
  }

  // ======= Edit flow =======
  function startEdit(it) {
    setEditingId(it.id);
    setEdit({
      type: it.type,
      amount: String(it.amount),
      description: it.description,
      date: it.date,
      category_id: it.category_id || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId) return;

    const v = parseAmountBR(edit.amount);
    if (!edit.description.trim()) return alert("Descrição obrigatória");
    if (!edit.date) return alert("Data obrigatória");
    if (!Number.isFinite(v) || v <= 0) return alert("Valor inválido");

    const { error } = await supabase
      .from("transactions")
      .update({
        type: edit.type,
        amount: v,
        description: edit.description.trim(),
        date: edit.date,
        category_id: edit.category_id || null,
      })
      .eq("id", editingId);

    if (error) {
      console.error(error);
      return alert(error.message);
    }

    setEditingId(null);
    await loadTransactions();
  }

  async function generateRecurrencesForSelectedMonth() {
    if (!user) return;

    const y = year;
    const m1 = month + 1; // 1..12
    const m0 = month;     // 0..11

    try {
      // 1) regras ativas
      const rulesRes = await supabase
        .from("recurring_rules")
        .select("id,type,amount,description,day_of_month,category_id,method,notes,active")
        .eq("user_id", user.id)
        .eq("active", true);

      if (rulesRes.error) throw rulesRes.error;
      const rules = rulesRes.data ?? [];
      if (rules.length === 0) return alert("Nenhuma recorrência ativa para gerar.");

      // 2) o que já foi gerado nesse mês
      const genRes = await supabase
        .from("recurring_generated")
        .select("rule_id")
        .eq("user_id", user.id)
        .eq("year", y)
        .eq("month", m1);

      if (genRes.error) throw genRes.error;
      const already = new Set((genRes.data ?? []).map((x) => x.rule_id));

      const toCreate = rules.filter((r) => !already.has(r.id));
      if (toCreate.length === 0) return alert("Tudo já foi gerado para este mês ✅");

      // 3) cria transações (em lote)
      const txPayload = toCreate.map((r) => {
        const day = clampDayToMonth(y, m0, r.day_of_month);
        const date = toISODate(new Date(y, m0, day));
        return {
          user_id: user.id,
          type: r.type,
          amount: Number(r.amount),
          description: r.description,
          date,
          category_id: r.category_id || null,
          method: r.method || null,
          notes: r.notes || null,
          source: "recurring",
        };
      });

      const insertTxRes = await supabase
        .from("transactions")
        .insert(txPayload)
        .select("id");

      if (insertTxRes.error) throw insertTxRes.error;

      const inserted = insertTxRes.data ?? [];
      if (inserted.length !== toCreate.length) {
        // raro, mas aviso
        console.warn("Quantidade inserida difere das regras.");
      }

      // 4) registra no log recurring_generated (pra não duplicar)
      const genPayload = inserted.map((row, idx) => ({
        user_id: user.id,
        rule_id: toCreate[idx].id,
        year: y,
        month: m1,
        transaction_id: row.id,
      }));

      const insertGenRes = await supabase.from("recurring_generated").insert(genPayload);
      if (insertGenRes.error) throw insertGenRes.error;

      alert(`Gerado com sucesso: ${inserted.length} lançamentos ✅`);
      await loadTransactions();
    } catch (e) {
      console.error(e);
      alert(e.message || "Erro ao gerar recorrências");
    }
  }

    async function undoRecurrencesForSelectedMonth() {
    if (!user) return;

    const y = year;
    const m1 = month + 1;

    const ok = confirm("Desfazer as recorrências geradas deste mês? Isso vai apagar apenas lançamentos gerados automaticamente.");
    if (!ok) return;

    try {
      // 1) buscar o que foi gerado
      const genRes = await supabase
        .from("recurring_generated")
        .select("id, transaction_id")
        .eq("user_id", user.id)
        .eq("year", y)
        .eq("month", m1);

      if (genRes.error) throw genRes.error;

      const rows = genRes.data ?? [];
      if (rows.length === 0) return alert("Nada para desfazer neste mês.");

      const txIds = rows.map((r) => r.transaction_id);

      // 2) apagar transactions (só as geradas)
      // Aqui garantimos que só apaga source='recurring' por segurança extra
      const delTx = await supabase
        .from("transactions")
        .delete()
        .in("id", txIds)
        .eq("user_id", user.id)
        .eq("source", "recurring");

      if (delTx.error) throw delTx.error;

      // 3) apagar logs
      const delGen = await supabase
        .from("recurring_generated")
        .delete()
        .eq("user_id", user.id)
        .eq("year", y)
        .eq("month", m1);

      if (delGen.error) throw delGen.error;

      alert(`Desfeito: ${txIds.length} lançamentos ✅`);
      await loadTransactions();
    } catch (e) {
      console.error(e);
      alert(e.message || "Erro ao desfazer recorrências");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Lançamentos</h1>

        {/* MonthPicker */}
        <div className="form-row" style={{ justifyContent: "flex-end" }}>

          <button className="app-btn" type="button" onClick={exportMonthCSV}>Exportar CSV mês</button>

          <button className="app-btn" type="button" onClick={exportYarCSV}>Exportar CSV ano</button>

          <button className="app-btn app-btn-primary" type="button" onClick={generateRecurrencesForSelectedMonth}>
            Gerar recorrências do mês
          </button>

          <button className="app-btn app-btn-danger" type="button" onClick={undoRecurrencesForSelectedMonth}>
            Desfazer recorrências do mês
          </button>

          <button className="app-btn" onClick={prevMonth}>{"<"}</button>
          <div style={{ minWidth: 220, textAlign: "center", fontWeight: 700 }}>
            {monthLabel(year, month)}
          </div>
          <button className="app-btn" onClick={nextMonth}>{">"}</button>
        </div>
      </div>

      {/* Totais do mês selecionado */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="app-card" style={{ padding: 14, minWidth: 220 }}>
          <div className="app-muted" style={{ fontSize: 12 }}>Entradas</div>
          <div className={moneyClassForTransaction("income")} style={{ fontSize: 22}}>{formatBRL(totals.income)}</div>
        </div>

        <div className="app-card" style={{ padding: 12, minWidth: 220 }}>
          <div className="app-muted" style={{ fontSize: 12 }}>Saídas</div>
          <div className={moneyClassForTransaction("expense")} style={{ fontSize: 22}}>{formatBRL(totals.expense)}</div>
        </div>

        <div className="app-card" style={{ padding: 14, minWidth: 220 }}>
          <div className="app-muted" style={{ fontSize: 12 }}>Saldo</div>
          <div className={`money ${moneyClassForBalance(totals.balance)}`} style={{ fontSize: 20 }}>{formatBRL(totals.balance)}</div>
        </div>
      </div>

      {/* Form adicionar */}
      <form className="form-row" onSubmit={addTransaction}>
        <select className="app-input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="expense">Saída</option>
          <option value="income">Entrada</option>
        </select>

        <input
          className="app-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Valor (ex: 12,50)"
          inputMode="decimal"
          style={{ width: 160 }}
        />

        <input 
          className="app-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrição"
          style={{ width: 260 }}
        />

        <input className="app-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        {/* Select categorias */}
        <select className="app-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ minWidth: 200 }}>
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <button className="app-btn app-btn-primary" type="submit">Adicionar</button>
      </form>

      {/* Lista */}
      {loading ? (
        <div>Carregando…</div>
      ) : items.length === 0 ? (
        <div>Nenhum lançamento neste mês.</div>
      ) : (
        <div className="app-card table-wrap" style={{ border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
          <table className="table" width="100%" cellPadding="10" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "rgba(0,0,0,0.04)" }}>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th style={{ textAlign: "right" }}>Valor</th>
                <th style={{ width: 220 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const cat = it.category_id ? catById.get(it.category_id) : null;
                const isEditing = editingId === it.id;

                return (
                  <tr key={it.id} style={{ borderTop: "1px solid #eee" }}>
                    <td>
                      {isEditing ? (
                        <input 
                          className="app-input"
                          type="date"
                          value={edit.date}
                          onChange={(e) => setEdit((p) => ({ ...p, date: e.target.value }))}
                        />
                      ) : (
                        it.date
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <select
                          className="app-input"
                          value={edit.type}
                          onChange={(e) => setEdit((p) => ({ ...p, type: e.target.value }))}
                        >
                          <option value="expense">Saída</option>
                          <option value="income">Entrada</option>
                        </select>
                      ) : (
                        <span className={it.type === "income" ? "money-income" : "money-expense"}>
                          {it.type === "income" ? "Entrada" : "Saída"}
                        </span>
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <input 
                          className="app-input"
                          value={edit.description}
                          onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))}
                        />
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap:8 }}>
                          <span style={{ fontWeight: 800 }}>{it.description}</span>

                          {it.source === "recurring" && (
                            <span className="aoo-badge" title="Gerado automaticamente pela recorrência">
                              🔁 recorrente
                            </span>
                          )}
                        </span>
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <select
                          className="app-input"
                          value={edit.category_id}
                          onChange={(e) => setEdit((p) => ({ ...p, category_id: e.target.value }))}
                        >
                          <option value="">Sem categoria</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : cat ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: cat.color || "#6b7280" }} />
                          {cat.name}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      {isEditing ? (
                        <input
                          className="app-input"
                          value={edit.amount}
                          onChange={(e) => setEdit((p) => ({ ...p, amount: e.target.value }))}
                          inputMode="decimal"
                          style={{ width: 140, textAlign: "right" }}
                        />
                      ) : (
                        <span className={moneyClassForTransaction(it.type)}>  
                          {formatBRL(Number(it.amount))}
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: "right" }}>
                      {isEditing ? (
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button className="app-btn" onClick={saveEdit} type="button">
                            Salvar
                          </button>
                          <button className="app-btn" onClick={cancelEdit} type="button">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button className="app-btn" onClick={() => startEdit(it)} type="button">
                            Editar
                          </button>
                          <button className="app-btn app-btn-danger" onClick={() => removeTransaction(it.id)} type="button">
                            Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Intervalo: {range.start} até {range.end} (end exclusivo)
      </div>
    </div>
  );
}