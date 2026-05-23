let editingJudgeId = null;

document.addEventListener("DOMContentLoaded", () => {
  loadJudges();
});

/* =====================
LOAD ALL JUDGES
===================== */
async function loadJudges() {
  try {
    const res = await fetch("/.netlify/functions/judges");
    const data = await res.json();

    const tbody = document.getElementById("judgeList");

    if (!data.judges || data.judges.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3">No judges found</td></tr>`;
      return;
    }

    tbody.innerHTML = "";

    data.judges.forEach(judge => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${judge.full_name}</td>
        <td>${judge.username}</td>
        <td>
          <button class="edit" onclick="openEditModal(${judge.id}, '${judge.full_name}', '${judge.username}')">
            Edit
          </button>
          <button class="delete" onclick="deleteJudge(${judge.id})">
            Delete
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });

  } catch (err) {
    console.error(err);
    alert("Failed to load judges");
  }
}

/* =====================
OPEN ADD MODAL
===================== */
function openAddModal() {
  editingJudgeId = null;

  document.getElementById("modalTitle").innerText = "Add Judge";

  document.getElementById("fullName").value = "";
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";

  document.getElementById("judgeModal").style.display = "flex";
}

/* =====================
OPEN EDIT MODAL
===================== */
function openEditModal(id, name, username) {
  editingJudgeId = id;

  document.getElementById("modalTitle").innerText = "Edit Judge";

  document.getElementById("fullName").value = name;
  document.getElementById("username").value = username;
  document.getElementById("password").value = "";

  document.getElementById("judgeModal").style.display = "flex";
}

/* =====================
CLOSE MODAL
===================== */
function closeModal() {
  document.getElementById("judgeModal").style.display = "none";
}

/* =====================
SAVE (ADD OR UPDATE)
===================== */
async function saveJudge() {
  const full_name = document.getElementById("fullName").value.trim();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!full_name || !username) {
    alert("Name and username are required");
    return;
  }

  try {
    let payload;

    if (editingJudgeId) {
      // UPDATE
      payload = {
        action: "update",
        id: editingJudgeId,
        full_name,
        username
      };

      if (password) {
        payload.password = password;
      }

    } else {
      // ADD
      if (!password) {
        alert("Password is required");
        return;
      }

      payload = {
        action: "add",
        full_name,
        username,
        password
      };
    }

    const res = await fetch("/.netlify/functions/judges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      alert("Operation failed");
      return;
    }

    closeModal();
    loadJudges();

  } catch (err) {
    console.error(err);
    alert("Error saving judge");
  }
}

/* =====================
DELETE JUDGE
===================== */
async function deleteJudge(id) {
  if (!confirm("Delete this judge?")) return;

  try {
    const res = await fetch("/.netlify/functions/judges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        id
      })
    });

    const data = await res.json();

    if (!data.success) {
      alert("Delete failed");
      return;
    }

    loadJudges();

  } catch (err) {
    console.error(err);
    alert("Error deleting judge");
  }
}

/* =====================
BACK HOME
===================== */
function goHome() {
  window.location.href = "index.html";
    }
