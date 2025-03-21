const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const { Pool } = require('pg');

const TOKEN = 'MTM1MjY5Mjg5NjEyOTc0NTAwOA.GTpz7m.woRBrXFJfvoDQphRtoxvp3Asip3Z9zlqd_lnTA'; // Replace with your bot token
const WEBHOOK_URL = 'https://discordapp.com/api/webhooks/1352692478742102130/4g-3ivgXnETwKxj3VTR5ZmnWkQDEc0xiuAn-eFocTcoa0kRo-pC5Ek-1D22lYUHcQZG-'; // Replace with your webhook URL
const DATABASE_URL = 'postgresql://neondb_owner:npg_cv2HCA0SfmpX@ep-dry-poetry-a5ozjr6h-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'; // Replace with your PostgreSQL URL
const PORT = 3000;

// Initialize PostgreSQL pool
const pool = new Pool({
connectionString: DATABASE_URL,
});

// Function to log events to Discord webhook
const sendLogToWebhook = async (message) => {
const timestamp = new Date().toISOString();
const logMessage = `[${timestamp}] ${message}`;

try {
await axios.post(WEBHOOK_URL, {
content: logMessage,
});
} catch (error) {
console.error('Failed to send log to webhook:', error.message);
}
};

// Initialize Discord bot
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Ensure the database tables exist (only users table)
(async () => {
try {
const client = await pool.connect();

await client.query(`
CREATE TABLE IF NOT EXISTS users (
discord_id TEXT PRIMARY KEY,
username TEXT UNIQUE NOT NULL,
password TEXT NOT NULL
);
`);

sendLogToWebhook('Connected to PostgreSQL database and ensured tables exist.');
client.release();
} catch (error) {
console.error('Error setting up the database:', error.message);
sendLogToWebhook('Error setting up the database: ' + error.message);
}
})();

// Slash command registration (only register command)
const commands = [
{
name: 'register',
description: 'Register with a username and password.',
options: [
{
name: 'username',
type: 3, // STRING
description: 'Your desired username.',
required: true,
},
{
name: 'password',
type: 3, // STRING
description: 'Your desired password.',
required: true,
},
],
},
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
try {
console.log('Registering slash commands...');
sendLogToWebhook('Registering slash commands...');
await rest.put(Routes.applicationCommands('1352692896129745008'), { body: commands });
console.log('Slash commands registered.');
sendLogToWebhook('Slash commands registered.');
} catch (error) {
console.error('Error registering slash commands:', error);
sendLogToWebhook('Error registering slash commands: ' + error.message);
}
})();

// Bot event listeners
client.on('ready', () => {
console.log(`Logged in as ${client.user.tag}!`);
sendLogToWebhook(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async (interaction) => {
if (!interaction.isCommand()) return;

const { commandName, options, member, user } = interaction;

if (commandName === 'register') {
// Check if the user has the required role
const requiredRoleId = '1352697022041423996';

if (!member.roles.cache.has(requiredRoleId)) {
// Log the attempt and inform the user
sendLogToWebhook(`User ${user.id} attempted to register without the required role.`);
return interaction.reply({
content: 'You must have the required role to use this command.',
ephemeral: true,
});
}

// Proceed with registration if the user has the role
const username = options.getString('username');
const password = options.getString('password');

try {
const res = await pool.query('SELECT * FROM users WHERE discord_id = $1', [user.id]);
if (res.rows.length > 0) {
sendLogToWebhook(`User ${user.id} attempted to register but is already registered.`);
return interaction.reply({ content: 'You are already registered.', ephemeral: true });
}

await pool.query('INSERT INTO users (discord_id, username, password) VALUES ($1, $2, $3)', [
user.id,
username,
password,
]);

sendLogToWebhook(`User ${user.id} registered successfully with username ${username}.`);
interaction.reply({ content: 'Registration successful!', ephemeral: true });
} catch (error) {
console.error('Error during registration:', error.message);
sendLogToWebhook(`Error during registration for user ${user.id}: ${error.message}`);
interaction.reply({ content: 'Registration failed. Username might already be taken.', ephemeral: true });
}
}
});


// Express.js server setup
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Login endpoint
// Login endpoint
app.post('/login', async (req, res) => {
const { username, password } = req.body;

if (!username || !password) {
return res.status(400).json({ success: false, message: 'Username and password are required.' });
}

const userIp = req.ip; // Capture the IP address

try {
const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [
username,
password,
]);

if (result.rows.length === 0) {
sendLogToWebhook(`Failed login attempt for username ${username} from IP ${userIp}`);
return res.status(401).json({ success: false, message: 'Invalid username or password.' });
}

sendLogToWebhook(`User ${result.rows[0].discord_id} successfully logged in with username ${username} from IP ${userIp}`);
res.json({ success: true, message: 'Login successful', token: 'mock-jwt-token' });
} catch (error) {
console.error('Error during login:', error.message);
sendLogToWebhook(`Error during login attempt for username ${username} from IP ${userIp}: ${error.message}`);
res.status(500).json({ success: false, message: 'An error occurred.' });
}
});


// Start the server
app.listen(PORT, () => {
console.log(`Server is running on http://localhost:${PORT}`);
sendLogToWebhook(`Express server started on http://localhost:${PORT}`);
});

// Login the Discord bot
client.login(TOKEN);
