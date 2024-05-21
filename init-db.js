/* 
This file is only to be used for initializing the database
! NOTE: Normally I'd use a hosted database like MySQL or PostgreSQL, but for the sake of simplicity I'm using SQLite
 */
const bcrypt = require("bcrypt");
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
		"CREATE TABLE IF NOT EXISTS users (ID INTEGER PRIMARY KEY AUTOINCREMENT, username VARCHAR(255) NOT NULL UNIQUE, password BLOB NOT NULL, active BOOLEAN NOT NULL DEFAULT FALSE)"
	);
	const password = bcrypt.hashSync("admin", 10);
	db.run(
		`INSERT OR IGNORE INTO users (ID, username, password) VALUES (1, 'admin', '${password}')`
	);
});

db.serialize(() => {
	// Creates the rooms table
	db.run(
		"CREATE TABLE IF NOT EXISTS rooms (ID INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255) NOT NULL, description VARCHAR(255), private BOOLEAN NOT NULL DEFAULT FALSE, direct BOOLEAN NOT NULL DEFAULT FALSE)"
	);
	db.run(
		"INSERT OR IGNORE INTO rooms (ID, name, description) VALUES (1, 'General', 'General room')"
	);
	db.run(
		"INSERT OR IGNORE INTO rooms (ID, name, description) VALUES (2, 'Random', 'Random room')"
	);
	db.run(
		"INSERT OR IGNORE INTO rooms (ID, name, description, private) VALUES (3, 'Private', 'Private room', TRUE)"
	);
});

db.serialize(() => {
	// Creates the members table, this is a many to many table between users and rooms. It connects users to rooms
	db.run(
		"CREATE TABLE IF NOT EXISTS members (user_ID INTEGER NOT NULL, room_ID INTEGER NOT NULL, FOREIGN KEY(user_ID) REFERENCES users(ID), FOREIGN KEY(room_ID) REFERENCES rooms(ID))"
	);
	db.run(
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_membership ON members (user_ID, room_ID)"
	);
	db.run("INSERT OR IGNORE INTO members (user_ID, room_ID) VALUES (1, 1)");
	db.run("INSERT OR IGNORE INTO members (user_ID, room_ID) VALUES (1, 2)");
	db.run("INSERT OR IGNORE INTO members (user_ID, room_ID) VALUES (1, 3)");
});

db.serialize(() => {
	// Creates the chatmessages table, this stores the messages sent in rooms
	db.run(
		"CREATE TABLE IF NOT EXISTS messages (ID INTEGER PRIMARY KEY AUTOINCREMENT, room_ID INTEGER NOT NULL, sender_ID INTEGER NOT NULL, content TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(room_ID) REFERENCES rooms(ID), FOREIGN KEY(sender_ID) REFERENCES users(ID))"
	);
});

db.close();
