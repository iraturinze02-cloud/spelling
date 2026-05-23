let editing=false;

async function loadStudents(){

const res=
await fetch(
"/.netlify/functions/spellingGetStudents"
);

const data=
await res.json();

let html="";

data.students.forEach(s=>{

html+=`

<tr>

<td>${s.full_name}</td>
<td>${s.gender}</td>
<td>${s.class_name}</td>

<td>

<button class="edit"
onclick="editStudent(
${s.id},
'${s.full_name}',
'${s.gender}',
'${s.class_name}'
)">

Edit

</button>


<button class="delete"
onclick="deleteStudent(${s.id})">

Delete

</button>

</td>

</tr>

`;

});

document.getElementById("list")
.innerHTML=html;

}


function openModal(){

editing=false;

document.getElementById("title")
.innerText="Add Student";

document.getElementById("modal")
.style.display="block";

}


function closeModal(){

document.getElementById("modal")
.style.display="none";

}


function editStudent(id,name,gender,cls){

editing=true;

document.getElementById("id").value=id;
document.getElementById("name").value=name;
document.getElementById("gender").value=gender;
document.getElementById("class").value=cls;

document.getElementById("title")
.innerText="Edit Student";

document.getElementById("modal")
.style.display="block";

}


async function saveStudent(){

let data={
id:document.getElementById("id").value,
full_name:document.getElementById("name").value,
gender:document.getElementById("gender").value,
class_name:document.getElementById("class").value
};

let url=editing
?"/.netlify/functions/spellingUpdateStudent"
:"/.netlify/functions/spellingAddStudent";

await fetch(url,{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify(data)
});

closeModal();
loadStudents();

}


async function deleteStudent(id){

await fetch(
"/.netlify/functions/spellingDeleteStudent",
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({id})
}
);

loadStudents();

}


loadStudents();
