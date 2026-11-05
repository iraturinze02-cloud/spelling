
let editingJudgeId = null;

const API_URL = "/api";

/* =====================
   INITIAL LOAD
===================== */

document.addEventListener("DOMContentLoaded", () => {
    loadJudges();
});

/* =====================
   API REQUEST
===================== */

async function apiRequest(action, details = {}) {

    const token = localStorage.getItem("auth_token");

    const res = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + (token || "")
        },
        body: JSON.stringify({
            action,
            ...details
        })
    });

    const responseText = await res.text();

    let data;

    try {
        data = JSON.parse(responseText);
    } catch {
        console.error("Invalid API response:", responseText);
        throw new Error("The server returned an invalid response.");
    }

    if (!res.ok || data.success === false) {
        throw new Error(
            data.error ||
            data.message ||
            `Request failed (${res.status}).`
        );
    }

    return data;
}

/* =====================
   SAFE HTML TEXT
===================== */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

/* =====================
   MESSAGE DISPLAY
===================== */

function showMessage(message, type = "success") {

    let box = document.getElementById("judgeMessage");

    if (!box) {
        box = document.createElement("div");
        box.id = "judgeMessage";

        Object.assign(box.style, {
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: "99999",
            padding: "12px 18px",
            borderRadius: "8px",
            color: "#fff",
            fontSize: "14px",
            maxWidth: "90%",
            boxShadow: "0 3px 12px rgba(0,0,0,0.2)"
        });

        document.body.appendChild(box);
    }

    box.style.background =
        type === "error" ? "#dc3545" : "#198754";

    box.textContent = message;
    box.style.display = "block";

    clearTimeout(box.hideTimer);

    box.hideTimer = setTimeout(() => {
        box.style.display = "none";
    }, 3500);
}

/* =====================
   LOAD ALL JUDGES
===================== */

async function loadJudges() {

    const tbody = document.getElementById("judgeList");

    if (!tbody) {
        console.error("Element judgeList was not found.");
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td colspan="3">Loading judges...</td>
        </tr>
    `;

    try {

        const data = await apiRequest("listJudgeAccounts");

        const judges = Array.isArray(data.judges)
            ? data.judges
            : [];

        if (judges.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3">No judges found</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = "";

        judges.forEach(judge => {

            const row = document.createElement("tr");

            const nameCell = document.createElement("td");
            nameCell.textContent = judge.full_name || "";

            const usernameCell = document.createElement("td");
            usernameCell.textContent = judge.username || "";

            const actionCell = document.createElement("td");

            const editButton = document.createElement("button");

            editButton.type = "button";
            editButton.className = "edit";
            editButton.textContent = "Edit";

            editButton.addEventListener("click", () => {
                openEditModal(
                    Number(judge.id),
                    judge.full_name,
                    judge.username
                );
            });

            const deleteButton = document.createElement("button");

            deleteButton.type = "button";
            deleteButton.className = "delete";
            deleteButton.textContent = "Delete";

            deleteButton.addEventListener("click", () => {
                deleteJudge(Number(judge.id));
            });

            actionCell.append(editButton, deleteButton);

            row.append(
                nameCell,
                usernameCell,
                actionCell
            );

            tbody.appendChild(row);
        });

    } catch (err) {

        console.error("Failed to load judges:", err);

        tbody.innerHTML = `
            <tr>
                <td colspan="3">
                    ${escapeHTML(err.message)}
                </td>
            </tr>
        `;
    }
}

/* =====================
   OPEN ADD MODAL
===================== */

function openAddModal() {

    editingJudgeId = null;

    document.getElementById("modalTitle").textContent = "Add Judge";

    document.getElementById("fullName").value = "";
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";

    document.getElementById("password").required = true;

    document.getElementById("judgeModal").style.display = "flex";
}

/* =====================
   OPEN EDIT MODAL
===================== */

function openEditModal(id, name, username) {

    editingJudgeId = Number(id);

    document.getElementById("modalTitle").textContent = "Edit Judge";

    document.getElementById("fullName").value = name || "";
    document.getElementById("username").value = username || "";
    document.getElementById("password").value = "";

    // Blank password means keep the existing password.
    document.getElementById("password").required = false;

    document.getElementById("judgeModal").style.display = "flex";
}

/* =====================
   CLOSE MODAL
===================== */

function closeModal() {

    document.getElementById("judgeModal").style.display = "none";
}

/* =====================
   SAVE JUDGE
===================== */

async function saveJudge() {

    const full_name = document
        .getElementById("fullName")
        .value.trim();

    const username = document
        .getElementById("username")
        .value.trim();

    const password = document
        .getElementById("password")
        .value;

    if (!full_name || !username) {
        showMessage("Name and username are required.", "error");
        return;
    }

    if (editingJudgeId === null && !password) {
        showMessage("Password is required for a new judge.", "error");
        return;
    }

    const saveButton = document.querySelector(".save");

    if (!saveButton) {
        showMessage("Save button was not found.", "error");
        return;
    }

    const isEditing = editingJudgeId !== null;

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {

        if (isEditing) {

            const details = {
                id: editingJudgeId,
                full_name,
                username
            };

            if (password) {
                details.password = password;
            }

            await apiRequest("updateJudge", details);

        } else {

            await apiRequest("addJudge", {
                full_name,
                username,
                password
            });
        }

        closeModal();

        await loadJudges();

        showMessage(
            isEditing
                ? "Judge updated successfully."
                : "Judge added successfully."
        );

    } catch (err) {

        console.error("Error saving judge:", err);

        showMessage(
            err.message || "Error saving judge.",
            "error"
        );

    } finally {

        saveButton.disabled = false;
        saveButton.textContent = "Save Judge";
    }
}

/* =====================
   DELETE JUDGE
===================== */

async function deleteJudge(id) {

    if (!confirm("Delete this judge?")) {
        return;
    }

    try {

        await apiRequest("deleteJudge", { id });

        await loadJudges();

        showMessage("Judge deleted successfully.");

    } catch (err) {

        console.error("Error deleting judge:", err);

        showMessage(
            err.message || "Error deleting judge.",
            "error"
        );
    }
}

/* =====================
   BACK HOME
===================== */

function goHome() {
    window.location.href = "teacher-home.html";
}
