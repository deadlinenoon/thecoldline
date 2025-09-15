export async function notifyNewUser(to: string, email: string){
  const subject = `New signup: ${email}`;
  const text = `A new user signed up: ${email}`;
  const sgKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM || to;
  if (sgKey){
    try{
      await fetch('https://api.sendgrid.com/v3/mail/send',{
        method:'POST',
        headers:{'Authorization':`Bearer ${sgKey}`,'Content-Type':'application/json'},
        body: JSON.stringify({
          personalizations:[{ to:[{email: to}] }],
          from:{ email: from },
          subject,
          content:[{ type:'text/plain', value:text }]
        })
      });
      return;
    }catch{}
  }
  // Fallback: log to stdout (and ignore failures)
  try{ console.log(`[notify] ${subject}`); }catch{}
}

export async function sendPasswordResetEmail(to: string, resetLink: string){
  const subject = `Reset your password`;
  const text = `Click the link to reset your password: ${resetLink}\nIf you did not request this, you can ignore this email.`;
  const sgKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM || to;
  if (sgKey){
    try{
      await fetch('https://api.sendgrid.com/v3/mail/send',{
        method:'POST',
        headers:{'Authorization':`Bearer ${sgKey}`,'Content-Type':'application/json'},
        body: JSON.stringify({
          personalizations:[{ to:[{email: to}] }],
          from:{ email: from },
          subject,
          content:[{ type:'text/plain', value:text }]
        })
      });
      return;
    }catch{}
  }
  // Fallback: log to stdout so operators can copy link
  try{ console.log(`[password-reset] ${to}: ${resetLink}`); }catch{}
}
