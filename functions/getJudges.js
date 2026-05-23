const sql=require("./spellingDb");

exports.handler=async()=>{

try{

const judges=
await sql`

SELECT

id,
full_name,
username,
role

FROM users

WHERE

role='judge'

OR role='teacher'

ORDER BY id

`;

return{

statusCode:200,

body:JSON.stringify({

success:true,
judges

})

};

}

catch(error){

return{

statusCode:500,

body:JSON.stringify({

success:false,
error:error.message

})

};

}

};
