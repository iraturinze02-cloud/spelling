const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const body=
JSON.parse(event.body);

await sql`

DELETE FROM students
WHERE id=${body.id}

`;

return{

statusCode:200,

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

success:true,
message:"Student deleted"

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
