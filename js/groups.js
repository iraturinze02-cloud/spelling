async function addGroupBox(){

const div=
document.createElement("div");

div.className="card";

div.innerHTML=`

<h3>New Group</h3>

<input placeholder="Word 1">
<input placeholder="Word 2">
<input placeholder="Word 3">
<input placeholder="Word 4">
<input placeholder="Word 5">
<input placeholder="Word 6">
<input placeholder="Word 7">
<input placeholder="Word 8">
<input placeholder="Word 9">

<button
class="save"
onclick="saveGroup(this)">

Save Group

</button>

`;

document
.getElementById(
"groups"
)
.prepend(div);

}



async function saveGroup(btn){

try{

const card=
btn.parentElement;

const inputs=
card.querySelectorAll(
"input"
);

let words=[];

inputs.forEach(i=>{

if(
i.value.trim()!==""
){

words.push(
i.value.trim()
);

}

});


if(words.length!==9){

alert(
"Please enter all 9 words"
);

return;

}


const response=
await fetch(

"/.netlify/functions/createWordGroup",

{

method:"POST",

headers:{

"Content-Type":
"application/json"

},

body:
JSON.stringify({

words:words

})

}

);


const data=
await response.json();


if(data.success){

alert(

"Group "+

data.group.group_number+

" created"

);

loadGroups();

}

else{

alert(
data.error
);

}

}

catch(error){

console.log(error);

alert(
"Error creating group"
);

}

}



async function loadGroups(){

try{

const res=
await fetch(

"/.netlify/functions/getWordGroups"

);

const data=
await res.json();

let container=
document.getElementById(
"groups"
);

container.innerHTML="";


data.groups.forEach(group=>{

const div=
document.createElement("div");

div.className=
"card";

div.innerHTML=`

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


loadGroups();
