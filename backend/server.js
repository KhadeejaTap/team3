const env = require('dotenv').config();
const http = require('http');
const PORT = process.env.PORT || 5000;
const server = http.createServer((req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.statusCode = 200;
	res.end(JSON.stringify({ message: 'Server is running without Express!' }))
});
server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
