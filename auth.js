const bcrypt = require("bcrypt");
const Database = require("./database.js");
const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY || "Not-so-secret-secret-key";
const TOKEN_EXPIRATION_TIME = process.env.TOKEN_EXPIRATION_TIME || "1h";
const ALGORITHM = process.env.ALGORITHM || "HS512";

class Auth {
	#database;
	#salt = 10;
	constructor(database = new Database()) {
		this.#database = database;
	}

	registerUser(username, password, callback) {
		const hash = bcrypt.hashSync(password, this.#salt);
		this.#database.registerUser(username, hash, callback);
	}

	authenticateUser(username, password, successCallback, failCallback) {
		console.log(this.#database);
		this.#database.getUser(
			username,
			function (err, row) {
				if (err || !row) {
					console.log(
						"Error getting user from database:",
						err.message || "User not found"
					);
					failCallback();
				} else if (bcrypt.compareSync(password, row.password)) {
					successCallback(row);
				} else {
					failCallback();
				}
			} /* It took me so long to figure out that anonymous functions and arrow functions
             have different scoping rules. 'this' doesn't behave like I'm used to. I don't like JS */
		);
	}

	generateJWT(userID, username, successCallback, failCallback) {
		jwt.sign(
			{
				ID: userID,
				username: username,
			},
			SECRET_KEY,
			{ expiresIn: TOKEN_EXPIRATION_TIME, algorithm: ALGORITHM },
			function (err, token) {
				if (err) {
					failCallback();
				} else {
					successCallback(token);
				}
			}
		);
	}

	verifyJWT(token, successCallback, failCallback) {
		jwt.verify(
			token,
			SECRET_KEY,
			{
				algorithms: [ALGORITHM],
			},
			function (err, decoded) {
				if (err) {
					failCallback();
				} else {
					successCallback(decoded);
				}
			}
		);
	}
}

module.exports = Auth;
