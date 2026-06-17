const emails = [
  'pacific.uwitonze112@gmail.com',
  'pacific.uwitonze@gmail.com',
  'pacific.uwitonze2003@gmail.com'
];
const password = 'Uwitonze@2003';

async function check() {
  for (const email of emails) {
    try {
      const res = await fetch('http://192.168.0.185:8080/api/remote/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      console.log(`\nEmail: ${email}`);
      console.log(`Response:`, data);
    } catch (err) {
      console.log(`\nEmail: ${email} -> Error:`, err.message);
    }
  }
}
check();
