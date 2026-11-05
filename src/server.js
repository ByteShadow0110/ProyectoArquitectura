const app = require('./app');
const { port } = require('./config/env');
app.listen(port, () => console.log(`RefaccionesMX en http://localhost:${port}`));
