const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const body=
JSON.parse(
event.body
);

if(
!body.words ||
body.words.length!==9
){

throw new Error(
"Exactly 9 words required"
);

}


// DB generates number automatically
const group=
await sql`

INSERT INTO word_groups
DEFAULT VALUES
RETURNING *

`;

for(const word of body.words){

await sql`

INSERT INTO words(

group_id,
word

)

VALUES(

${group[0].id},
${word}

)

`;

}

return{

statusCode:200,

body:JSON.stringify({

success:true,
group:group[0]

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
