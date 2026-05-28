// ========================================
// GLOBALS
// ========================================

let ACTIVE_COMPETITION_ID = null;
let ACTIVE_STAGE = null;
let REQUIRED_WORDS = 0;


// ========================================
// LOAD SYSTEM
// ========================================

async function loadSystem(){

try{

// ACTIVE COMPETITION
const competitionRes =
await fetch(
"/api",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
action:"getActiveCompetition"
})
}
);

const competitionData =
await competitionRes.json();

if(!competitionData.competition){

document.getElementById(
"groups"
).innerHTML = `
<div class="card">
No active competition
</div>
`;

return;

}

ACTIVE_COMPETITION_ID =
competitionData.competition.id;


// ACTIVE STAGE
const stageRes =
await fetch(
"/api",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
action:"getActiveStage",
competition_id:
ACTIVE_COMPETITION_ID
})
}
);

const stageData =
await stageRes.json();

if(!stageData.stage){

document.getElementById(
"groups"
).innerHTML = `
<div class="card">
No active stage
</div>
`;

return;

}

ACTIVE_STAGE =
stageData.stage;

REQUIRED_WORDS =
(
ACTIVE_STAGE.total_rounds *
ACTIVE_STAGE.words_per_round
);


// UPDATE HEADER
document.querySelector(
".header h2"
).innerHTML = `

Word Groups
<br>

<span style="
font-size:14px;
font-weight:normal;
opacity:.9;
">

Stage ${ACTIVE_STAGE.stage_number}
• ${REQUIRED_WORDS} words required

</span>

`;


// LOAD GROUPS
loadGroups();

}
catch(error){

console.log(error);

alert(
"Failed to load system"
);

}

}



// ========================================
// ADD GROUP BOX
// ========================================

function addGroupBox(){

const div =
document.createElement("div");

div.className = "card";

div.innerHTML = `

<h3>

New Group

</h3>

<p style="
margin:10px 0;
color:#6b7280;
font-size:14px;
">

Enter exactly
${REQUIRED_WORDS}
words separated by commas

</p>

<textarea

class="wordsInput"

rows="6"

placeholder="word1, word2, word3..."

style="
width:100%;
padding:12px;
border:1px solid #ddd;
border-radius:8px;
resize:vertical;
font-size:15px;
"

></textarea>

<button
class="save"
onclick="saveGroup(this)"
style="margin-top:10px;"
>

Save Group

</button>

`;

document
.getElementById(
"groups"
)
.prepend(div);

}



// ========================================
// SAVE GROUP
// ========================================

async function saveGroup(btn){

try{

const card =
btn.parentElement;

const textarea =
card.querySelector(
"textarea"
);

const raw =
textarea.value.trim();

if(!raw){

alert(
"Please enter words"
);

return;

}


// SPLIT WORDS
let words =
raw
.split(",")
.map(w=>w.trim())
.filter(w=>w !== "");


// VALIDATE
if(words.length !== REQUIRED_WORDS){

alert(

`You must enter exactly ${REQUIRED_WORDS} words`

);

return;

}


// SAVE
btn.innerText =
"Saving...";

btn.disabled = true;

const response =
await fetch(
"/api",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({

action:"createWordGroup",

competition_id:
ACTIVE_COMPETITION_ID,

stage_number:
ACTIVE_STAGE.stage_number,

words

})
}
);

const data =
await response.json();

if(data.success){

alert(

`Group ${data.group.group_number} created`

);

loadGroups();

}
else{

alert(
data.message ||
"Failed to create group"
);

}

btn.innerText =
"Save Group";

btn.disabled = false;

}
catch(error){

console.log(error);

alert(
"Error creating group"
);

}

}



// ========================================
// LOAD GROUPS
// ========================================

async function loadGroups(){

try{

const res =
await fetch(
"/api",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({

action:"getWordGroups",

competition_id:
ACTIVE_COMPETITION_ID,

stage_number:
ACTIVE_STAGE.stage_number

})
}
);

const data =
await res.json();

let container =
document.getElementById(
"groups"
);

container.innerHTML = "";


// EMPTY
if(
!data.groups ||
data.groups.length === 0
){

container.innerHTML = `

<div class="card">

No groups yet

</div>

`;

return;

}


// GROUPS
data.groups.forEach(group=>{

const div =
document.createElement("div");

div.className = "card";

div.innerHTML = `

<h3>

Group
${group.group_number}

</h3>

<div class="groupBox">

${group.words
.map(

w=>

`<span class="word">

${w}

</span>`

)
.join("")}

</div>

`;

container.appendChild(
div
);

});

}
catch(error){

console.log(error);

}

}



// ========================================
// INITIALIZE
// ========================================

loadSystem();
