// =====================================
// GLOBAL API HELPER
// Cloudflare Pages Function API
// Sends the signed session created by /spellingLogin.
// =====================================

async function api(data) {
  try {
    const token = localStorage.getItem("auth_token");

    const headers = {
      "Content-Type": "application/json"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch("/api", {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");

      if (
        !location.pathname.endsWith("/index.html") &&
        location.pathname !== "/"
      ) {
        location.href = "/index.html";
      }

      return null;
    }

    if (!response.ok) {
      console.error("API ERROR:", result);

      alert(
        result.error ||
        result.message ||
        "Request failed"
      );

      return null;
    }

    return result;

  } catch (error) {
    console.error("NETWORK ERROR:", error);

    alert(
      "Network error. Please check your connection."
    );

    return null;
  }
}
