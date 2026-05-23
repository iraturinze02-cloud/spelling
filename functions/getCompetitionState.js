const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const competition_id=
event.queryStringParameters.competition_id;

const result=
await sql(
`
SELECT *
FROM competition_state
WHERE competition_id=$1
LIMIT 1
`,
[competition_id]
);

return{
statusCode:200,
body:JSON.stringify({
state:result[0] || null
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
