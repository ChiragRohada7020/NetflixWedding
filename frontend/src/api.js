const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "";

export function apiUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path || "";
  if (!path.startsWith("/api")) return path;
  return `${API_BASE}${path}`;
}

export function mediaUrl(path) {
  if (!path || /^https?:\/\//i.test(path) || path.startsWith("data:")) return path || "";
  if (path.startsWith("/api") || path.startsWith("/static")) return `${API_BASE}${path}`;
  return `${API_BASE}${path}`;
}

function markAuthExpired() {
  localStorage.setItem("wedflix_backend_auth_ok", "0");
  window.dispatchEvent(new Event("wedflix-auth-changed"));
}

async function throwApiError(res, fallbackMessage) {
  if (res.type === "opaqueredirect" || res.status === 0 || res.status === 302 || res.status === 401 || res.status === 403) {
    markAuthExpired();
    throw new Error(fallbackMessage || "Your admin session expired. Please login again.");
  }

  const text = await res.text();
  try {
    const payload = JSON.parse(text);
    throw new Error(payload.error || payload.message || `Request failed: ${res.status}`);
  } catch (err) {
    if (err instanceof SyntaxError) throw new Error(text || `Request failed: ${res.status}`);
    throw err;
  }
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) {
    await throwApiError(res);
  }
  return res.json();
}

export async function apiGetPublic(path) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!res.ok) {
    const text = await res.text();
    try {
      const payload = JSON.parse(text);
      const error = new Error(payload.error || payload.message || `Request failed: ${res.status}`);
      error.status = res.status;
      throw error;
    } catch (err) {
      if (err instanceof SyntaxError) {
        const error = new Error(text || `Request failed: ${res.status}`);
        error.status = res.status;
        throw error;
      }
      throw err;
    }
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
    await throwApiError(res);
  }
  return res.json();
}

export async function apiPatch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Wedflix-Fetch": "1" },
    credentials: "include",
    body: JSON.stringify(body),
    redirect: "manual",
  });
  if (!res.ok) {
    await throwApiError(res, "Your admin session expired. Please login again, then edit.");
  }
  return res.json();
}

export async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { "X-Wedflix-Fetch": "1" },
    credentials: "include",
    redirect: "manual",
  });
  if (!res.ok) {
    await throwApiError(res, "Your admin session expired. Please login again, then delete.");
  }
  return res.json();
}

export async function apiPostForm(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "X-Wedflix-Fetch": "1" },
    credentials: "include",
    body: formData,
    redirect: "manual",
  });
  if (res.type === "opaqueredirect" || res.status === 0 || res.status === 302) {
    markAuthExpired();
    throw new Error("Your admin session expired. Please login again, then save.");
  }
  if (res.status === 401 || res.status === 403) {
    markAuthExpired();
    throw new Error("Your admin session expired. Please login again, then save.");
  }
  if (!res.ok) {
    await throwApiError(res);
  }
  return res;
}

export async function apiPostFormJson(path, formData) {
  const res = await apiPostForm(path, formData);
  return res.json();
}
