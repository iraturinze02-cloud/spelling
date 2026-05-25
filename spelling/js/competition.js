// ==========================================
// GLOBAL SPELLING COMPETITION ENGINE
// app.js
// ==========================================

// ==========================================
// AUDIO SYSTEM
// ==========================================

const sounds = {

tick:new Audio("sounds/tick.mp3"),

halfway:new Audio("sounds/halfway.mp3"),

warning:new Audio("sounds/warning.mp3"),

timeout:new Audio("sounds/timeout.mp3"),

correct:new Audio("sounds/correct.mp3"),

wrong:new Audio("sounds/wrong.mp3"),

applause:new Audio("sounds/applause.mp3"),

roundFinish:new Audio("sounds/round-finish.mp3"),

competitionFinish:new Audio("sounds/competition-finish.mp3")

};

// ==========================================
// GLOBAL VARIABLES
// ==========================================

let realtimeTimer = null;

let competitionState = {

competition:null,

stage:null,

students:[],

words:[],

currentStudentIndex:0,

currentRound:1,

currentWordIndex:0,

timeLeft:0,

started:false,

usedTime:0,

currentWord:"",

currentStudent:null

};

// ==========================================
// PLAY SOUND
// ==========================================

function playSound(sound){

try{

if(!sound)return;

sound.pause();

sound.currentTime = 0;

sound.play();

}
catch(error){

console.log(error);

}

}

// ==========================================
// STOP ALL SOUNDS
// ==========================================

function stopAllSounds(){

Object.values(sounds).forEach(sound=>{

sound.pause();

sound.currentTime = 0;

});

}

// ==========================================
// API HELPER
// ==========================================

async function api(data){

try{

const res = await fetch("/api",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify(data)

});

return await res.json();

}
catch(error){

console.log(error);

return null;

}

}

// ==========================================
// INIT ENGINE
// ==========================================

async function initializeCompetition(){

try{

// ACTIVE COMPETITION
const competitionRes = await api({
action:"getActiveCompetition"
});

competitionState.competition =
competitionRes.competition;

// ACTIVE STAGE
const stageRes = await api({
action:"getActiveStage",
competition_id:
competitionState.competition.id
});

competitionState.stage =
stageRes.stage;

// ENSURE STAGE READY
await api({

action:"ensureStageReady",

competition_id:
competitionState.competition.id,

stage_number:
competitionState.stage.stage_number

});

// LOAD STUDENTS
const studentsRes = await api({

action:"getStudents",

competition_id:
competitionState.competition.id,

stage_number:
competitionState.stage.stage_number

});

competitionState.students =
studentsRes.students || [];

// LOAD WORD GROUPS
const wordsRes = await api({
action:"getWordGroups"
});

competitionState.wordGroups =
wordsRes.groups || [];

// LOAD SAVED STATE
await restoreCompetitionState();

// PREPARE CURRENT
prepareCurrentParticipant();

// START REALTIME
startRealtimeSync();

}
catch(error){

console.log(
"Initialization failed",
error
);

}

}

// ==========================================
// PREPARE CURRENT PARTICIPANT
// ==========================================

function prepareCurrentParticipant(){

const student =
competitionState.students[
competitionState.currentStudentIndex
];

competitionState.currentStudent = student;

if(!student)return;

// FIND GROUP
const group =
competitionState.wordGroups.find(
g => g.group_number == student.group_number
);

competitionState.words =
group?.words || [];

prepareCurrentWord();

}

// ==========================================
// PREPARE WORD
// ==========================================

function prepareCurrentWord(){

const stage =
competitionState.stage;

const index =
((competitionState.currentRound - 1)
* stage.words_per_round)
+
competitionState.currentWordIndex;

const word =
competitionState.words[index];

competitionState.currentWord =
word || "";

if(word){

competitionState.timeLeft =
calculateAllowedTime(word);

updateTeacherUI();

}

}

// ==========================================
// TIME CALCULATION
// ==========================================

function calculateAllowedTime(word){

if(!word)return 10;

const len = word.length;

if(len <= 4)return 8;

if(len <= 7)return 12;

if(len <= 10)return 15;

return 20;

}

// ==========================================
// START TIMER
// ==========================================

async function startCompetitionTimer(){

if(competitionState.started)return;

competitionState.started = true;

competitionState.usedTime = 0;

updateTeacherStatus(
"Timer Running"
);

disableVotingButtons();

await saveCompetitionState();

realtimeTimer = setInterval(async()=>{

competitionState.timeLeft--;

competitionState.usedTime++;

updateTeacherTimer();

playSound(sounds.tick);

// HALF TIME
if(
competitionState.timeLeft ===
Math.floor(
calculateAllowedTime(
competitionState.currentWord
)/2
)
){

playSound(sounds.halfway);

}

// WARNING
if(
competitionState.timeLeft === 5
){

playSound(sounds.warning);

}

// TIMEOUT
if(
competitionState.timeLeft <= 0
){

clearInterval(realtimeTimer);

competitionState.timeLeft = 0;

competitionState.started = false;

updateTeacherTimer();

playSound(sounds.timeout);

enableVotingButtons();

updateTeacherStatus(
"Time Finished"
);

await saveCompetitionState();

return;

}

updateTeacherTimer();

await saveCompetitionState();

},1000);

}

// ==========================================
// STOP TIMER
// ==========================================

async function stopCompetitionTimer(){

clearInterval(realtimeTimer);

competitionState.started = false;

enableVotingButtons();

stopAllSounds();

updateTeacherStatus(
"Voting Open"
);

await saveCompetitionState();

}

// ==========================================
// SAVE STATE
// ==========================================

async function saveCompetitionState(){

await api({

action:"updateState",

competition_id:
competitionState.competition.id,

stage_number:
competitionState.stage.stage_number,

currentStudent:
competitionState.currentStudentIndex,

round:
competitionState.currentRound,

currentWordIndex:
competitionState.currentWordIndex,

timeLeft:
competitionState.timeLeft,

started:
competitionState.started,

score:
document.getElementById("roundScore")
?.innerText || 0,

participant_done:false

});

}

// ==========================================
// RESTORE STATE
// ==========================================

async function restoreCompetitionState(){

const res = await api({
action:"getCompetitionRealtime",
competition_id:
competitionState.competition.id
});

if(!res)return;

competitionState.currentStudentIndex =
res.current_student_index || 0;

competitionState.currentRound =
res.current_round || 1;

competitionState.currentWordIndex =
res.current_word_index || 0;

competitionState.timeLeft =
res.time_left || 0;

competitionState.started =
res.started || false;

}

// ==========================================
// FINALIZE RESULT
// ==========================================

async function finalizeCurrentResult(){

try{

const student =
competitionState.currentStudent;

const result = await api({

action:"finalizeVotes",

competition_id:
competitionState.competition.id,

stage_number:
competitionState.stage.stage_number,

student_id:
student.id,

word:
competitionState.currentWord,

used_time:
competitionState.usedTime,

time_allowed:
calculateAllowedTime(
competitionState.currentWord
)

});

if(!result)return;

// UPDATE SCORE
let score =
Number(result.score || 0);

let roundScore =
Number(
document.getElementById("roundScore")
.innerText
);

roundScore += score;

document.getElementById(
"roundScore"
).innerText =
roundScore.toFixed(2);

// TOTAL SCORE
let total =
Number(
document.getElementById("totalScore")
.innerText
);

total += score;

document.getElementById(
"totalScore"
).innerText =
total.toFixed(2);

// SOUND
if(result.final_status === "correct"){

if(
competitionState.usedTime <=
calculateAllowedTime(
competitionState.currentWord
)/2
){

playSound(sounds.applause);

}else{

playSound(sounds.correct);

}

}else{

playSound(sounds.wrong);

}

updateTeacherStatus(
`Final Result: ${result.final_status}`
);

await saveCompetitionState();

}
catch(error){

console.log(error);

}

}

// ==========================================
// NEXT WORD
// ==========================================

async function moveToNextWord(){

competitionState.currentWordIndex++;

const stage =
competitionState.stage;

// ROUND FINISHED
if(
competitionState.currentWordIndex >=
stage.words_per_round
){

playSound(
sounds.roundFinish
);

competitionState.currentWordIndex = 0;

competitionState.currentStudentIndex++;

// ALL STUDENTS FINISHED
if(
competitionState.currentStudentIndex >=
competitionState.students.length
){

competitionState.currentStudentIndex = 0;

competitionState.currentRound++;

// COMPETITION FINISHED
if(
competitionState.currentRound >
stage.total_rounds
){

playSound(
sounds.competitionFinish
);

await finishCompetition();

return;

}

}

}

// RESET TIMER
competitionState.timeLeft = 0;

competitionState.usedTime = 0;

competitionState.started = false;

// LOAD NEXT
prepareCurrentParticipant();

updateTeacherUI();

await saveCompetitionState();

}

// ==========================================
// FINISH COMPETITION
// ==========================================

async function finishCompetition(){

updateTeacherStatus(
"Competition Finished"
);

await api({

action:"autoAdvanceStage",

competition_id:
competitionState.competition.id,

current_stage_number:
competitionState.stage.stage_number

});

setTimeout(()=>{

window.location =
"leaderboard.html";

},4000);

}

// ==========================================
// UPDATE UI
// ==========================================

function updateTeacherUI(){

const student =
competitionState.currentStudent;

if(!student)return;

// NAME
document.getElementById(
"studentName"
).innerText =
student.full_name;

// ROUND
document.getElementById(
"roundInfo"
).innerText =
`${competitionState.currentRound}/${competitionState.stage.total_rounds}`;

// WORD
document.getElementById(
"word"
).innerText =
competitionState.currentWord || "FINISHED";

// TIMER
updateTeacherTimer();

}

// ==========================================
// UPDATE TIMER
// ==========================================

function updateTeacherTimer(){

const timer =
document.getElementById("timer");

if(timer){

timer.innerText =
competitionState.timeLeft;

}

}

// ==========================================
// STATUS
// ==========================================

function updateTeacherStatus(text){

const el =
document.getElementById("status");

if(el){

el.innerText = text;

}

}

// ==========================================
// BUTTONS
// ==========================================

function disableVotingButtons(){

const ids = [
"correctBtn",
"wrongBtn",
"notspeltBtn"
];

ids.forEach(id=>{

const btn =
document.getElementById(id);

if(btn){

btn.disabled = true;

}

});

}

function enableVotingButtons(){

const ids = [
"correctBtn",
"wrongBtn",
"notspeltBtn"
];

ids.forEach(id=>{

const btn =
document.getElementById(id);

if(btn){

btn.disabled = false;

}

});

}

// ==========================================
// REALTIME SYNC
// ==========================================

function startRealtimeSync(){

setInterval(async()=>{

const res = await api({

action:"getCompetitionRealtime",

competition_id:
competitionState.competition.id

});

if(!res)return;

// ONLY UPDATE TIMER IF TEACHER
// IS NOT CURRENTLY RUNNING LOCAL TIMER

if(!competitionState.started){

competitionState.timeLeft =
res.time_left || 0;

competitionState.started =
res.started || false;

updateTeacherTimer();

}

},1000);

}

// ==========================================
// RESET
// ==========================================

async function hardResetCompetition(){

if(
!confirm(
"Reset whole competition?"
)
){
return;
}

await api({
action:"resetState"
});

location.reload();

}

// ==========================================
// AUTO START
// ==========================================

window.addEventListener(
"load",
initializeCompetition
);
