const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "";

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function apiPostForm(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
    redirect: "follow",
  });
  if (res.redirected && res.url.includes("/auth/login")) {
    localStorage.setItem("wedflix_backend_auth_ok", "0");
    window.dispatchEvent(new Event("wedflix-auth-changed"));
    throw new Error("Your admin session expired. Please login again, then save.");
  }
  if (res.status === 401 || res.status === 403) {
    localStorage.setItem("wedflix_backend_auth_ok", "0");
    window.dispatchEvent(new Event("wedflix-auth-changed"));
    throw new Error("Your admin session expired. Please login again, then save.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res;
}
