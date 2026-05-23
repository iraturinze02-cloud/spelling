const sql=
require("./spellingDb");

exports.handler=
async()=>{

try{

await sql`

UPDATE competition_state

SET

currentstudent=0,

currentwordindex=0,

round=1,

score=0,

timeleft=0

WHERE id=1

`;


return{

statusCode:200,

body:JSON.stringify({

success:true

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
