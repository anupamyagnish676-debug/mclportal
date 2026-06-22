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

async function run() {
  const env = parseEnv();
  const user = env.GMAIL_USER;
  const pass = env.GMAIL_PASS;

  if (!user || !pass) {
    console.error("Error: Missing Gmail credentials (GMAIL_USER / GMAIL_PASS) in .env.local");
    return;
  }

  // Get recipient email from command line argument, otherwise send to self
  const recipient = process.argv[2] || user;
  
  console.log(`Setting up Gmail SMTP transporter using sender: ${user}...`);
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  const testUser = {
    full_name: "Test Area Admin",
    email: recipient,
    password: "TempPassword123!",
    role: "admin",
    wing: "HRD & Administration",
    area: "Talcher"
  };

  const subject = `Welcome to MCL Portal — Login Credentials for Admin`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="background: #166534; padding: 24px 32px;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Mahanadi Coalfields Limited</h1>
        <p style="color: #bbf7d0; margin: 4px 0 0; font-size: 13px;">A Subsidiary of Coal India Limited</p>
      </div>
      <div style="padding: 32px;">
        <h2 style="color: #166534; margin-top: 0;">Portal Access Credentials</h2>
        <p>Dear <strong>${testUser.full_name}</strong>,</p>
        <p>You have been registered as an **${testUser.role.charAt(0).toUpperCase() + testUser.role.slice(1)}** on the <strong>Mahanadi Coalfields Limited Internship Portal</strong>.</p>
        <p>Below are your credentials to log in and access your dashboard:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f0fdf4;">
            <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600; width: 40%;">Name</td>
            <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${testUser.full_name}</td>
          </tr>
          <tr>
            <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Assigned Role</td>
            <td style="padding: 10px 16px; border: 1px solid #e5e7eb; text-transform: capitalize;">${testUser.role}</td>
          </tr>
          <tr style="background: #f0fdf4;">
            <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Wing / Department</td>
            <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${testUser.wing}</td>
          </tr>
          <tr>
            <td style="padding: 10px 16px; border: 1px solid #e5e7eb; font-weight: 600;">Office / Area Location</td>
            <td style="padding: 10px 16px; border: 1px solid #e5e7eb;">${testUser.area} Area</td>
          </tr>
        </table>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #374151;">Portal Login Credentials</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Email:</strong> ${testUser.email}</p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Password:</strong> ${testUser.password}</p>
          <p style="margin: 8px 0 0; font-size: 14px;"><strong>Portal Link:</strong> <a href="https://mclportal-anupamyagnish676-4942s-projects.vercel.app" style="color: #166534; text-decoration: underline; font-weight: 600;">Click here to access the Portal</a></p>
          <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">Please change your password after logging in for the first time.</p>
        </div>

        <p>You can access the portal via: <a href="https://mclportal-anupamyagnish676-4942s-projects.vercel.app" style="color: #166534; text-decoration: underline; font-weight: 600;">https://mclportal-anupamyagnish676-4942s-projects.vercel.app</a></p>
        <p>Thank you for your service and dedication.</p>

        <br/>
        <p style="margin: 0;">Regards,</p>
        <p style="margin: 4px 0;"><strong>Training & Development Department</strong></p>
        <p style="margin: 4px 0; color: #6b7280;">Mahanadi Coalfields Limited</p>
      </div>
      <div style="background: #f9fafb; padding: 12px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="margin: 0; font-size: 11px; color: #9ca3af;">This is an automated email from the MCL Internship Portal. Please do not reply.</p>
      </div>
    </div>
  `;

  try {
    console.log(`Sending credentials email to ${recipient}...`);
    const info = await transporter.sendMail({
      from: `"MCL Internship Portal" <${user}>`,
      to: recipient,
      subject: subject,
      html: htmlContent
    });

    console.log("\nSuccess! Email sent successfully.");
    console.log("Message ID:", info.messageId);
    console.log("SMTP Response:", info.response);
    console.log(`\nPlease check the inbox of ${recipient} (and the Spam folder) to verify reception.`);
  } catch (err) {
    console.error("\nFailed to send email:", err.message);
  }
}

run();
