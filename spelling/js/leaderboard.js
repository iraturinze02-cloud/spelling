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

document.getElementById(
"title"
).innerText=
"No Active Competition";

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

competition_id:
localStorage.getItem(
"competition_id"
)

})

});

const data=
await res.json();

console.log(
"Stage:",
data
);

if(data.stage){

stages=[data.stage];

localStorage.setItem(

"active_stage",
data.stage.stage_number

);

}
else{

stages=[];

}

}
catch(error){

console.log(
"Stage error:",
error
);

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
!competition_id
||
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

console.log(
"Leaderboard:",
data
);

const leaderboard=
data.leaderboard || [];


/* TITLE */

document.getElementById(
"title"
).innerText=

competition.competition_name+

" - Stage "+

stage_number+

" Ranking";


/* EMPTY */

if(
leaderboard.length===0
){

document.getElementById(
"list"
).innerHTML=

`
<tr>

<td colspan="4">

No results yet

</td>

</tr>
`;

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

${s.class_name || "-"}

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
"Leaderboard error:",
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
!competition_id
||
!activeStage
){

alert(
"No active stage"
);

return;

}

const currentStage=
activeStage.stage_number;

const stageRounds=
activeStage.total_rounds;

let currentRound=
parseInt(

localStorage.getItem(
"currentRound"
)

)||1;


currentRound++;

localStorage.setItem(

"currentRound",
currentRound

);


/* ONLY ADVANCE STAGE
AFTER FINAL ROUND */

if(
currentRound>
stageRounds
){

const res=
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

const data=
await res.json();

console.log(
"Advance:",
data
);

if(data.next_stage){

localStorage.setItem(

"currentRound",
1

);

alert(

"Moved to "+
data.next_stage.stage_name

);

}

await loadStages();

}

await load();

}
catch(error){

console.log(
"Next round error:",
error
);

}

}


/* ===============================
AUTO REFRESH
=============================== */

async function autoRefresh(){

if(refreshing){

return;

}

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


/* LIVE UPDATE */

setInterval(

autoRefresh,

3000

);
