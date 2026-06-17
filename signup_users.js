const fetch = require('node-fetch'); // wait, node 18 has global fetch. we can just use fetch

const users = [
  {
    email: 'pacific.uwitonze@gmail.com',
    password: 'Uwitonze@2003',
    firstName: 'Pacific',
    lastName: 'Photographer',
    phone: '+250788000001',
    customerType: 'Photographer'
  },
  {
    email: 'pacific.uwitonze2003@gmail.com',
    password: 'Uwitonze@2003',
    firstName: 'Pacific',
    lastName: 'Coordinator',
    phone: '+250788000002',
    customerType: 'Coordinator'
  }
];

async function signup() {
  for (const user of users) {
    try {
      const res = await fetch('http://192.168.0.185:8080/api/remote/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      const data = await res.json();
      console.log(`\nSignup ${user.customerType} (${user.email}):`, data);
    } catch (err) {
      console.log(`\nError signing up ${user.email}:`, err.message);
    }
  }
}
signup();
