// Config
const API_BASE = "/api"; // change to your API origin if hosted elsewhere

// Simple auth gate
const token = localStorage.getItem("sg_token");
const role = (localStorage.getItem("sg_role") || "").toLowerCase();
if (!token || role !== "admin") {
  window.location.href = "/login/index.html";
}

// Elements
const bodyEl = document.getElementById("users-body");
const emptyEl = document.getElementById("users-empty");
const errEl = document.getElementById("err");
const refreshBtn = document.getElementById("refresh");
const adminUser = document.getElementById("admin-user");
const logoutBtn = document.getElementById("logout");

adminUser.textContent = `Role: ${role}`;

// Helpers
async function api(path, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(opts.headers || {})
  };
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers, credentials: "include" });
  let data = null;
  try { data = await res.json(); } catch(_) {}
  if (!res.ok) throw new Error((data && (data.detail || data.error)) || `HTTP ${res.status}`);
  return data;
}

function rowHtml(u) {
  const created = u.created_at ? new Date(u.created_at).toLocaleString() : "";
  return `
    <tr data-id="${u.id}">
      <td>${u.id}</td>
      <td>${u.username}</td>
      <td>${u.role}</td>
      <td>${u.ingame_username || ""}</td>
      <td>${u.company_code || ""}</td>
      <td>${created}</td>
      <td>
        <button class="act btn" data-act="promote">Promote→admin</button>
        <button class="act btn" data-act="demote">Demote→user</button>
        <button class="act btn" data-act="resetpw">Reset PW</button>
        <button class="act btn" data-act="delete" style="background:#ef4444;color:#fff;">Delete</button>
      </td>
    </tr>`;
}

function renderUsers(list) {
  errEl.style.display = "none";
  bodyEl.innerHTML = "";
  if (!list || list.length === 0) {
    emptyEl.style.display = "";
    return;
  }
  emptyEl.style.display = "none";
  bodyEl.innerHTML = list.map(rowHtml).join("");
}

// Actions → backend endpoints (adjust names to your API)
async function loadUsers() {
  const data = await api("/admin/users"); // GET -> [{...}]
  renderUsers(data.users || data || []);
}

async function promote(id) {
  await api(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role: "admin" }) });
}
async function demote(id) {
  await api(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role: "user" }) });
}
async function resetPw(id) {
  // backend returns { temp_password: "xxxx" } or 204
  const data = await api(`/admin/users/${id}/reset-password`, { method: "POST" });
  if (data && data.temp_password) {
    alert(`Temporary password: ${data.temp_password}`);
  }
}
async function delUser(id) {
  await api(`/admin/users/${id}`, { method: "DELETE" });
}

// Event wiring
refreshBtn.addEventListener("click", async () => {
  try { await loadUsers(); } catch(e){ errEl.textContent = e.message; errEl.style.display="block"; }
});

bodyEl.addEventListener("click", async (e) => {
  const btn = e.target.closest(".act");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr.getAttribute("data-id");
  const act = btn.getAttribute("data-act");
  try {
    if (act === "promote") await promote(id);
    if (act === "demote") await demote(id);
    if (act === "resetpw") await resetPw(id);
    if (act === "delete") {
      if (!confirm("Delete this user?")) return;
      await delUser(id);
    }
    await loadUsers();
  } catch (e2) {
    errEl.textContent = e2.message;
    errEl.style.display = "block";
  }
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("sg_token");
  localStorage.removeItem("sg_role");
  window.location.href = "/login/index.html";
});

// Initial load
loadUsers().catch(e => { errEl.textContent = e.message; errEl.style.display="block"; });
