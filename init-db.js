const sqlite = require("sqlite3").verbose();
const db = new sqlite.Database("./database.db", (err) => {
	if (err) {
		console.error("Error opening database:", err.message);
	} else {
		console.log("Connected to the database.");
	}
});

db.serialize(() => {
	/*Creates the users table*/
	db.run(
		"CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username VARCHAR(255) NOT NULL UNIQUE, password BLOB NOT NULL)"
	);
});

db.close();
