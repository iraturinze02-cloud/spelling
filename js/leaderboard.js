async function load(){

const res=
await fetch(

"/.netlify/functions/spellingLeaderboard?refresh="+Date.now(),

{

method:"GET",

cache:"no-store",

headers:{

"Cache-Control":
"no-cache"

}

}

);

const data=
await res.json();

let round=
parseInt(

localStorage.getItem(
"currentRound"
) || 1

);


if(round<=3){

document.getElementById(
"title"
).innerText=

"YOUNG SPELLERS Contest Ranking at "
+ round-1;

}
else{

document.getElementById(
"title"
).innerText=

"YOUNG SPELLERS Contest Ranking";

document.getElementById(
"nextRoundBtn"
).style.display=
"none";

}


let html="";

data.leaderboard.forEach((s,i)=>{

let cls="";
let rank=i+1;


if(i===0){

cls="top1";
rank="🥇";

}

if(i===1){

cls="top2";
rank="🥈";

}

if(i===2){

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
).innerHTML=html;

}


let refreshing=false;

async function autoRefresh(){

if(refreshing){

return;

}

refreshing=true;

try{

await load();

}
catch(error){

console.log(error);

}

refreshing=false;

}

load();

setInterval(

autoRefresh,

1000

);
