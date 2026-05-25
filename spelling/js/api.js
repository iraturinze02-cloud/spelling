
// =====================================
// GLOBAL API HELPER
// Cloudflare Pages Function API
// =====================================

async function api(data){

try{

const response = await fetch("/api",{
method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify(data)

});

const result = await response.json();

if(!response.ok){

console.log("API ERROR:",result);

alert(result.error || result.message || "Request failed");

return null;

}

return result;

}
catch(error){

console.log("NETWORK ERROR:",error);

alert("Network error");

return null;

}

}
