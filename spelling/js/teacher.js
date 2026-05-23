let students=[];

let currentStudent=0;

let round=1;

let currentWordIndex=0;

let roundScore=0;

let totalScores={};

let timer=null;

let timeLeft=0;

let started=false;

let learnerFinished=false;

let usedTime=0;

let groupWords=[];

let stageSettings={

total_rounds:3,

words_per_round:3,

judge_count:3

};


/* SOUNDS */

const tickSound=
new Audio("sounds/tick.mp3");

const halfwaySound=
new Audio("sounds/halfway.mp3");

const warningSound=
new Audio("sounds/warning.mp3");

const timeoutSound=
new Audio("sounds/timeout.mp3");

const applauseSound=
new Audio("sounds/applause.mp3");

const goodSound=
new Audio("sounds/good.mp3");

const wrongSound=
new Audio("sounds/wrong.mp3");

const roundFinishSound=
new Audio("sounds/round-finish.mp3");

const allRoundFinishSound=
new Audio("sounds/all-round-finish.mp3");

const competitionFinishSound=
new Audio("sounds/competition-finish.mp3");


const allSounds=[

tickSound,
halfwaySound,
warningSound,
timeoutSound,
applauseSound,
goodSound,
wrongSound,
roundFinishSound,
allRoundFinishSound,
competitionFinishSound

];


function stopAllSounds(){

allSounds.forEach(sound=>{

sound.pause();

sound.currentTime=0;

});

}


function playSound(sound){

sound.currentTime=0;

sound.play();

}


/* BUTTON STATES */

function updateButtons(){

document.querySelector(".correct").disabled=true;

document.querySelector(".wrong").disabled=true;

document.querySelector(".notspelt").disabled=true;

document.querySelector(".stop").disabled=
!started;

}


/* LOAD COMPETITION */

async function loadCompetition(){

try{

const res=
await fetch(
"/.netlify/functions/getStudentCompetition"
);

const data=
await res.json();

students=
data.students || [];

if(students.length===0){

alert("No participants found");

return;

}

await loadStageSettings();

await loadSavedState();

showStudent();

await loadGroup();

updateButtons();

}
catch(error){

console.log(error);

}

}


/* LOAD STAGE SETTINGS */

async function loadStageSettings(){

try{

const res=
await fetch(
"/.netlify/functions/getCurrentStage"
);

const data=
await res.json();

if(data.stage){

stageSettings=
data.stage;

}

}
catch(error){

console.log(error);

}

}


/* LOAD WORD GROUP */

async function loadGroup(){

let student=
students[currentStudent];

const res=
await fetch(
"/.netlify/functions/getWordGroups"
);

const data=
await res.json();

let group=
data.groups.find(

g=>
g.group_number==
student.group_number

);

if(!group){

alert("Group not found");

return;

}

groupWords=
group.words;

showWord();

}


/* SHOW STUDENT */

function showStudent(){

let studentId=
students[currentStudent].id;

document.getElementById(
"studentName"
).innerText=
students[currentStudent].full_name;

document.getElementById(
"round"
).innerText=
round+
"/"+
stageSettings.total_rounds;

document.getElementById(
"roundScore"
).innerText=
roundScore;

document.getElementById(
"totalScore"
).innerText=
totalScores[studentId] || 0;

}


/* SHOW WORD */

function showWord(){

let index=

((round-1)*
stageSettings.words_per_round)
+
currentWordIndex;

let word=
groupWords[index];

document.getElementById(
"word"
).innerText=
word || "Finished";

if(word){

if(!started){

timeLeft=
calculateTime(word);

document.getElementById(
"timer"
).innerText=
timeLeft;

}

}
else{

document.getElementById(
"timer"
).innerText=0;

}

}


/* CALCULATE TIME */

function calculateTime(word){

let len=
word.length;

if(len<=4)return 8;

if(len<=7)return 12;

if(len<=10)return 15;

return 20;

}


/* START WORD */

async function startWord(){

if(started)return;

clearInterval(timer);

let word=

groupWords[
((round-1)*
stageSettings.words_per_round)
+
currentWordIndex
];

if(!word)return;

started=true;

learnerFinished=false;

usedTime=0;

updateButtons();

timeLeft=
calculateTime(word);

document.getElementById(
"timer"
).innerText=
timeLeft;

await saveState();

timer=
setInterval(async()=>{

timeLeft--;

usedTime=
calculateTime(word)
-
timeLeft;

document.getElementById(
"timer"
).innerText=
timeLeft;


/* TICK */

tickSound.currentTime=0;

tickSound.play();


/* HALF */

if(
timeLeft===
Math.floor(
calculateTime(word)/2
)
){

playSound(
halfwaySound
);

}


/* WARNING */

if(timeLeft===5){

playSound(
warningSound
);

}


/* TIMEOUT */

if(timeLeft===3){

playSound(
timeoutSound
);

}


/* FINISH */

if(timeLeft<=0){

clearInterval(timer);

started=false;

learnerFinished=true;

timeLeft=0;

document.getElementById(
"timer"
).innerText=0;

playSound(
wrongSound
);

await finalizeVotes(
"timeout"
);

return;

}

await saveState();

},1000);

}


/* STOP TIMER */

async function pauseTimer(){

stopAllSounds();

clearInterval(timer);

started=false;

learnerFinished=true;

updateButtons();

await saveState();

}


/* CALCULATE SCORE */

function calcScore(word,used){

let allowed=
calculateTime(word);

let ratio=
used/allowed;

if(ratio<=0.5)return 1;

if(ratio<=0.75)return .75;

return .5;

}


/* FINALIZE VOTES */

async function finalizeVotes(reason="manual"){

try{

const student=
students[currentStudent];

const word=

groupWords[
((round-1)*
stageSettings.words_per_round)
+
currentWordIndex
];

const res=
await fetch(
"/.netlify/functions/getWordVotes"
);

const data=
await res.json();

const votes=
data.votes || [];

let correct=
votes.filter(
v=>v.vote==="correct"
).length;

let wrong=
votes.filter(
v=>v.vote==="wrong"
).length;

let notspelt=
votes.filter(
v=>v.vote==="notspelt"
).length;

let finalStatus="wrong";

if(correct>=2){

finalStatus="correct";

}
else if(notspelt>=2){

finalStatus="notspelt";

}

let scoreValue=0;

if(finalStatus==="correct"){

scoreValue=
calcScore(
word,
usedTime
);

if(
usedTime<=
calculateTime(word)/2
){

playSound(
applauseSound
);

}
else{

playSound(
goodSound
);

}

}
else{

playSound(
wrongSound
);

}

roundScore=
Number(
(
Number(roundScore)+
Number(scoreValue)
).toFixed(2)
);

let studentId=
student.id;

if(!totalScores[studentId]){

totalScores[studentId]=0;

}

totalScores[studentId]=
Number(
(
Number(totalScores[studentId])+
Number(scoreValue)
).toFixed(2)
);

document.getElementById(
"roundScore"
).innerText=
roundScore;

document.getElementById(
"totalScore"
).innerText=
totalScores[studentId];

await fetch(
"/.netlify/functions/spellingSaveResult",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

student_id:student.id,

round_number:round,

word:word,

score:scoreValue,

time_used:usedTime,

time_allowed:
calculateTime(word),

status:finalStatus

})

}

);

await saveState();

setTimeout(()=>{

nextWord();

},3000);

}
catch(error){

console.log(error);

}

}


/* NEXT WORD */

async function nextWord(){

stopAllSounds();

clearInterval(timer);

started=false;

learnerFinished=false;

updateButtons();

currentWordIndex++;

usedTime=0;

if(
currentWordIndex>=
stageSettings.words_per_round
){

playSound(
roundFinishSound
);

alert(

students[currentStudent]
.full_name+

" finished round"

);

await nextStudent();

return;

}

showWord();

await saveState();

}


/* NEXT STUDENT */

async function nextStudent(){

currentStudent++;

currentWordIndex=0;

roundScore=0;

if(
currentStudent>=students.length
){

currentStudent=0;

round++;

if(
round>
stageSettings.total_rounds
){

playSound(
competitionFinishSound
);

window.location=
"leaderboard.html";

return;

}

playSound(
allRoundFinishSound
);

window.location=
"leaderboard.html";

return;

}

started=false;

learnerFinished=false;

usedTime=0;

timeLeft=0;

groupWords=[];

showStudent();

await loadGroup();

await saveState();

}


/* RESET PARTICIPANT */

function resetParticipant(){

currentWordIndex=0;

roundScore=0;

showStudent();

showWord();

saveState();

}


/* RESET ROUND */

function resetRound(){

currentStudent=0;

currentWordIndex=0;

round=1;

roundScore=0;

showStudent();

showWord();

saveState();

}


/* RESET COMPETITION */

async function resetCompetition(){

if(
!confirm(
"Reset competition?"
)
){

return;

}

await fetch(
"/.netlify/functions/resetCompetition"
);

location.reload();

}


/* SAVE STATE */

async function saveState(){

await fetch(
"/.netlify/functions/saveCompetitionState",
{

method:"POST",

headers:{
"Content-Type":
"application/json"
},

body:JSON.stringify({

currentstudent:
currentStudent,

currentwordindex:
currentWordIndex,

round:round,

score:roundScore,

timeleft:timeLeft,

started:started,

learnerfinished:
learnerFinished,

usedtime:usedTime

})

}

);

}


/* LOAD SAVED STATE */

async function loadSavedState(){

try{

const res=
await fetch(
"/.netlify/functions/getCompetitionState"
);

const data=
await res.json();

if(data.state){

started=
data.state.started || false;

learnerFinished=
data.state.learnerfinished || false;

usedTime=
data.state.usedtime || 0;

currentStudent=
parseInt(
data.state.currentstudent
) || 0;

currentWordIndex=
parseInt(
data.state.currentwordindex
) || 0;

round=
parseInt(
data.state.round
) || 1;

roundScore=
Number(
data.state.score
) || 0;

timeLeft=
Number(
data.state.timeleft
) || 0;

document.getElementById(
"round"
).innerText=
round+
"/"+
stageSettings.total_rounds;

document.getElementById(
"timer"
).innerText=
timeLeft;

}

}
catch(error){

console.log(error);

}

}


/* AUTO REALTIME REFRESH */

setInterval(async()=>{

await loadSavedState();

},1000);


/* WINDOW LOAD */

window.onload=async()=>{

await loadCompetition();

updateButtons();

};
