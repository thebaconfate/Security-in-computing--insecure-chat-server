/* 
This file is only to be used for initializing the database
! NOTE: Normally I'd use a hosted database like MySQL or PostgreSQL, but for the sake of simplicity I'm using SQLite
 */

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
