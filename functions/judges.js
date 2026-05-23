const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const method=
event.httpMethod;


/* =====================
GET ALL JUDGES
===================== */

if(method==="GET"){

const judges=
await sql`

SELECT

id,
full_name,
username

FROM users

WHERE role='judge'

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



/* =====================
POST ACTIONS
===================== */

const data=
JSON.parse(
event.body
);

const action=
data.action;



/* =====================
ADD JUDGE
===================== */

if(action==="add"){

const result=
await sql`

INSERT INTO users(

full_name,
username,
password,
role

)

VALUES(

${data.full_name},
${data.username},
${data.password},
'judge'

)

RETURNING *

`;

return{

statusCode:200,

body:JSON.stringify({

success:true,
result

})

};

}



/* =====================
UPDATE JUDGE
===================== */

if(action==="update"){

let result;


if(data.password){

result=
await sql`

UPDATE users

SET

full_name=
${data.full_name},

username=
${data.username},

password=
${data.password}

WHERE id=
${data.id}

AND role='judge'

RETURNING *

`;

}
else{

result=
await sql`

UPDATE users

SET

full_name=
${data.full_name},

username=
${data.username}

WHERE id=
${data.id}

AND role='judge'

RETURNING *

`;

}


return{

statusCode:200,

body:JSON.stringify({

success:true,
result

})

};

}



/* =====================
DELETE JUDGE
===================== */

if(action==="delete"){

await sql`

DELETE FROM users

WHERE id=
${data.id}

AND role='judge'

`;

return{

statusCode:200,

body:JSON.stringify({

success:true

})

};

}



return{

statusCode:400,

body:JSON.stringify({

success:false,
message:"Invalid action"

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
