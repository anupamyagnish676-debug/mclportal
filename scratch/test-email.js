const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

function parseEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[match[1]] = value.trim();
    }
  });
  return env;
}

async function testEmail() {
  const env = parseEnv();
  const user = env.GMAIL_USER;
  const pass = env.GMAIL_PASS;

  if (!user || !pass) {
    console.error("Missing Gmail credentials in .env.local");
    return;
  }

  console.log(`Setting up transporter for ${user}...`);
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user,
      pass: pass,
    },
  });

  try {
    console.log("Sending test email...");
    const info = await transporter.sendMail({
      from: `"MCL Test" <${user}>`,
      to: user, // send to yourself
      subject: "MCL Email Configuration Test",
      text: "Hello! This is a test email to verify that emailing works on the MCL Internship Portal.",
      html: "<p>Hello! This is a test email to verify that emailing works on the MCL Internship Portal.</p>"
    });

    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);
  } catch (err) {
    console.error("Email failed to send:", err.message);
  }
}

testEmail();
