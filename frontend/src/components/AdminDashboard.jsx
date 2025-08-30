import React, { useEffect, useState } from "react";
import axios from "axios";
import "./AdminDashboard.css";
import { useNavigate } from "react-router-dom";

// Inside the component

const LIMIT = 5;

export default function AdminDashboard() {
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
  const token = localStorage.getItem("admintoken");
  const [transactions, setTransactions] = useState([]);

const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  const [summary, setSummary] = useState({
    totalDeposit: 0,
    totalWithdraw: 0,
    totalTransactions: 0,
  });

  const [users, setUsers] = useState([]);
  const [totalClients, setTotalClients] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [form, setForm] = useState({
    username: "",
    phoneNumber: "",
    role: "client",
    password: "",
  });
  const [formMsg, setFormMsg] = useState("");

  const authHeader = { Authorization: `Bearer ${token}` };

  const fetchSummary = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/admin-api/transactions-list`, { headers: authHeader });
      setSummary({
        totalDeposit: data?.totalDeposit ?? 0,
        totalWithdraw: data?.totalWithdraw ?? 0,
        totalTransactions: data?.totalTransactions ?? 0,
      });
    } catch (err) { console.error(err); }
  };
const fetchUsers = async (p = 1) => {
  try {
    const { data } = await axios.get(
      `${BACKEND_URL}/admin-api/users?page=${p}&limit=${LIMIT}`,
      { headers: authHeader }
    );

    setUsers(Array.isArray(data.users) ? data.users : []);
    setTotalClients(data.totalUsers ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setPage(data.currentPage ?? p);
  } catch (err) {
    console.error(err);
    setUsers([]);
    setTotalClients(0);
  }
};


  const loadAll = async (p = 1) => {
    setLoading(true); setErrMsg("");
    await Promise.all([fetchSummary(), fetchUsers(p)]);
    setLoading(false);
  };


useEffect(() => {
  axios.get(`${BACKEND_URL}/admin-api/transactions-list`, { headers: authHeader })
    .then(res => setTransactions(res.data))
    .catch(err => console.error("Error fetching transactions", err));
}, []);
  useEffect(() => { loadAll(page); }, []);

  const onChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); };

  const onRegister = async (e) => {
    e.preventDefault(); setFormMsg("");
    try {
      const payload = form.role === "admin" ? form : { username: form.username, phoneNumber: form.phoneNumber, role: "client" };
      const { data } = await axios.post(`${BACKEND_URL}/admin-api/register-user`, payload, { headers: authHeader });
      setFormMsg(data?.message || "User registered");
      setForm({ username: "", phoneNumber: "", role: "client", password: "" });
      await Promise.all([fetchUsers(page), fetchSummary()]);
    } catch (err) { console.error(err); setFormMsg(err?.response?.data?.message || "Registration error"); }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    try { await axios.delete(`${BACKEND_URL}/admin-api/delete-user/${id}`, { headers: authHeader }); await Promise.all([fetchUsers(page), fetchSummary()]); } 
    catch (err) { console.error(err); alert(err?.response?.data?.message || "Delete failed"); }
  };

  const gotoPage = async (p) => { if (p < 1 || p > totalPages) return; await fetchUsers(p); };
const handleLogout = () => {
  localStorage.removeItem("admintoken"); // remove admin token
  navigate("/Logins"); // redirect to login page
};
  if (loading) return <div className="admin-container">Loading…</div>;
  if (errMsg) return <div className="admin-container" style={{ color: "red" }}>{errMsg}</div>;

  return (
    <div className="admin-container">
      <h1>Admin Dashboard</h1>
<div className="admin-header">
  <h1>Admin Dashboard</h1>
  <button className="logout-btn" onClick={handleLogout}>Logout</button>
</div>
      {/* Summary */}
      <section className="summary-grid">
        <div className="summary-card">
          <div className="label">Total Deposits</div>
          <div className="value">{summary.totalDeposit}</div>
        </div>
        <div className="summary-card">
          <div className="label">Total Withdrawals</div>
          <div className="value">{summary.totalWithdraw}</div>
        </div>
        <div className="summary-card">
          <div className="label">Total Transactions</div>
          <div className="value">{summary.totalTransactions}</div>
        </div>
        <div className="summary-card">
          <div className="label">Total Clients</div>
          <div className="value">{totalClients}</div>
        </div>
      </section>

      {/* Registration */}
      <section>
        <h2>Register User</h2>
        <form className="register-form" onSubmit={onRegister}>
          <input name="username" placeholder="Username" value={form.username} onChange={onChange} required />
          <input name="phoneNumber" placeholder="Phone Number" value={form.phoneNumber} onChange={onChange} required />
          <select name="role" value={form.role} onChange={onChange}>
            <option value="client">Client</option>
            <option value="admin">Admin</option>
          </select>
          {form.role === "admin" && <input name="password" type="password" placeholder="Admin Password" value={form.password} onChange={onChange} required />}
          <button type="submit">Register</button>
        </form>
        {formMsg && <p>{formMsg}</p>}
      </section>

      {/* Users table */}
      <section>
        <h2>Users</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="users-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Phone Number</th>
                <th>Role</th>
                <th>Wallet</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? users.map((u) => (
                <tr key={u._id}>
                  <td>{u.username}</td>
                  <td>{u.phoneNumber}</td>
                  <td>{u.role}</td>
                  <td>{u.Wallet}</td>
                  <td><button className="delete-btn" onClick={() => onDelete(u._id)}>Delete</button></td>
                </tr>
              )) : (
                <tr><td colSpan="5" style={{ textAlign: "center" }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => gotoPage(page - 1)}>Prev</button>
          <span className="current-page">Page {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => gotoPage(page + 1)}>Next</button>
          {[...Array(totalPages)].map((_, i) => (
            <button key={i} onClick={() => gotoPage(i + 1)} style={{ fontWeight: page === i + 1 ? "bold" : "normal" }}>{i + 1}</button>
          ))}
        </div>
      </section>
      <section>
  <h2>Recent Transactions</h2>
  <table className="users-table">
    <thead>
      <tr>
        <th>Transaction #</th>
        <th>Type</th>
        <th>Amount</th>
        <th>Message</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      {transactions.length ? transactions.map((t) => (
        <tr key={t._id}>
          <td>{t.transactionNumber}</td>
          <td>{t.type}</td>
          <td>{t.amount}</td>
          <td>{t.rawMessage}</td>
          <td>{new Date(t.createdAt).toLocaleString()}</td>
        </tr>
      )) : (
        <tr><td colSpan="5" style={{ textAlign: "center" }}>No transactions yet</td></tr>
      )}
    </tbody>
  </table>
</section>
    </div>
  );
}
