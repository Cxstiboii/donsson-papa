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
};

export const referenciasApi = {
  list: (mes) => request(`/referencias${mes ? `?mes=${encodeURIComponent(mes)}` : ""}`),
  create: (data) => request("/referencias", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/referencias/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => request(`/referencias/${id}`, { method: "DELETE" }),
};

export const parametrosApi = {
  get: () => request("/parametros"),
  update: (data) => request("/parametros", { method: "PUT", body: JSON.stringify(data) }),
};

export function calcCostos(ref, params) {
  const mpd = (ref.consumos || []).reduce((s, c) => {
    return s + (c.material?.costo || 0) * (c.cantidad || 0);
  }, 0);
  const mod = (params.tarifaMOD || 0) * (ref.hMOD || 0);
  const cif = (params.tarifaCIF || 0) * (ref.hCIF || 0);
  const costoProd = mpd + mod + cif;
  const costoTotal = costoProd * (1 + (params.pctGAV || 0) / 100);
  const divisorMargen = 1 - (params.pctMargen || 0) / 100;
  const precioVenta = divisorMargen > 0 ? costoTotal / divisorMargen : costoTotal;
  const costoReal = ref.costoReal || 0;
  const variacion = costoReal > 0 ? ((costoProd - costoReal) / costoReal) * 100 : null;
  return {
    mpd,
    mod,
    cif,
    costoProd,
    costoTotal,
    precioVenta,
    margenBruto: precioVenta - costoProd,
    costoReal,
    variacion,
  };
}

export const COP = (v) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(v || 0);

export const mesLabel = (ym) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  const n = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${n[+m - 1]} ${y}`;
};

export const UNIDADES = [
  "unidad", "m²", "kg", "litro", "juego", "metro", "rollo",
  "cm", "mm", "gramo", "par", "set", "lámina", "tubo", "varilla",
];

export const COLORS = {
  azulOscuro: "#1F3864",
  azulMedio: "#2E75B6",
  azulClaro: "#D6E4F0",
  verdeOscuro: "#065F46",
  verdeClaro: "#D1FAE5",
  amberTexto: "#92400E",
  amberFondo: "#FEF3C7",
  rojoTexto: "#991B1B",
  rojoFondo: "#FEE2E2",
  gris: "#F1F5F9",
  blanco: "#FFFFFF",
};
