const sql=require("./spellingDb");

exports.handler=async()=>{

try{

const result=
await sql(
`
SELECT *
FROM competition_stages
WHERE status='active'
LIMIT 1
`
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
