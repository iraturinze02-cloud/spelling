async function apiRequest(data) {

    const token = localStorage.getItem("auth_token");

    const response = await fetch("/api", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + (token || "")
        },
        body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.message || `API error: ${response.status}`
        );
    }

    return result;
}

// ========================================
// GLOBALS
// ========================================

let ACTIVE_COMPETITION_ID = null;
let ACTIVE_STAGE_NUMBER = null;


// ========================================
// LOAD ACTIVE SYSTEM
// ========================================

async function loadSystem() {

    try {

        // ACTIVE COMPETITION
        const competitionData = await apiRequest({
            action: "getActiveCompetition"
        });

        if (!competitionData.competition) {

            document.getElementById("studentList").innerHTML = `
                <tr>
                    <td colspan="4" class="empty">
                        No Active Competition
                    </td>
                </tr>
            `;

            return;
        }

        ACTIVE_COMPETITION_ID =
            competitionData.competition.id;


        // ACTIVE STAGE
        const stageData = await apiRequest({
            action: "getActiveStage",
            competition_id: ACTIVE_COMPETITION_ID
        });

        if (!stageData.stage) {

            document.getElementById("studentList").innerHTML = `
                <tr>
                    <td colspan="4" class="empty">
                        No Active Stage
                    </td>
                </tr>
            `;

            console.log("Active stage response:", stageData);

            return;
        }

        ACTIVE_STAGE_NUMBER =
            stageData.stage.stage_number;


        // UPDATE TITLE
        document.querySelector(".header h2").innerHTML = `
            Participants Draw Assignment
            <br>
            <span style="
                font-size:14px;
                font-weight:normal;
                opacity:.9;
            ">
                Stage ${ACTIVE_STAGE_NUMBER}
            </span>
        `;


        // LOAD STUDENTS
        await loadStudents();

    }

    catch(error) {

        console.error("SYSTEM ERROR:", error);

        showToast(error.message || "Failed to load system", true);

    }

}


// ========================================
// LOAD STUDENTS
// ========================================

async function loadStudents() {

    try {

        const data = await apiRequest({
            action: "getStudentsWithGroups",
            competition_id: ACTIVE_COMPETITION_ID,
            stage_number: ACTIVE_STAGE_NUMBER
        });

        const students = data.students || [];

        if (students.length === 0) {

            document.getElementById("studentList").innerHTML = `
                <tr>
                    <td colspan="4" class="empty">
                        No students found
                    </td>
                </tr>
            `;

            return;
        }

        let html = "";

        students.forEach(student => {

            html += `
                <tr>
                    <td class="nameCell">
                        ${student.full_name || ""}
                    </td>

                    <td>
                        ${student.gender || "-"}
                    </td>

                    <td>
                        <input
                            type="number"
                            min="1"
                            class="inlineInput"
                            id="group-${student.id}"
                            value="${student.group_id || ""}"
                            placeholder="Group"
                            onchange="saveDraw(${student.id})"
                        >
                    </td>

                    <td>
                        <input
                            type="number"
                            min="1"
                            class="inlineInput"
                            id="order-${student.id}"
                            value="${student.draw_order || ""}"
                            placeholder="Order"
                            onchange="saveDraw(${student.id})"
                        >
                    </td>
                </tr>
            `;

        });

        document.getElementById("studentList").innerHTML = html;

    } catch (error) {

        console.error("LOAD STUDENTS ERROR:", error);

        document.getElementById("studentList").innerHTML = `
            <tr>
                <td colspan="4" class="empty">
                    Failed to load students
                </td>
            </tr>
        `;

    }
}
// ========================================
// SAVE DRAW
// ========================================

async function saveDraw(student_id) {

    try {

        const group_id = document.getElementById(
            `group-${student_id}`
        ).value;

        const draw_order = document.getElementById(
            `order-${student_id}`
        ).value;

        if (!group_id || !draw_order) return;

        if (
            !Number.isInteger(Number(group_id)) ||
            !Number.isInteger(Number(draw_order)) ||
            Number(group_id) < 1 ||
            Number(draw_order) < 1
        ) {
            showToast("Invalid values", true);
            return;
        }

        const result = await apiRequest({
            action: "assignDraw",
            competition_id: ACTIVE_COMPETITION_ID,
            stage_number: ACTIVE_STAGE_NUMBER,
            student_id,
            group_id: Number(group_id),
            draw_order: Number(draw_order)
        });

        if (result.success) {
            showToast("Saved successfully");
        } else {
            showToast(result.message || "Failed to save", true);
        }

    } catch (error) {

        console.error("SAVE DRAW ERROR:", error);

        showToast(error.message || "Error saving draw", true);

    }
}

// ========================================
// INITIALIZE
// ========================================

loadSystem();

