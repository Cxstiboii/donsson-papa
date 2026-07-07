const TOKEN_KEY = "donsoon_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error("Sesión expirada");
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Error en la solicitud");
  }
  return data;
}

export const authApi = {
  status: () => request("/auth/status"),
  login: (password) => request("/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  setup: (password) => request("/auth/setup", { method: "POST", body: JSON.stringify({ password }) }),
};

export const materialesApi = {
  list: () => request("/materiales"),
  create: (data) => request("/materiales", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/materiales/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => request(`/materiales/${id}`, { method: "DELETE" }),
  rename: (id, data) =>
    request(`/materiales/${id}/rename`, { method: "PATCH", body: JSON.stringify(data) }),
  importarCSV: async (file) => {
    const token = getToken();
    const form = new FormData();
    form.append("archivo", file);
    const res = await fetch("/api/materiales/importar-csv", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (res.status === 401) { clearToken(); window.location.reload(); throw new Error("Sesión expirada"); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Error en la solicitud");
    return data;
  },
};

export const referenciasApi = {
  list: (mes) => request(`/referencias${mes ? `?mes=${encodeURIComponent(mes)}` : ""}`),
  create: (data) => request("/referencias", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/referencias/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => request(`/referencias/${id}`, { method: "DELETE" }),
  eliminarOrdenesMes: (id, mes) =>
    request(`/referencias/${id}/ordenes/${encodeURIComponent(mes)}`, { method: "DELETE" }),
  updateCostoReal: (id, costoReal) =>
    request(`/referencias/${id}/costoReal`, {
      method: "PATCH",
      body: JSON.stringify({ costoReal }),
    }),
  variacion: (id, mes) =>
    request(`/referencias/${id}/variacion${mes ? `?mes=${encodeURIComponent(mes)}` : ""}`),
  optimo: (id) => request(`/referencias/${id}/optimo`),
  guardarOptimoLinea: (id, materialId, cantidad) =>
    request(`/referencias/${id}/optimo/${materialId}`, {
      method: "PUT",
      body: JSON.stringify({ cantidad }),
    }),
  eliminarOptimoLinea: (id, materialId) =>
    request(`/referencias/${id}/optimo/${materialId}`, { method: "DELETE" }),
};

export const parametrosApi = {
  get: () => request("/parametros"),
  update: (data) => request("/parametros", { method: "PUT", body: JSON.stringify(data) }),
};

export const costosApi = {
  list: () => request("/importar-costos"),
  get: (id) => request(`/importar-costos/${id}`),
  remove: (id) => request(`/importar-costos/${id}`, { method: "DELETE" }),
};

