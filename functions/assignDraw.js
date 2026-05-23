const sql=require("./spellingDb");

exports.handler=async(event)=>{

try{

const body=
JSON.parse(event.body);

const group=
await sql`

SELECT id

FROM word_groups

WHERE group_number=
${body.group_number}

`;

if(group.length===0){

throw new Error(
"Group not found"
);

}

await sql`

INSERT INTO student_draws(

student_id,
group_id,
draw_order

)

VALUES(

${body.student_id},
${group[0].id},
${body.draw_order}

)

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
