export default {
async fetch(request, env) {
if (request.method === “OPTIONS”) {
return new Response(null, {
headers: {
“Access-Control-Allow-Origin”: “*”,
“Access-Control-Allow-Methods”: “POST, OPTIONS”,
“Access-Control-Allow-Headers”: “Content-Type”,
},
});
}


if (request.method !== "POST") {
  return new Response("Method not allowed", { status: 405 });
}

try {
  const data = await request.json();
  const email = data.email;
  const password = data.password;

  if (!email || !email.includes("@")) {
    return new Response(
      JSON.stringify({ error: "Invalid email address" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const result = await env.DB.prepare(
    "INSERT INTO users (email, password) VALUES (?, ?)"
  )
    .bind(email, password)
    .run();

  if (result.success) {
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Registration successful!" 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

} catch (error) {
  if (error.message.includes("UNIQUE")) {
    return new Response(
      JSON.stringify({ error: "Email already registered" }),
      {
        status: 409,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  return new Response(
    JSON.stringify({ error: "Registration failed" }),
    {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}


},
};