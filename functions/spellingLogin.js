import { neon } from "@neondatabase/serverless";

export async function onRequest(context){

try{

const sql =
neon(context.env.NEON_URL);

const body =
await context.request.json();

const users =
await sql`

SELECT *
FROM users

WHERE username=${body.username}
AND password=${body.password}

LIMIT 1

`;

if(users.length===0){

return Response.json({

success:false

});

}

return Response.json({

success:true,
user:users[0]

});

}

catch(error){

return Response.json({

error:error.message

},

{status:500}

);

}

}
