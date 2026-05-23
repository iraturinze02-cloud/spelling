// settings.js

let competition=null;
let judges=[];
let stages=[];


/* ===============================
INITIAL LOAD
=============================== */

window.onload=async()=>{

await loadCompetition();

await loadJudges();

await loadStages();

};



/* ===============================
LOAD ACTIVE COMPETITION
=============================== */

async function loadCompetition(){

try{

const res=
await fetch(
"/.netlify/functions/getActiveCompetition"
);

const data=
await res.json();

competition=
data.competition || null;


document.getElementById(
"competitionName"
).innerText=

competition
?
competition.competition_name
:
"No Active Competition";


}
catch(error){

console.log(
"Competition error:",
error
);

}

}



/* ===============================
CREATE NEW COMPETITION
=============================== */

async function saveCompetition(){

try{

const name=
document.getElementById(
"competitionInput"
).value.trim();


if(!name){

alert(
"Enter competition name"
);

return;

}


const res=
await fetch(

"/.netlify/functions/createCompetition",

{

method:"POST",

headers:{

"Content-Type":
"application/json"

},

body:
JSON.stringify({

competition_name:name

})

}

);


const data=
await res.json();


if(data.success){

alert(
"Competition created"
);

closeCompetitionModal();

await loadCompetition();

}
else{

alert(
"Failed creating competition"
);

}

}
catch(error){

console.log(error);

}

}



/* ===============================
LOAD JUDGES
=============================== */

async function loadJudges(){

try{

const res=
await fetch(
"/.netlify/functions/getJudges"
);

const data=
await res.json();

judges=
data.judges || [];


const select=
document.getElementById(
"judges"
);

select.innerHTML="";


judges.forEach(j=>{

let option=
document.createElement(
"option"
);

option.value=
j.id;

option.innerText=
j.username;

select.appendChild(
option
);

});

}
catch(error){

console.log(error);

}

}



/* ===============================
SAVE SELECTED JUDGES
=============================== */

async function saveJudges(){

try{

if(!competition){

alert(
"No competition selected"
);

return;

}


const selected=

Array.from(

document
.getElementById(
"judges"
)
.selectedOptions

)

.map(

opt=>opt.value

);


const res=
await fetch(

"/.netlify/functions/saveCompetitionJudges",

{

method:"POST",

headers:{

"Content-Type":
"application/json"

},

body:
JSON.stringify({

competition_id:
competition.id,

judges:
selected

})

}

);


const data=
await res.json();


if(data.success){

alert(
"Judges saved"
);

}

}
catch(error){

console.log(error);

}

}



/* ===============================
SAVE STAGES
=============================== */

async function saveStages(){

try{

if(!competition){

alert(
"Create competition first"
);

return;

}


const stageNames=

document.querySelectorAll(
".stageName"
);


const participants=

document.querySelectorAll(
".participants"
);


const rules=

document.querySelectorAll(
".rule"
);


const qualifiers=

document.querySelectorAll(
".qualifiers"
);


let stageData=[];


for(

let i=0;

i<stageNames.length;

i++

){

stageData.push({

competition_id:
competition.id,

stage_number:
i+1,

stage_name:

stageNames[i]
.value ||

`Stage ${i+1}`,

participant_count:
participants[i]
.value,

qualification_rule:
rules[i]
.value,

qualifier_count:
qualifiers[i]
.value,

status:
i===0
?
"active"
:
"inactive"

});

}


const res=
await fetch(

"/.netlify/functions/saveCompetitionStages",

{

method:"POST",

headers:{

"Content-Type":
"application/json"

},

body:
JSON.stringify({

stages:
stageData

})

}

);


const data=
await res.json();


if(data.success){

alert(
"Stages saved"
);

closeStageModal();

await loadStages();

}

}
catch(error){

console.log(error);

}

}



/* ===============================
LOAD STAGES
=============================== */

async function loadStages(){

try{

if(!competition){
return;
}


const res=
await fetch(

"/.netlify/functions/getStages?competition_id="+
competition.id

);


const data=
await res.json();

stages=
data.stages || [];


renderStages();

renderStageDropdown();

}
catch(error){

console.log(error);

}

}



/* ===============================
RENDER STAGES
=============================== */

function renderStages(){

const container=

document.getElementById(
"stageContainer"
);


container.innerHTML="";


if(
stages.length===0
){

container.innerHTML=
"No stages created";

return;

}


stages.forEach(stage=>{

container.innerHTML+=`

<div class="stage-box">

<div class="stage-title">

${stage.stage_name}

</div>

<p>

Stage Number:
<b>

${stage.stage_number}

</b>

</p>

<p>

Participants:
<b>

${stage.participant_count}

</b>

</p>

<p>

Qualification:
<b>

${stage.qualification_rule}

</b>

</p>

<p>

Qualifiers:
<b>

${stage.qualifier_count}

</b>

</p>

<p>

Rounds:
<b>

${stage.total_rounds || 0}

</b>

</p>

<p>

Words / Round:
<b>

${stage.words_per_round || 0}

</b>

</p>

<p>

Status:
<b>

${stage.status}

</b>

</p>

</div>

`;

});

}



/* ===============================
STAGE DROPDOWN
=============================== */

function renderStageDropdown(){

const select=

document.getElementById(
"stageSelect"
);

select.innerHTML="";


stages.forEach(stage=>{

let option=
document.createElement(
"option"
);

option.value=
stage.stage_number;

option.innerText=
stage.stage_name;

select.appendChild(
option
);

});


select.onchange=
loadSelectedStageRules;


loadSelectedStageRules();

}



/* ===============================
LOAD STAGE RULES
=============================== */

function loadSelectedStageRules(){

const stageNumber=

parseInt(

document
.getElementById(
"stageSelect"
)
.value

);


const stage=

stages.find(

s=>

s.stage_number==
stageNumber

);


if(!stage){
return;
}


document.getElementById(
"rounds"
).value=

stage.total_rounds || 3;


document.getElementById(
"words"
).value=

stage.words_per_round || 3;

}



/* ===============================
SAVE STAGE RULES
=============================== */

async function saveStageRules(){

try{

const stageNumber=

parseInt(

document
.getElementById(
"stageSelect"
)
.value

);


const rounds=

document
.getElementById(
"rounds"
)
.value;


const words=

document
.getElementById(
"words"
)
.value;


const res=
await fetch(

"/.netlify/functions/updateStageRules",

{

method:"POST",

headers:{

"Content-Type":
"application/json"

},

body:
JSON.stringify({

competition_id:
competition.id,

stage_number:
stageNumber,

total_rounds:
rounds,

words_per_round:
words,

total_words:
rounds*
words

})

}

);


const data=
await res.json();


if(data.success){

alert(
"Rules updated"
);

await loadStages();

}

}
catch(error){

console.log(error);

}

}



/* ===============================
HOME
=============================== */

function goHome(){

window.location=
"teacher-home.html";

}
