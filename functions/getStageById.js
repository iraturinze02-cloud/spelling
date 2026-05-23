const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const id=
event.queryStringParameters.id;

const result=
await sql(
`
SELECT *
FROM competition_stages
WHERE id=$1
LIMIT 1
`,
[id]
);

return{
statusCode:200,
body:JSON.stringify({
stage:result[0] || null
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
