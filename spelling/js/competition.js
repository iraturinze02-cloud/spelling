// ==========================================
// PROFESSIONAL SPELLING COMPETITION ENGINE
// competition.js
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
// GLOBAL STATE
// ==========================================

let realtimeTimer = null;

let backgroundMusic = new Audio();

let competitionState = {

competition:null,

stage:null,

students:[],

wordGroups:[],

words:[],

currentStudentIndex:0,

currentRound:1,

currentWordIndex:0,

currentStudent:null,

currentWord:"",

timeLeft:0,

usedTime:0,

started:false

};

// ==========================================
// AUDIO HELPERS
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

function stopAllSounds(){

Object.values(sounds).forEach(sound=>{

sound.pause();
sound.currentTime = 0;

});

}

// ==========================================
// INITIALIZE
// ==========================================

window.addEventListener(
"load",
initializeCompetition
);

async function initializeCompetition(){

try{

// ACTIVE COMPETITION
const competitionRes = await api({
action:"getActiveCompetition"
});

competitionState.competition =
competitionRes?.competition || null;

if(!competitionState.competition){

updateTeacherStatus(
"No active competition"
);

return;

}

// SHOW COMPETITION NAME
document.getElementById(
"competitionTitle"
).innerText =
competitionState.competition.competition_name;

// ACTIVE STAGE
const stageRes = await api({

action:"getActiveStage",

competition_id:
competitionState.competition.id

});

competitionState.stage =
stageRes?.stage || null;

if(!competitionState.stage){

updateTeacherStatus(
"No active stage"
);

return;

}

// SHOW STAGE
document.getElementById(
"stageTitle"
).innerText =
`Stage ${competitionState.stage.stage_number} • ${competitionState.stage.stage_name}`;

// LOAD STUDENTS
const studentsRes = await api({

action:"getStudents",

competition_id:
competitionState.competition.id,

stage_number:
competitionState.stage.stage_number

});

competitionState.students =
studentsRes?.students || [];

// LOAD WORD GROUPS
const wordsRes = await api({
action:"getWordGroups"
});

competitionState.wordGroups =
wordsRes?.groups || [];

// RESTORE SAVED STATE
await restoreCompetitionState();

// PREPARE CURRENT STUDENT
prepareCurrentParticipant();

// START REALTIME SYNC
startRealtimeSync();

// UPDATE STATUS
updateTeacherStatus(
"Competition Ready"
);

}
catch(error){

console.log(error);

updateTeacherStatus(
"Failed to initialize"
);

}

}

// ==========================================
// PREPARE PARTICIPANT
// ==========================================

function prepareCurrentParticipant(){

const student =
competitionState.students[
competitionState.currentStudentIndex
];

competitionState.currentStudent =
student || null;

if(!student){

document.getElementById(
"studentName"
).innerText = "No Participant";

document.getElementById(
"word"
).innerText = "READY";

return;

}

// DISPLAY STUDENT
document.getElementById(
"studentName"
).innerText =
student.full_name;

// FIND WORD GROUP
const group =
competitionState.wordGroups.find(
g => g.group_number == student.group_number
);

competitionState.words =
group?.words || [];

// PREPARE WORD
prepareCurrentWord();

}

// ==========================================
// PREPARE WORD
// ==========================================

function prepareCurrentWord(){

const stage =
competitionState.stage;

if(!stage)return;

const index =
(
(
competitionState.currentRound - 1
)
*
stage.words_per_round
)
+
competitionState.currentWordIndex;

const word =
competitionState.words[index];

competitionState.currentWord =
word || "FINISHED";

// DISPLAY WORD
document.getElementById(
"word"
).innerText =
competitionState.currentWord;

// ROUND INFO
document.getElementById(
"roundInfo"
).innerText =
`${competitionState.currentRound}/${stage.total_rounds}`;

// TIMER
competitionState.timeLeft =
calculateAllowedTime(
competitionState.currentWord
);

updateTeacherTimer();

disableVotingButtons();

}

// ==========================================
// CALCULATE TIME
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

async function startWord(){

if(competitionState.started)return;

competitionState.started = true;

competitionState.usedTime = 0;

disableVotingButtons();

updateTeacherStatus(
"Timer Running"
);

await saveCompetitionState();

realtimeTimer = setInterval(async()=>{

competitionState.timeLeft--;

competitionState.usedTime++;

updateTeacherTimer();

playSound(sounds.tick);

// HALF WAY SOUND
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

// TIME FINISHED
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

await saveCompetitionState();

},1000);

}

// ==========================================
// STOP TIMER
// ==========================================

async function stopTimer(){

clearInterval(realtimeTimer);

competitionState.started = false;

stopAllSounds();

enableVotingButtons();

updateTeacherStatus(
"Voting Open"
);

await saveCompetitionState();

}

// ==========================================
// SUBMIT VOTE
// ==========================================

async function submitVote(vote){

try{

const student =
competitionState.currentStudent;

if(!student)return;

await api({

action:"saveJudgeVote",

competition_id:
competitionState.competition.id,

stage_number:
competitionState.stage.stage_number,

student_id:
student.id,

word:
competitionState.currentWord,

vote,

judge_type:"teacher",

used_time:
competitionState.usedTime

});

updateTeacherStatus(
`Vote Submitted: ${vote}`
);

}
catch(error){

console.log(error);

}

}

// ==========================================
// FINALIZE RESULT
// ==========================================

async function finalizeResult(){

try{

const student =
competitionState.currentStudent;

if(!student)return;

const result = await api({

action:"finalizeVotes",

competition_id:
competitionState.competition.id,

stage_number:
competitionState.stage.stage_number,

student_id:
student.id,
round_number: competitionState.currentRound

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

const score =
Number(result.score || 0);

// ROUND SCORE
let roundScore =
Number(
document.getElementById(
"roundScore"
).innerText || 0
);

roundScore += score;

document.getElementById(
"roundScore"
).innerText =
roundScore.toFixed(2);

// TOTAL SCORE
let totalScore =
Number(
document.getElementById(
"totalScore"
).innerText || 0
);

totalScore += score;

document.getElementById(
"totalScore"
).innerText =
totalScore.toFixed(2);

// SOUNDS
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

disableVotingButtons();

updateTeacherStatus(
`Final Result: ${result.final_status.toUpperCase()}`
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

async function nextWord(){

competitionState.currentWordIndex++;

const stage =
competitionState.stage;

// ROUND COMPLETE
if(
competitionState.currentWordIndex >=
stage.words_per_round
){

competitionState.currentWordIndex = 0;

competitionState.currentStudentIndex++;

playSound(
sounds.roundFinish
);

// ALL PARTICIPANTS COMPLETE
if(
competitionState.currentStudentIndex >=
competitionState.students.length
){

competitionState.currentStudentIndex = 0;

competitionState.currentRound++;

// COMPETITION COMPLETE
if(
competitionState.currentRound >
stage.total_rounds
){

playSound(
sounds.competitionFinish
);

updateTeacherStatus(
"Competition Finished"
);

setTimeout(()=>{

window.location =
"leaderboard.html";

},3000);

return;

}

}

}

// RESET
competitionState.started = false;

competitionState.usedTime = 0;

competitionState.timeLeft = 0;

// LOAD NEXT
prepareCurrentParticipant();

await saveCompetitionState();

updateTeacherStatus(
"Next Word Ready"
);

}

// ==========================================
// NEXT PARTICIPANT
// ==========================================

async function nextParticipant(){

competitionState.currentStudentIndex++;

competitionState.currentWordIndex = 0;

// RESET ROUND SCORE
document.getElementById(
"roundScore"
).innerText = "0";

// ALL PARTICIPANTS FINISHED
if(
competitionState.currentStudentIndex >=
competitionState.students.length
){

competitionState.currentStudentIndex = 0;

competitionState.currentRound++;

if(
competitionState.currentRound >
competitionState.stage.total_rounds
){

updateTeacherStatus(
"Competition Finished"
);

window.location =
"leaderboard.html";

return;

}

}

prepareCurrentParticipant();

await saveCompetitionState();

updateTeacherStatus(
"Next Participant Ready"
);

}

// ==========================================
// RESET PARTICIPANT
// ==========================================

function resetParticipant(){

competitionState.currentWordIndex = 0;

document.getElementById(
"roundScore"
).innerText = "0";

prepareCurrentParticipant();

updateTeacherStatus(
"Participant Reset"
);

}

// ==========================================
// RESET COMPETITION
// ==========================================

async function resetCompetition(){

const confirmed = confirm(
"Reset competition?"
);

if(!confirmed)return;

await api({
action:"resetState"
});

location.reload();

}

// ==========================================
// SAVE STATE
// ==========================================

async function saveCompetitionState(){

if(
!competitionState.competition ||
!competitionState.stage
){
return;
}

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
document.getElementById(
"roundScore"
).innerText || 0,

participant_done:false

});

}

// ==========================================
// RESTORE STATE
// ==========================================

async function restoreCompetitionState(){

const res = await api({

action:"getCompetitionState",

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
// REALTIME SYNC
// ==========================================

function startRealtimeSync(){

setInterval(async()=>{

if(
!competitionState.competition
){
return;
}

const res = await api({

action:"getCompetitionState",

competition_id:
competitionState.competition.id

});

if(!res)return;

if(!competitionState.started){

competitionState.timeLeft =
res.time_left || 0;

updateTeacherTimer();

}

},1000);

}

// ==========================================
// UI HELPERS
// ==========================================

function updateTeacherTimer(){

const timer =
document.getElementById("timer");

if(timer){

timer.innerText =
competitionState.timeLeft;

}

}

function updateTeacherStatus(text){

const status =
document.getElementById("status");

if(status){

status.innerText = text;

}

}

// ==========================================
// VOTING BUTTONS
// ==========================================

function disableVotingButtons(){

[
"correctBtn",
"wrongBtn",
"notspeltBtn"
]
.forEach(id=>{

const btn =
document.getElementById(id);

if(btn){

btn.disabled = true;

}

});

}

function enableVotingButtons(){

[
"correctBtn",
"wrongBtn",
"notspeltBtn"
]
.forEach(id=>{

const btn =
document.getElementById(id);

if(btn){

btn.disabled = false;

}

});

}

// ==========================================
// MUSIC
// ==========================================

function toggleMusicPanel(){

const panel =
document.getElementById(
"musicPanel"
);

panel.style.display =
panel.style.display === "block"
? "none"
: "block";

}

function playMusic(src){

backgroundMusic.pause();

backgroundMusic =
new Audio(src);

backgroundMusic.loop = true;

backgroundMusic.play();

}

function stopMusic(){

backgroundMusic.pause();

}

// ==========================================
// NAVIGATION
// ==========================================

function goHome(){

window.location =
"teacher-home.html";

}

function goLeaderboard(){

window.location =
"leaderboard.html";

}
