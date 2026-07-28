"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  CheckSquare,
  Plus,
  Trash2,
  RefreshCw,
  TrendingUp,
  Bot,
  Calendar,
  User,
  DollarSign,
  ListTodo,
  Tag,
  Search,
  ShieldCheck,
  Smartphone,
  LogOut,
} from "lucide-react";

interface Expense {
  id: number;
  whatsapp_id: string;
  amount: number | string;
  category: string | null;
  description: string;
  created_at: string;
}

interface Todo {
  code: string;
  whatsapp_id: string;
  text: string;
  created_at: string;
}

interface Stats {
  currentMonthSpent: number;
  currentMonthCount: number;
  activeTodosCount: number;
  totalExpensesCount: number;
  year: number;
  month: number;
}

export default function Dashboard() {
  const [authState, setAuthState] = useState<"checking" | "unauthenticated" | "authenticated">("checking");
  const [authStep, setAuthStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState<"expenses" | "todos">("expenses");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string>("");

  // Modal states
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);

  // Form states
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    category: "Umum",
  });
  const [todoForm, setTodoForm] = useState({
    text: "",
  });

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const query = selectedExpenseCategory ? `?${new URLSearchParams({ category: selectedExpenseCategory }).toString()}` : "";
      const [resStats, resExpenses, resTodos, resExpenseCategories] = await Promise.all([
        fetch(`/api/stats${query}`, { credentials: "same-origin" }),
        fetch(`/api/expenses${query}`, { credentials: "same-origin" }),
        fetch("/api/todos", { credentials: "same-origin" }),
        fetch("/api/expenses/categories", { credentials: "same-origin" }),
      ]);

      if ([resStats, resExpenses, resTodos, resExpenseCategories].some((response) => response.status === 401)) {
        setAuthState("unauthenticated");
        return;
      }

      if (resStats.ok) setStats(await resStats.json());
      if (resExpenses.ok) setExpenses(await resExpenses.json());
      if (resTodos.ok) setTodos(await resTodos.json());
      if (resExpenseCategories.ok) {
        const categories = await resExpenseCategories.json() as string[];
        setExpenseCategories(categories);
        setSelectedExpenseCategory((selected) => selected && !categories.includes(selected) ? "" : selected);
      }
      setAuthState("authenticated");
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setAuthError("Tidak dapat terhubung ke server. Coba lagi setelah server tersedia.");
      setAuthState("unauthenticated");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedExpenseCategory]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(seconds - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const requestOtp = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setAuthSubmitting(true);
    setAuthError("");

    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.retryAfterSeconds) setResendSeconds(data.retryAfterSeconds);
        throw new Error(data.error || "Gagal mengirim OTP");
      }

      setPhoneNumber(data.phoneNumber);
      setOtpCode("");
      setAuthStep("otp");
      setResendSeconds(60);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Gagal mengirim OTP");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthSubmitting(true);
    setAuthError("");

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, code: otpCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "OTP tidak valid");

      setAuthState("authenticated");
      await fetchData();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "OTP tidak valid");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setAuthState("unauthenticated");
    setAuthStep("phone");
    setPhoneNumber("");
    setOtpCode("");
    setExpenses([]);
    setExpenseCategories([]);
    setSelectedExpenseCategory("");
    setTodos([]);
    setStats(null);
  };

  const formatIDR = (amount: number | string) => {
    const num = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(num)) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.amount) return;

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: expenseForm.description,
          amount: parseFloat(expenseForm.amount),
          category: expenseForm.category,
        }),
      });

      if (res.ok) {
        setIsExpenseModalOpen(false);
        setExpenseForm({ description: "", amount: "", category: "Umum" });
        fetchData();
      }
    } catch (err) {
      console.error("Failed to add expense:", err);
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoForm.text) return;

    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: todoForm.text,
        }),
      });

      if (res.ok) {
        setIsTodoModalOpen(false);
        setTodoForm({ text: "" });
        fetchData();
      }
    } catch (err) {
      console.error("Failed to add todo:", err);
    }
  };

  const handleDeleteTodo = async (code: string) => {
    try {
      const res = await fetch(`/api/todos?code=${code}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTodos((prev) => prev.filter((t) => t.code !== code));
        fetchData();
      }
    } catch (err) {
      console.error("Failed to delete todo:", err);
    }
  };

  const filteredExpenses = expenses.filter(
    (e) =>
      (selectedExpenseCategory === "" || e.category === selectedExpenseCategory) &&
      (e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(e.whatsapp_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.category && e.category.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const filteredTodos = todos.filter(
    (t) =>
      t.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(t.whatsapp_id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authState !== "authenticated") {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <section className="glass-card w-full max-w-md rounded-2xl border border-slate-800 p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Masuk ke Dashboard</h1>
            <p className="mt-2 text-sm text-slate-400">Verifikasi nomor WhatsApp Anda dengan kode OTP dari bot.</p>
          </div>

          {authState === "checking" ? (
            <div className="flex flex-col items-center py-8 text-slate-400">
              <RefreshCw className="mb-3 h-7 w-7 animate-spin text-indigo-400" />
              Memeriksa sesi...
            </div>
          ) : authStep === "phone" ? (
            <form onSubmit={requestOtp} className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Nomor WhatsApp</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="6281234567890"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-10 pr-3 text-sm text-slate-100 outline-none focus:border-indigo-500"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">Gunakan format internasional, contoh: 6281234567890.</p>
              </div>
              {authError && <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{authError}</p>}
              <button disabled={authSubmitting} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
                {authSubmitting ? "Mengirim OTP..." : "Kirim OTP melalui WhatsApp"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-5">
              <p className="rounded-lg bg-slate-900 p-3 text-center text-sm text-slate-300">Kode dikirim ke <span className="font-mono text-white">{phoneNumber}</span></p>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Kode OTP</label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-center font-mono text-xl tracking-[0.45em] text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
              {authError && <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{authError}</p>}
              <button disabled={authSubmitting || otpCode.length !== 6} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
                {authSubmitting ? "Memverifikasi..." : "Verifikasi dan Masuk"}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => { setAuthStep("phone"); setAuthError(""); }} className="text-slate-400 hover:text-white">Ubah nomor</button>
                <button type="button" disabled={resendSeconds > 0 || authSubmitting} onClick={() => requestOtp()} className="text-indigo-400 hover:text-indigo-300 disabled:text-slate-600">
                  {resendSeconds > 0 ? `Kirim ulang (${resendSeconds}s)` : "Kirim ulang OTP"}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                WhatsApp Bot Keuangan
              </h1>
              <p className="text-xs text-slate-400">Port 8080 Dashboard</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchData}
              disabled={refreshing}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center space-x-2 text-sm border border-slate-700/50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center space-x-2 text-sm border border-slate-700/50"
              title="Keluar"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
            <button
              onClick={() => (activeTab === "expenses" ? setIsExpenseModalOpen(true) : setIsTodoModalOpen(true))}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
            >
              <Plus className="h-4 w-4" />
              <span>{activeTab === "expenses" ? "Tambah Pengeluaran" : "Tambah Tugas"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Stat 1 */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition"></div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Pengeluaran Bulan Ini
                </p>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  {stats ? formatIDR(stats.currentMonthSpent) : "Rp 0"}
                </h3>
              </div>
              <div className="h-12 w-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-slate-400 space-x-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-slate-300 font-medium">{stats?.currentMonthCount || 0} transaksi</span>
              <span>bulan {stats ? `${stats.month}/${stats.year}` : ""}</span>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition"></div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Daftar Tugas Aktif
                </p>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  {stats?.activeTodosCount ?? 0}
                </h3>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <CheckSquare className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-slate-400 space-x-1">
              <ListTodo className="h-3.5 w-3.5 text-purple-400" />
              <span>Tersimpan di database PostgreSQL</span>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden group sm:col-span-2 lg:col-span-1">
            <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-500/20 transition"></div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Total Transaksi
                </p>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  {stats?.totalExpensesCount ?? 0}
                </h3>
              </div>
              <div className="h-12 w-12 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs text-slate-400 space-x-1">
              <Calendar className="h-3.5 w-3.5 text-pink-400" />
              <span>Catatan riwayat finansial</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex space-x-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800 w-fit">
            <button
              onClick={() => setActiveTab("expenses")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
                activeTab === "expenses"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Wallet className="h-4 w-4" />
              <span>Pengeluaran ({expenses.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("todos")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
                activeTab === "todos"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <CheckSquare className="h-4 w-4" />
              <span>Daftar Tugas ({todos.length})</span>
            </button>
          </div>

          <div className="flex w-full max-w-md gap-2">
            {activeTab === "expenses" && (
              <select
                value={selectedExpenseCategory}
                onChange={(e) => setSelectedExpenseCategory(e.target.value)}
                className="min-w-0 flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
                aria-label="Filter kategori pengeluaran"
              >
                <option value="">Semua kategori</option>
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Cari kata kunci..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm">Memuat data dari database...</p>
          </div>
        ) : activeTab === "expenses" ? (
          /* Expenses Table */
          <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
            {filteredExpenses.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Wallet className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-base font-medium text-slate-400">Tidak ada pengeluaran ditemukan</p>
                <p className="text-xs text-slate-500 mt-1">Coba tambah transaksi baru atau ubah pencarian</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900/90 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">No</th>
                      <th className="px-6 py-4">Deskripsi / Barang</th>
                      <th className="px-6 py-4">Kategori</th>
                      <th className="px-6 py-4">WhatsApp ID</th>
                      <th className="px-6 py-4">Tanggal</th>
                      <th className="px-6 py-4 text-right">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredExpenses.map((expense, idx) => (
                      <tr key={expense.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{idx + 1}</td>
                        <td className="px-6 py-4 font-semibold text-slate-100">{expense.description}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            <Tag className="h-3 w-3 mr-1 text-indigo-400" />
                            {expense.category || "Umum"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">
                          <div className="flex items-center space-x-1.5">
                            <User className="h-3.5 w-3.5 text-slate-500" />
                            <span>{expense.whatsapp_id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">{formatDate(expense.created_at)}</td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-400 font-mono text-base">
                          {formatIDR(expense.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Todos Grid */
          <div>
            {filteredTodos.length === 0 ? (
              <div className="glass-panel rounded-2xl py-16 text-center text-slate-500">
                <CheckSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-base font-medium text-slate-400">Tidak ada daftar tugas</p>
                <p className="text-xs text-slate-500 mt-1">Tambahkan tugas baru untuk mulai mencatat</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTodos.map((todo) => (
                  <div
                    key={todo.code}
                    className="glass-card rounded-2xl p-5 flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          #{todo.code}
                        </span>
                        <button
                          onClick={() => handleDeleteTodo(todo.code)}
                          title="Hapus Tugas"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-slate-100 font-medium leading-relaxed">{todo.text}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono">{todo.whatsapp_id}</span>
                      <span>{formatDate(todo.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 border border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center space-x-2">
              <Wallet className="h-5 w-5 text-indigo-400" />
              <span>Tambah Pengeluaran Baru</span>
            </h3>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nama Barang / Deskripsi</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kopi Latte, Bensin"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Jumlah (Rp)</label>
                <input
                  type="number"
                  required
                  placeholder="25000"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Todo Modal */}
      {isTodoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card rounded-2xl max-w-md w-full p-6 border border-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center space-x-2">
              <CheckSquare className="h-5 w-5 text-indigo-400" />
              <span>Tambah Tugas Baru</span>
            </h3>

            <form onSubmit={handleAddTodo} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Isi Tugas</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Contoh: Beli susu UHT di supermarket"
                  value={todoForm.text}
                  onChange={(e) => setTodoForm({ ...todoForm, text: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTodoModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30"
                >
                  Simpan Tugas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
