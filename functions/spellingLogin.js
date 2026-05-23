const sql =
require("./spellingDb");

exports.handler = async(event)=>{

try{

const body =
JSON.parse(event.body);

const users =
await sql`

SELECT *
FROM users

WHERE username=${body.username}
AND password=${body.password}

LIMIT 1

`;

if(users.length===0){

return{

statusCode:200,

body:JSON.stringify({

success:false

})

};

}

return{

statusCode:200,

body:JSON.stringify({

success:true,
user:users[0]

})

};

}
catch(error){

return{

statusCode:500,

body:JSON.stringify({

error:error.message

})

};

}

};
