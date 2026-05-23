async function loadStudents(){

const res=
await fetch(
"/.netlify/functions/getDrawStudents"
);

const data=
await res.json();

let html="";

data.students.forEach(student=>{

html+=`

<tr>

<td>${student.full_name}</td>

<td>${student.gender}</td>

<td>

${student.group_number ||

'<span class="notset">Not Set</span>'}

</td>

<td>

${student.draw_order ||

'<span class="notset">Not Set</span>'}

</td>

<td>

<button
class="edit"
onclick="openModal(
${student.id},
'${student.group_number || ""}',
'${student.draw_order || ""}'
)">

Edit

</button>

</td>

</tr>

`;

});

document.getElementById(
"studentList"
).innerHTML=html;

}



function openModal(

id,
group,
order

){

document.getElementById(
"studentId"
).value=id;

document.getElementById(
"drawNumber"
).value=group;

document.getElementById(
"drawOrder"
).value=order;

document.getElementById(
"modal"
).style.display="block";

}



function closeModal(){

document.getElementById(
"modal"
).style.display="none";

}



async function saveDraw(){

let data={

student_id:
document.getElementById(
"studentId"
).value,

group_number:
document.getElementById(
"drawNumber"
).value,

draw_order:
document.getElementById(
"drawOrder"
).value

};

await fetch(

"/.netlify/functions/assignDraw",

{

method:"POST",

headers:{

"Content-Type":
"application/json"

},

body:
JSON.stringify(data)

}

);

closeModal();

loadStudents();

}


loadStudents();
