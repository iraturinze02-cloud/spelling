let editing = false;
let competition = null;
let stages = [];

/* ===============================
INITIAL LOAD
=============================== */

window.onload = async () => {
  await loadCompetition();
  await loadStages();
  await loadStudents();
};

/* ===============================
LOAD ACTIVE COMPETITION
=============================== */

async function loadCompetition() {
  try {
    const res = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getActiveCompetition"
      })
    });

    const data = await res.json();

    competition = data.competition || null;

    if (competition) {
      localStorage.setItem("competition_id", competition.id);
    } else {
      localStorage.removeItem("competition_id");
    }

    document.getElementById("competitionName").innerText =
      competition ? competition.competition_name : "No Active Competition";

  } catch (error) {
    console.log("Competition error:", error);
  }
}

/* ===============================
LOAD STAGES
=============================== */

async function loadStages() {
  try {

    if (!competition) return;

    const res = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getStagesByCompetition",
        competition_id: competition.id
      })
    });

    const data = await res.json();

    stages = data.stages || [];

    renderStages();
    renderStageDropdown();

  } catch (error) {
    console.log(error);
  }
}

/* ===============================
LOAD STUDENTS
=============================== */

async function loadStudents() {
  try {

    const competition_id = localStorage.getItem("competition_id");
    const stage_number = localStorage.getItem("active_stage");

    if (!competition_id || !stage_number) {
      alert("No active competition or stage selected");
      return;
    }

    const res = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "getStudents",
        competition_id,
        stage_number
      })
    });

    const data = await res.json();

    let html = "";

    (data.students || []).forEach(s => {

      html += `
        <tr>
          <td>${s.full_name}</td>
          <td>${s.gender}</td>
          <td>${s.class_name}</td>
          <td>

            <button class="edit"
              onclick="editStudent(
                ${s.id},
                '${s.full_name}',
                '${s.gender}',
                '${s.class_name}'
              )">
              Edit
            </button>

            <button class="delete"
              onclick="deleteStudent(${s.id})">
              Delete
            </button>

          </td>
        </tr>
      `;
    });

    document.getElementById("list").innerHTML = html;

  } catch (error) {
    console.log(error);
  }
}

/* ===============================
MODAL FUNCTIONS
=============================== */

function openModal() {
  editing = false;

  document.getElementById("title").innerText = "Add Student";
  document.getElementById("modal").style.display = "block";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

function editStudent(id, name, gender, cls) {
  editing = true;

  document.getElementById("id").value = id;
  document.getElementById("name").value = name;
  document.getElementById("gender").value = gender;
  document.getElementById("class").value = cls;

  document.getElementById("title").innerText = "Edit Student";
  document.getElementById("modal").style.display = "block";
}

/* ===============================
SAVE STUDENT (ADD / UPDATE)
=============================== */

async function saveStudent() {

  let data = {
    id: document.getElementById("id").value,
    full_name: document.getElementById("name").value,
    gender: document.getElementById("gender").value,
    class_name: document.getElementById("class").value,
    competition_id: localStorage.getItem("competition_id"),
    stage_number: localStorage.getItem("active_stage")
  };

  let action = editing ? "updateStudent" : "addStudent";

  await fetch("/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      ...data
    })
  });

  closeModal();
  loadStudents();
}

/* ===============================
DELETE STUDENT
=============================== */

async function deleteStudent(id) {

  await fetch("/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "deleteStudent",
      id
    })
  });

  loadStudents();
}

/* ===============================
AUTO START
=============================== */

loadStudents();
