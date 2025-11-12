// ====== Config ======
const API_BASE = "https://shadowgatebackend-production.up.railway.app/api";

// Compute the "app root" so redirects work no matter how deep we are.
// e.g. .../Shadowgate_Bank/admin/  -> .../Shadowgate_Bank/
function appRootFromAdmin() {
  const p = location.pathname;
  // strip trailing "admin/...":
  const root = p.replace(/\/admin\/.*$/i, "/");
  return root.endsWith("/") ? root : root + "/";
}

// Robust redirect helpers (no hardcoded ../)
function goLogin()  { window.location.href = appRootFromAdmin() + "login/"; }
function goHome()   { window.location.href = appRootFromAdmin(); }

// ====== Auth gate (JWT, admin only) ======
const token = localStorage.getItem("sg_token");
const role  = (localStorage.getItem("sg_role") || "").toLowerCase();
if (!token) goLogin();
if (role !== "admin") goHome();

// ====== DOM ======
const bodyEl    = document.getElementById("users-body");
const emptyEl   = document.getElementById("users-empty");
const errEl     = document.getElementById("err");
const refreshEl = document.getElementById("refresh");
const logoutEl  = document.getElementById("logout");
const whoEl     = document.getElementById("admin-user");

// Show badge
const who = localStorage.getItem("sg_user");
whoEl.textContent = `Role: ${role}${who ? " · " + who : ""}`;

// ====== Small fetch helper (JWT, no cookies) ======
async function api(url, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(opts.headers || {}),
  };
  let res;
  try { res = await fetch(url, { ...opts, headers }); }
  catch { throw new Error("Network error"); }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error((data && (data.detail || data.error)) || `HTTP ${res.status}`);
  return data;
}

// ====== Endpoint autodiscovery ======
// Try both common layouts and cache the working one.
const Candidates = {
  list: [
    `${API_BASE}/admin/users`,
    `${API_BASE}/users`
  ],
  // The action paths are derived from the list winner by replacing the tail.
  makeAdmin: base => id => `${base}/${id}/role`,      // PATCH {role:"admin"}
  resetPw:   base => id => `${base}/${id}/reset-password`, // POST
  deleteUser:base => id => `${base}/${id}`,           // DELETE
};
let USERS_BASE = null; // e.g. "https://.../api/admin/users" or ".../api/users"

async function discoverUsersBase() {
  // Probe in order; first 2xx wins.
  for (const url of Candidates.list) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { USERS_BASE = url; return; }
    } catch { /* ignore and try next */ }
  }
  throw new Error("No admin users endpoint found (tried /api/admin/users and /api/users).");
}

// ====== Render ======
function rowHtml(u) {
  const created = u.created_at ? new Date(u.created_at).toLocaleString() : "";
  return `
    <tr data-id="${u.id}">
      <td>${u.id ?? ""}</td>
      <td>${u.username ?? ""}</td>
      <td>${u.role ?? ""}</td>
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

function render(list) {
  errEl.style.display = "none";
  bodyEl.innerHTML = "";
  if (!Array.isArray(list) || list.length === 0) {
    emptyEl.style.display = "";
    return;
  }
  emptyEl.style.display = "none";
  bodyEl.innerHTML = list.map(rowHtml).join("");
}

// ====== Actions (use discovered base) ======
async function loadUsers() {
  if (!USERS_BASE) await discoverUsersBase();
  const data = await api(USERS_BASE, { method: "GET" });
  render(Array.isArray(data) ? data : (data.users || []));
}

async function promote(id) {
  const url = Candidates.makeAdmin(USERS_BASE)(id);
  await api(url, { method: "PATCH", body: JSON.stringify({ role: "admin" }) });
}

async function demote(id) {
  const url = Candidates.makeAdmin(USERS_BASE)(id);
  await api(url, { method: "PATCH", body: JSON.stringify({ role: "user" }) });
}

async function resetPw(id) {
  const url = Candidates.resetPw(USERS_BASE)(id);
  const data = await api(url, { method: "POST" });
  if (data && data.temp_password) alert(`Temporary password: ${data.temp_password}`);
}

async function deleteUser(id) {
  const url = Candidates.deleteUser(USERS_BASE)(id);
  await api(url, { method: "DELETE" });
}

// ====== Events ======
refreshEl.addEventListener("click", () =>
  loadUsers().catch(e => { errEl.textContent = e.message; errEl.style.display = "block"; })
);

bodyEl.addEventListener("click", async (e) => {
  const btn = e.target.closest(".act");
  if (!btn) return;
  const id  = btn.closest("tr").getAttribute("data-id");
  const act = btn.getAttribute("data-act");
  try {
    if (act === "promote") await promote(id);
    if (act === "demote")  await demote(id);
    if (act === "resetpw") await resetPw(id);
    if (act === "delete")  { if (!confirm("Delete this user?")) return; await deleteUser(id); }
    await loadUsers();
  } catch (err) {
    errEl.textContent = err.message || "Action failed.";
    errEl.style.display = "block";
  }
});

// Logout (always lands on the right login URL)
logoutEl.addEventListener("click", () => {
  localStorage.removeItem("sg_token");
  localStorage.removeItem("sg_role");
  // localStorage.removeItem("sg_user"); // uncomment if you don't want username autofill
  goLogin();
});

// ====== Boot ======
loadUsers().catch(e => { errEl.textContent = e.message; errEl.style.display = "block"; });
