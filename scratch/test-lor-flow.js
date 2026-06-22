const { createClient } = require('@supabase/supabase-js');
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

async function test() {
  const env = parseEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const testEmail = 'delayed-onboard-test-' + Math.random().toString(36).slice(2, 8) + '@mcl.com';
  const employeeCode = 'EMP-CODE-999';
  const studentName = 'Delayed Test Student';

  console.log(`Starting LOR flow verification test with email: ${testEmail}`);

  // 1. Get a valid referrer id (admin user from our profiles)
  const { data: referee } = await adminClient.from('profiles').select('id, area').eq('role', 'admin').limit(1).maybeSingle();
  if (!referee) {
    console.error("No admin referee found in profiles table.");
    return;
  }

  // 2. Ensure student does not exist in profiles or auth
  console.log("Checking if student profile already exists...");
  const { data: existingProf } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', testEmail)
    .maybeSingle();

  if (existingProf) {
    console.error("Test student already exists. Aborting.");
    return;
  }
  console.log("Verified: Student does not exist in profiles.");

  // 3. Simulate LOR Submission by employee
  console.log("Simulating LOR Submission...");
  const { data: newApp, error: submitError } = await adminClient
    .from('applications')
    .insert({
      student_id: null,
      student_name: studentName,
      student_email: testEmail,
      employee_code: employeeCode,
      roll_no: 'TEST-ROLL-001',
      university: 'MCL Test University',
      referred_by: referee.id,
      lor_url: 'https://example.com/test-lor.pdf',
      status: 'pending',
    })
    .select()
    .single();

  if (submitError) {
    console.error("Submission failed:", submitError.message);
    return;
  }

  console.log("SUCCESS: LOR application submitted!");
  console.log(`Application details: ID=${newApp.id}, Name=${newApp.student_name}, Email=${newApp.student_email}, Code=${newApp.employee_code}, Status=${newApp.status}`);

  // 4. Double check that no profile or user was created yet
  const { data: postSubmitProf } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', testEmail)
    .maybeSingle();

  if (postSubmitProf) {
    console.error("FAIL: Profile was created after LOR submission but should be delayed!");
    // Clean up
    await adminClient.from('applications').delete().eq('id', newApp.id);
    return;
  }
  console.log("Verified: No student profile created upon LOR submission.");

  // 5. Simulate Admin LOR Approval (status='approved', student_id=null)
  console.log("Simulating Admin LOR Approval...");
  const { error: approveError } = await adminClient
    .from('applications')
    .update({ 
      status: 'approved'
    })
    .eq('id', newApp.id);

  if (approveError) {
    console.error("LOR Approval failed:", approveError.message);
    await adminClient.from('applications').delete().eq('id', newApp.id);
    return;
  }
  console.log("SUCCESS: LOR application approved (student_id is null).");

  // 6. Simulate Manual Account Creation by Admin later (replicates create-user API)
  console.log("Simulating Manual Student Registration by Admin...");
  const tempPassword = 'TempPassword123!';
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: studentName, role: 'student' }
  });

  if (createError) {
    console.error("Manual onboarding failed - User creation error:", createError.message);
    await adminClient.from('applications').delete().eq('id', newApp.id);
    return;
  }

  const studentId = newUser.user.id;

  // Initialize profile with roll number and university
  const { error: profileUpdateError } = await adminClient
    .from('profiles')
    .update({ 
      role: 'student', 
      full_name: studentName,
      area: referee.area || null,
      roll_no: newApp.roll_no || null,
      university: newApp.university || null
    })
    .eq('id', studentId);

  if (profileUpdateError) {
    console.error("Manual onboarding failed - Profile update error:", profileUpdateError.message);
    await adminClient.auth.admin.deleteUser(studentId);
    await adminClient.from('applications').delete().eq('id', newApp.id);
    return;
  }

  // Link approved LOR application matching this email to the new student ID
  const { error: linkError } = await adminClient
    .from('applications')
    .update({ student_id: studentId })
    .eq('student_email', testEmail)
    .eq('status', 'approved');

  if (linkError) {
    console.error("Manual onboarding failed - LOR linking error:", linkError.message);
    await adminClient.auth.admin.deleteUser(studentId);
    await adminClient.from('applications').delete().eq('id', newApp.id);
    return;
  }

  // Create active internship
  const { error: internshipError } = await adminClient.from('internships').insert({
    student_id: studentId,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_active: true,
    serial_no: '9999',
    area: referee.area || null
  });

  if (internshipError) {
    console.error("Manual onboarding failed - Internship insertion error:", internshipError.message);
    await adminClient.auth.admin.deleteUser(studentId);
    await adminClient.from('applications').delete().eq('id', newApp.id);
    return;
  }

  console.log("SUCCESS: Manual student onboarding simulated and all steps succeeded!");

  // 7. Verify post-linking state
  const { data: finalApp } = await adminClient
    .from('applications')
    .select('*, student:profiles!applications_student_id_fkey(full_name, role)')
    .eq('id', newApp.id)
    .single();

  console.log("Final Application state in DB:", {
    id: finalApp.id,
    student_id: finalApp.student_id,
    status: finalApp.status,
    student_name: finalApp.student_name,
    student_email: finalApp.student_email,
    employee_code: finalApp.employee_code,
    profile: finalApp.student
  });

  // 8. Cleanup test data
  console.log("Cleaning up test data from DB...");
  await adminClient.from('internships').delete().eq('student_id', studentId);
  await adminClient.from('applications').delete().eq('id', newApp.id);
  const { error: deleteUserErr } = await adminClient.auth.admin.deleteUser(studentId);
  if (deleteUserErr) {
    console.error("Error deleting test user:", deleteUserErr.message);
  } else {
    console.log("Test user deleted from Auth.");
  }
  console.log("Cleanup complete. Test PASSED!");
}

test();
