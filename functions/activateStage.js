const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const body=
JSON.parse(event.body);

const stage_id=
body.stage_id;

/* deactivate all stages first */
await sql(
`
UPDATE competition_stages
SET status='inactive'
`
);

/* activate selected stage */
await sql(
`
UPDATE competition_stages
SET status='active'
WHERE id=$1
`,
[stage_id]
);

return{
statusCode:200,
body:JSON.stringify({
message:"Stage activated"
})
};

}
catch(error){

return{
statusCode:500,
body:JSON.stringify({message:error.message})
};

}

};
