const pool=require("./spellingDb");

exports.handler=async(event)=>{

try{

const body=
JSON.parse(event.body);

await pool.query(

`
DELETE FROM competitions

WHERE id=$1
`,

[
body.id
]

);

return{

statusCode:200,

body:JSON.stringify({

message:"Competition deleted"

})

};

}
catch(error){

return{

statusCode:500,

body:JSON.stringify({

message:error.message

})

};

}

};
