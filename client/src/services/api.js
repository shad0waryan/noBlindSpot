import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("nbs_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("nbs_token");
      localStorage.removeItem("nbs_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────
export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login:    (data) => api.post("/auth/login", data),
  getMe:    ()     => api.get("/auth/me"),
};

// ── Maps ─────────────────────────────────────
export const mapsAPI = {
  generate:    (topic)        => api.post("/maps/generate", { topic }),
  getAll:      ()             => api.get("/maps"),
  getById:     (id)           => api.get(`/maps/${id}`),
  updateNodes: (id, nodes)    => api.patch(`/maps/${id}/nodes`, { nodes }),
  delete:      (id)           => api.delete(`/maps/${id}`),
};

export default api;
