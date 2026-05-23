const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const body=
JSON.parse(event.body);

const updated=
await sql`

UPDATE students
SET

full_name=${body.full_name},

gender=${body.gender},

class_name=${body.class_name}

WHERE id=${body.id}

RETURNING *

`;

return{

statusCode:200,

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

success:true,
student:updated[0]

})

};

}

catch(error){

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
