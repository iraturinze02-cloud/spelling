

let refreshing=false;
let stages=[];
let competition=null;

/* ===============================
LOAD ACTIVE COMPETITION
=============================== */

async function loadCompetition(){

try{

const res=
await fetch("/api",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

action:"getActiveCompetition"

})

});

const data=
await res.json();

console.log(
"Competition:",
data
);

competition=
data.competition || null;

if(!competition){

console.log(
"No competition"
);

return;
}

localStorage.setItem(
"competition_id",
competition.id
);

await loadStages();

}
catch(error){

console.log(
"Competition error:",
error
);

}

}


/* ===============================
LOAD ACTIVE STAGE
=============================== */

async function loadStages(){

try{

if(!competition)return;

const res=
await fetch("/api",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

action:"getActiveStage",
competition_id:competition.id

})

});

const data=
await res.json();
  
console.log(data);
/* FIX */

if(data.stage){

stages=[data.stage];

localStorage.setItem(
"active_stage",
data.stage.stage_number
);

}else{

stages=[];

}

}
catch(error){

console.log(error);

}

}


/* ===============================
LOAD LEADERBOARD
=============================== */

async function load(){

try{

const competition_id=
localStorage.getItem(
"competition_id"
);

const activeStage=
stages[0];

if(
!competition_id ||
!activeStage
){

document.getElementById(
"title"
).innerText=

"No Active Competition / Stage";

document.getElementById(
"list"
).innerHTML="";

return;

}


/* FIX */

const stage_number=
activeStage.stage_number;


const res=
await fetch("/api",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

action:"getLeaderboard",

competition_id,

stage_number

})

});

const data=
await res.json();
  console.log(data);

const leaderboard=
data.leaderboard || [];


/* TITLE */

document.getElementById(
"title"
).innerText=

"YOUNG SPELLERS - Stage "
+
stage_number
+
" Ranking";


/* EMPTY */

if(
leaderboard.length===0
){

document.getElementById(
"list"
).innerHTML=

"<tr><td colspan='4'>No results yet</td></tr>";

return;

}


/* RENDER */

let html="";

leaderboard.forEach((s,i)=>{

let cls="";
let rank=i+1;

if(i===0){

cls="top1";
rank="🥇";

}
else if(i===1){

cls="top2";
rank="🥈";

}
else if(i===2){

cls="top3";
rank="🥉";

}

html+=`

<tr class="${cls}">

<td class="rank">

${rank}

</td>

<td>

${s.full_name}

</td>

<td>

${s.class_name}

</td>

<td>

${s.total_score}

</td>

</tr>

`;

});

document.getElementById(
"list"
).innerHTML=
html;

}
catch(error){

console.log(
"Load error:",
error
);

}

}


/* ===============================
NEXT ROUND
=============================== */

async function nextRound(){

try{

const competition_id=
localStorage.getItem(
"competition_id"
);

const activeStage=
stages[0];

if(
!competition_id ||
!activeStage
){

alert(
"No active stage"
);

return;

}

const currentStage=
activeStage.stage_number;

const currentRound=
parseInt(

localStorage.getItem(
"currentRound"
)||1

);


const res=
await fetch("/api",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

action:"qualifyNextRound",

competition_id,

stage_number:
currentStage,

round_number:
currentRound

})

});

const data=
await res.json();
  
console.log(data);
if(!data.success){

alert(
data.message ||
"Failed"
);

return;

}


const newRound=
currentRound+1;

localStorage.setItem(

"currentRound",

newRound

);


/* AUTO STAGE ADVANCE */

await fetch("/api",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

action:"autoAdvanceStage",

competition_id,

current_stage_number:
currentStage

})

});


await loadStages();

await load();

alert(
"Round "
+
newRound
+
" started"
);

}
catch(error){

console.log(
error
);

}

}


/* ===============================
AUTO REFRESH
=============================== */

async function autoRefresh(){

if(refreshing)return;

refreshing=true;

try{

await loadStages();

await load();

}
catch(error){

console.log(
error
);

}

refreshing=false;

}


/* ===============================
INIT
=============================== */

async function init(){

await loadCompetition();

if(stages.length>0){

await load();

}

}
init();

setInterval(
autoRefresh,
10000
);

