const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\KIIT0001\\.gemini\\antigravity\\brain\\723f9667-279d-4191-807a-9868de21af29\\.system_generated\\tasks\\task-1783.log';

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  console.log("Searching for CREATE-USER email logs...");
  lines.forEach((line, index) => {
    if (/CREATE-USER|nodemailer|smtp/i.test(line)) {
      console.log(`Line ${index + 1}: ${line}`);
    }
  });
} else {
  console.log('Log file does not exist');
}
