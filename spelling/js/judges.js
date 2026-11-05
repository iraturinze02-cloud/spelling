
let editingJudgeId = null;

const API_URL = "/api";

let allJudges = [];
let activeCompetitionId = null;

/* =====================
   INITIAL LOAD
===================== */

document.addEventListener("DOMContentLoaded", async () => {
    await loadJudges();
    await loadJudgeAssignments();
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

    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="3">Loading judges...</td>
        </tr>
    `;

    try {

        const data = await apiRequest("listJudgeAccounts");

        allJudges = Array.isArray(data.judges)
            ? data.judges
            : [];

        if (allJudges.length === 0) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="3">No judges found</td>
                </tr>
            `;

        } else {

            tbody.innerHTML = "";

            allJudges.forEach(judge => {

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

                row.append(nameCell, usernameCell, actionCell);

                tbody.appendChild(row);
            });
        }

    } catch (err) {

        console.error("Failed to load judges:", err);

        tbody.innerHTML = `
            <tr>
                <td colspan="3">${escapeHTML(err.message)}</td>
            </tr>
        `;
    }
}

/* =====================
   LOAD ACTIVE COMPETITION
   AND EXISTING ASSIGNMENTS
===================== */

async function loadJudgeAssignments() {

    const competitionName =
        document.getElementById("competitionName");

    const assignmentList =
        document.getElementById("assignmentList");

    const saveButton =
        document.getElementById("saveAssignments");

    if (!competitionName || !assignmentList || !saveButton) {
        return;
    }

    saveButton.disabled = true;

    try {

        // 1. Get active competition.

        const competitionData =
            await apiRequest("getActiveCompetition");

        const competition = competitionData.competition;

        if (!competition) {

            activeCompetitionId = null;

            competitionName.textContent =
                "No active competition found.";

            assignmentList.innerHTML =
                "<p>Activate a competition before assigning judges.</p>";

            return;
        }

        activeCompetitionId = Number(competition.id);

        competitionName.textContent =
            "Active Competition: " + competition.competition_name;

        // 2. Get judges already assigned to this competition.

        const assignedData = await apiRequest(
            "getCompetitionJudges",
            {
                competition_id: activeCompetitionId
            }
        );

        const assignedIds = new Set(
            (assignedData.judges || []).map(
                judge => Number(judge.id)
            )
        );

        // 3. Display all registered judges.

        if (allJudges.length === 0) {

            assignmentList.innerHTML =
                "<p>No registered judges are available.</p>";

            return;
        }

        assignmentList.innerHTML = "";

        allJudges.forEach(judge => {

            const id = Number(judge.id);

            const option = document.createElement("div");
            option.className = "judge-option";

            const checkbox = document.createElement("input");

            checkbox.type = "checkbox";
            checkbox.className = "judge-assignment";
            checkbox.value = id;
            checkbox.id = "assign-judge-" + id;

            checkbox.checked = assignedIds.has(id);

            const label = document.createElement("label");

            label.htmlFor = checkbox.id;

            label.textContent =
                `${judge.full_name} (${judge.username})`;

            option.append(checkbox, label);

            assignmentList.appendChild(option);
        });

        saveButton.disabled = false;

    } catch (err) {

        console.error("Assignment loading error:", err);

        assignmentList.innerHTML =
            `<p style="color:red">${escapeHTML(err.message)}</p>`;

        competitionName.textContent =
            "Could not load competition information.";

        saveButton.disabled = true;
    }
}

/* =====================
   SAVE COMPETITION JUDGES
===================== */

async function saveJudgeAssignments() {

    if (!activeCompetitionId) {
        showMessage("No active competition found.", "error");
        return;
    }

    const selectedJudges = Array.from(
        document.querySelectorAll(".judge-assignment:checked")
    ).map(checkbox => Number(checkbox.value));

    if (selectedJudges.length === 0) {

        if (!confirm(
            "You have selected no judges. This will remove all current assignments. Continue?"
        )) {
            return;
        }

    }

    const button =
        document.getElementById("saveAssignments");

    button.disabled = true;
    button.textContent = "Saving assignments...";

    try {

        const result = await apiRequest(
            "saveCompetitionJudges",
            {
                competition_id: activeCompetitionId,
                judges: selectedJudges
            }
        );

        showMessage(
            `${result.saved_count} judge(s) assigned successfully.`
        );

        // Reload assignments to confirm saved selections.
        await loadJudgeAssignments();

    } catch (err) {

        console.error("Assignment saving error:", err);

        showMessage(
            err.message || "Could not save judge assignments.",
            "error"
        );

    } finally {

        button.disabled = false;
        button.textContent = "Save Judge Assignments";
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

    const full_name =
        document.getElementById("fullName").value.trim();

    const username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value;

    if (!full_name || !username) {
        showMessage("Name and username are required.", "error");
        return;
    }

    if (editingJudgeId === null && !password) {
        showMessage("Password is required for a new judge.", "error");
        return;
    }

    const saveButton = document.querySelector(".save");

    if (!saveButton) return;

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
        await loadJudgeAssignments();

        showMessage(
            isEditing
                ? "Judge updated successfully."
                : "Judge added successfully."
        );

    } catch (err) {

        console.error("Error saving judge:", err);

        showMessage(err.message, "error");

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
        await loadJudgeAssignments();

        showMessage("Judge deleted successfully.");

    } catch (err) {

        console.error("Error deleting judge:", err);

        showMessage(err.message, "error");
    }
}

/* =====================
   BACK HOME
===================== */

function goHome() {
    window.location.href = "teacher-home.html";
}
