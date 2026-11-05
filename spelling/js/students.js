
let editing = false;
let competition = null;
let stages = [];

/* ===============================
INITIAL LOAD
=============================== */

window.onload = async () => {

    const competitionLoaded = await loadCompetition();

    if (!competitionLoaded) return;

    await loadStages();

    await loadStudents();

};

/* ===============================
API HELPER
=============================== */

async function apiRequest(payload) {

    const token = localStorage.getItem("auth_token");

    const res = await fetch("/api", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + (token || "")
        },
        body: JSON.stringify(payload)
    });

    const text = await res.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`Invalid server response (${res.status}).`);
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
/* ===============================
LOAD ACTIVE COMPETITION
=============================== */

async function loadCompetition() {

    try {

        // GET SELECTED COMPETITION ID
        const selectedId =
            localStorage.getItem("competitionId") ||
            localStorage.getItem("competition_id");

        if (!selectedId) {

            document.getElementById("competitionName").innerText =
                "No Competition Selected";

            console.error("No competition ID found in localStorage.");

            return false;
        }

        // LOAD ALL COMPETITIONS
        const data = await apiRequest({
            action: "getCompetitions"
        });

        const competitions = data.competitions || [];

        // FIND SELECTED COMPETITION
        competition = competitions.find(
            comp => Number(comp.id) === Number(selectedId)
        ) || null;

        if (!competition) {

            document.getElementById("competitionName").innerText =
                "Selected Competition Not Found";

            console.error("Selected competition ID:", selectedId);

            return false;
        }

        // KEEP BOTH STORAGE KEYS SYNCHRONIZED
        localStorage.setItem(
            "competitionId",
            String(competition.id)
        );

        localStorage.setItem(
            "competition_id",
            String(competition.id)
        );

        document.getElementById("competitionName").innerText =
            competition.competition_name;

        console.log("Selected competition:", competition);

        return true;

    } catch (error) {

        console.error("Competition error:", error);

        alert("Could not load competition: " + error.message);

        return false;
    }
}
/* ===============================
LOAD STAGES
=============================== */

async function loadStages() {
  stages = [];

  try {
    if (!competition) {
      return;
    }

    const data = await apiRequest({
      action: "getStagesByCompetition",
      competition_id: Number(competition.id)
    });

    stages = data.stages || [];

  } catch (error) {
    console.error("Stages error:", error);
    alert("Could not load competition stages: " + error.message);
  }
}

/* ===============================
GET ACTIVE STAGE
=============================== */

function getActiveStage() {
  return stages.find(
    stage => String(stage.status).toLowerCase() === "active"
  ) || stages[0] || null;
}

/* ===============================
LOAD STUDENTS
=============================== */

async function loadStudents() {
  const list = document.getElementById("list");

  try {
    const competitionId = Number(
      localStorage.getItem("competition_id")
    );

    const activeStage = getActiveStage();

    if (!competitionId || !activeStage) {
      if (list) {
        list.innerHTML = `
          <tr>
            <td colspan="4">
              No active competition or stage selected.
            </td>
          </tr>
        `;
      }
      return;
    }

    const data = await apiRequest({
      action: "getStudents",
      competition_id: competitionId,
      stage_number: Number(activeStage.stage_number)
    });

    const students = data.students || [];

    if (students.length === 0) {
      list.innerHTML = `
        <tr>
          <td colspan="4">No students found.</td>
        </tr>
      `;
      return;
    }

    list.innerHTML = "";

    students.forEach(student => {
      const tr = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = student.full_name || "";

      const genderCell = document.createElement("td");
      genderCell.textContent = student.gender || "";

      const classCell = document.createElement("td");
      classCell.textContent = student.class_name || "";

      const actionsCell = document.createElement("td");

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "edit";
      editButton.textContent = "Edit";

      editButton.addEventListener("click", () => {
        editStudent(
          student.id,
          student.full_name,
          student.gender,
          student.class_name
        );
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete";
      deleteButton.textContent = "Delete";

      deleteButton.addEventListener("click", () => {
        deleteStudent(student.id);
      });

      actionsCell.append(editButton, deleteButton);
      tr.append(
        nameCell,
        genderCell,
        classCell,
        actionsCell
      );

      list.appendChild(tr);
    });

  } catch (error) {
    console.error("Students error:", error);

    if (list) {
      list.innerHTML = `
        <tr>
          <td colspan="4">Could not load students.</td>
        </tr>
      `;
    }

    alert("Could not load students: " + error.message);
  }
}

/* ===============================
MODAL FUNCTIONS
=============================== */

function openModal() {
  editing = false;

  document.getElementById("id").value = "";
  document.getElementById("name").value = "";
  document.getElementById("gender").value = "";
  document.getElementById("class").value = "";

  document.getElementById("title").innerText = "Add Student";
  document.getElementById("modal").style.display = "block";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

/* ===============================
EDIT STUDENT
=============================== */

function editStudent(id, name, gender, cls) {
  editing = true;

  document.getElementById("id").value = id;
  document.getElementById("name").value = name || "";
  document.getElementById("gender").value = gender || "";
  document.getElementById("class").value = cls || "";

  document.getElementById("title").innerText = "Edit Student";
  document.getElementById("modal").style.display = "block";
}

/* ===============================
SAVE STUDENT (ADD / UPDATE)
=============================== */

async function saveStudent() {
  try {
    const competitionId = Number(
      localStorage.getItem("competition_id")
    );

    const activeStage = getActiveStage();

    const fullName = document
      .getElementById("name")
      .value.trim();

    const gender = document
      .getElementById("gender")
      .value;

    const className = document
      .getElementById("class")
      .value.trim();

    if (!competitionId) {
      alert("There is no active competition.");
      return;
    }

    if (!activeStage) {
      alert("There is no stage selected.");
      return;
    }

    if (!fullName || !gender || !className) {
      alert("Please fill in the student's name, gender, and class.");
      return;
    }

    const payload = {
      action: editing ? "updateStudent" : "addStudent",
      full_name: fullName,
      gender,
      class_name: className,
      competition_id: competitionId,
      stage_number: Number(activeStage.stage_number)
    };

    if (editing) {
      payload.id = Number(
        document.getElementById("id").value
      );
    }

    const data = await apiRequest(payload);

    alert(data.message || "Student saved successfully.");

    closeModal();
    await loadStudents();

  } catch (error) {
    console.error("Save student error:", error);
    alert("Could not save student: " + error.message);
  }
}

/* ===============================
DELETE STUDENT
=============================== */

async function deleteStudent(id) {
  if (!confirm("Are you sure you want to delete this student?")) {
    return;
  }

  try {
    const data = await apiRequest({
      action: "deleteStudent",
      id: Number(id)
    });

    alert(data.message || "Student deleted successfully.");

    await loadStudents();

  } catch (error) {
    console.error("Delete student error:", error);
    alert("Could not delete student: " + error.message);
  }
}
