const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const body =
event.body
? JSON.parse(event.body)
: {};

const full_name =
body.full_name?.trim();

const class_name =
body.class_name?.trim() || "";


if(!full_name){

return{

statusCode:400,

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

success:false,
message:"Student name required"

})

};

}


const existing =
await sql`

SELECT id
FROM students
WHERE LOWER(full_name)
=
LOWER(${full_name})

`;


if(existing.length>0){

return{

statusCode:400,

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

success:false,
message:"Student already exists"

})

};

}


const student =
await sql`

INSERT INTO students(

full_name,
class_name

)

VALUES(

${full_name},
${class_name}

)

RETURNING *

`;


return{

statusCode:200,

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

success:true,
student

})

};

}

catch(error){

console.log(error);

return{

statusCode:500,

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

success:false,
error:error.message

})

};

}

};
