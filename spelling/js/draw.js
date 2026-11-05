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

async function loadStudents(){

try{

const data = await apiRequest({

    action: "getStudentsWithGroups",

    competition_id: ACTIVE_COMPETITION_ID,

    stage_number: ACTIVE_STAGE_NUMBER

});

const data =
await res.json();

const students =
data.students || [];


// EMPTY
if(students.length === 0){

document.getElementById(
"studentList"
).innerHTML = `

<tr>

<td colspan="4"
class="empty">

No students found

</td>

</tr>

`;

return;

}


// TABLE
let html = "";

students.forEach(student=>{

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

onchange="saveDraw(
${student.id}
)"

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

onchange="saveDraw(
${student.id}
)"

>

</td>

</tr>

`;

});

document.getElementById(
"studentList"
).innerHTML = html;

}
catch(error){

console.log(error);

document.getElementById(
"studentList"
).innerHTML = `

<tr>

<td colspan="4"
class="empty">

Failed to load students

</td>

</tr>

`;

}

}



// ========================================
// SAVE DRAW
// ========================================

async function saveDraw(student_id){

try{

const group_id =
document.getElementById(
`group-${student_id}`
).value;

const draw_order =
document.getElementById(
`order-${student_id}`
).value;


// VALIDATION
if(!group_id || !draw_order){

return;

}

if(
isNaN(group_id) ||
isNaN(draw_order)
){

showToast(
"Invalid values",
true
);

return;

}


// SAVE
const result = await apiRequest({

    action: "assignDraw",

    competition_id: ACTIVE_COMPETITION_ID,

    stage_number: ACTIVE_STAGE_NUMBER,

    student_id,

    group_id: parseInt(group_id),

    draw_order: parseInt(draw_order)

});

const result =
await response.json();

if(result.success){

showToast(
"Saved successfully"
);

}else{

showToast(
result.message ||
"Failed to save",
true
);

}

}
catch(error){

console.log(error);

showToast(
"Error saving draw",
true
);

}

}



// ========================================
// TOAST
// ========================================

function showToast(
message,
error=false
){

const toast =
document.createElement("div");

toast.className = "toast";

toast.style.background =
error
? "#dc2626"
: "#16a34a";

toast.innerText = message;

document.body.appendChild(
toast
);

setTimeout(()=>{

toast.classList.add(
"show"
);

},100);

setTimeout(()=>{

toast.classList.remove(
"show"
);

setTimeout(()=>{

toast.remove();

},300);

},1800);

}



// ========================================
// INITIALIZE
// ========================================

loadSystem();

