// Setup basic express server
require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const port = process.env.PORT || 3000;
const Database = require("./database.js");
const database = new Database();
const Rooms = require("./rooms.js");
const User = require("./users.js");
const Auth = require("./auth.js");
const Keys = require("./keys.js");

// Load application config/state

server.listen(port, () => {
	console.log("Server listening on port %d", port);
});

const socketMap = {};
////////////////////////////
// Authentication helpers //
////////////////////////////

/**
 *
 * @param {string} username - The username of the user to create
 * @param {string} password - The password of the user to create
 * @param {Function} callback - The callback function to call when the user is created, or an error is encountered
 */
function createUser(username, password, publicKey, callback) {
	const auth = new Auth(database);
	auth.registerUser(username, password, publicKey, (err) => {
		if (err) {
			callback({ success: false, reason: "User already exists" });
		} else {
			callback({ success: true });
		}
	});
}

/**
 *
 * @param {string} username - The username of the user to authenticate
 * @param {string} password - The password of the user to authenticate
 * @param {Function} callback - The callback function to call when the user is authenticated, or an error is encountered
 */
function authenticateUser(username, password, socket, callback) {
	const auth = new Auth(database);
	auth.authenticateUser(username, password, (err, user) => {
		if (err || !user)
			callback({ success: false, reason: "Invalid username or password" });
		else
			auth.generateJWT(user.ID, user.username, (err, token) => {
				if (err) callback({ success: false, reason: "Error generating token" });
				else {
					socketMap[user.ID] = socket;
					setUserState(socket, user.ID, username, true);
					callback({
						success: true,
						token: token,
						publicKey: user.publicKey,
						ID: user.ID,
					});
				}
			});
	});
}

/**
 *
 * @param {Function} callback - The callback function to call when the token is missing
 */
function missingToken(callback) {
	callback({ success: false, reason: "Missing token" }, null);
}

/**
 *
 * @param {Function} callback - The callback function to call when the token is invalid
 */
function invalidToken(callback) {
	callback({ success: false, reason: "Invalid token" }, null);
}

/**
 *
 * @param {string} token - The token to authenticate
 * @param {Function} callback - The callback function to call when the token is authenticated, or an error is encountered
 */
function authenticateToken(token, callback) {
	if (!token) missingToken(callback);
	const auth = new Auth(database);
	auth.verifyJWT(token, (err, decodedToken) => {
		if (err) invalidToken(callback);
		else callback(null, decodedToken);
	});
}

//////////////////////////
// User state functions //
//////////////////////////

/**
 *
 * @param {socket} socket - The socket to broadcast the user state change to
 * @param {number} userID - The ID of the user
 * @param {boolean} state - The state of the user
 */
function setUserState(socket, userID, username, state) {
	const users = new User(userID, database);
	users.setState(state, (err) => {
		if (!err) {
			socket.broadcast.emit("user_state_change", {
				ID: userID,
				active: state,
				username: username,
			});
		}
	});
}

function joinRoom(socket, roomID) {
	socket.join(`room${roomID}`);
}
///////////////////////////////
// Chatroom helper functions //
///////////////////////////////

function sendToRoom(roomID, event, data) {
	io.to(`room${roomID}`).emit(event, data);
}

function addMessageToRoom(message) {
	sendToRoom(message.roomID, "new message", message);
}

///////////////////////////
// IO connection handler //
///////////////////////////

io.on("connection", (socket) => {

	///////////////////////
	// user registration //
	///////////////////////

	socket.on("register", (credentials, callback) => {
		if (
			!credentials.username ||
			!credentials.password ||
			!credentials.publicKey
		) {
			callback({ success: false, reason: "Invalid username or password" });
			socket.disconnect(true);
		} else {
			createUser(
				credentials.username,
				credentials.password,
				credentials.publicKey,
				(response) => {
					callback(response);
					socket.disconnect(true);
				}
			);
		}
	});

	/////////////////////////
	// user authentication //
	/////////////////////////

	socket.on("authenticate", (credentials, callback) => {
		if (!credentials.username || !credentials.password) {
			callback({ success: false, reason: "Invalid username or password" });
			socket.disconnect(true);
		} else
			authenticateUser(
				credentials.username,
				credentials.password,
				socket,
				(result) => {
					callback(result);
				}
			);
	});

	///////////////////
	// get-user-data //
	///////////////////

	/**
	 * @param {Object} data - The data object containing the token
	 * @param {Function} callback - The callback function to call when the user data is retrieved
	 * this is triggered when the client emits get-user-data.
	 * It authenticates the token, then retrieves the user data from the database and sends it back to the client.
	 * It retrieves, all the users, the public and private rooms but not the direct rooms.
	 */
	socket.on("get-user-data", (data, callback) => {
		authenticateToken(data.token, (err, decodedToken) => {
			if (err || !decodedToken) callback(err);
			else {
				const user = new User(decodedToken.ID, database);
				const joinRoomAndReturnRoom = (room) => {
					joinRoom(socket, room.ID);
					return room;
				};
				const filterDirectRooms = (room) => !room.direct;
				const joinRoomsAndSendData = (data) => {
					const rooms = data.rooms.map(joinRoomAndReturnRoom);
					data.rooms = rooms.filter(filterDirectRooms);
					callback({ success: true, data: data });
				};
				const handleResult = (err, data) => {
					if (err || !data) invalidToken(callback);
					else joinRoomsAndSendData(data);
				};
				user.getUserData((err, data) => {
					handleResult(err, data);
				});
			}
		});
	});

	//////////////////////
	// incoming message //
	//////////////////////

	/**
	 * @param {Object} req - The request object containing the token and the message
	 * @param {Function} callback - The callback function to call when the message is sent
	 */
	socket.on("send-message", (req, callback) => {
		authenticateToken(req.token, (err, decodedToken) => {
			if (err) callback(err);
			if (!req.message?.room)
				callback({ success: false, reason: "No room supplied" });
			if (!req.message?.content)
				callback({ success: false, reason: "No message supplied" });
			const room = new Rooms(database);
			room.sendMessage(
				req.message.room,
				decodedToken.ID,
				req.message.content,
				(err, message) => {
					if (err) invalidToken(callback);
					else {
						if (req.decryptionKeys) {
							const keys = new Keys(database);
							keys.saveKeys(req.message.room, message.ID, req.decryptionKeys);
							message.decryptionKeys = req.decryptionKeys;
						}
						console.log("message", message);
						addMessageToRoom(message);
						callback({ success: true });
					}
				}
			);
		});
	});

	///////////////////
	// get-room-data //
	///////////////////

	/**
	 * @param {Object} data - The data object containing the token and the room ID
	 * @param {Function} callback - The callback function to call when the room data is retrieved
	 */
	socket.on("get-room", (data, callback) => {
		authenticateToken(data.token, (err, decodedToken) => {
			if (err || !decodedToken) callback(err);
			const rooms = new Rooms(database);
			rooms.getRoom(data.room, decodedToken.ID, (err, room) => {
				if (err || !room) callback({ success: false, reason: "Invalid room" });
				else callback({ success: true, room: room });
			});
		});
	});

	/////////////////////////////
	// request for direct room //
	/////////////////////////////

	/**
	 * @param {Object} req - The request object containing the token and the user ID to create a direct room with
	 */

	socket.on("request_direct_room", (req) => {
		if (req.token && req.to) {
			const auth = new Auth(database);
			auth.verifyJWT(req.token, (err, decodedToken) => {
				if (decodedToken) {
					const rooms = new Rooms(database);
					rooms.getDirectRoom(decodedToken.ID, req.to, (err, room) => {
						if (err) invalidToken(callback);
						joinRoom(socket, room.ID);
						if (socketMap[req.to]) socketMap[req.to].join(`room${room.ID}`);
						socket.emit("update_room", {
							room: room,
							moveto: true,
						});
					});
				}
			});
		}
	});

	/**
	 * @param {Object} req - The request object containing the token and the room name, description and wether it's private or not
	 */
	socket.on("add_channel", (req) => {
		authenticateToken(req.token, (err, decodedToken) => {
			if (decodedToken) {
				const rooms = new Rooms(database);
				rooms.createRoom(
					req.name,
					req.description,
					req.private,
					(err, room) => {
						if (room) {
							const users = new User(decodedToken.ID, database);
							users.joinChannel(room.ID, (err) => {
								if (!err) {
									socket.join(`room${room.ID}`);
									socket.emit("update_room", {
										room: room,
										moveto: true,
									});
									if (!room.private) {
										rooms.getPublicRooms((err, rooms) => {
											if (err) invalidToken(callback);
											socket.broadcast.emit("update_public_channels", {
												publicChannels: rooms,
											});
										});
									}
								}
							});
						}
					}
				);
			}
		});
	});

	/**
	 * @param {Object} req - The request object containing the token and the room ID
	 */
	socket.on("join_channel", (req) => {
		authenticateToken(req.token, (err, decodedToken) => {
			if (decodedToken) {
				const rooms = new Rooms(database);
				rooms.addUserToPublicChannel(decodedToken.ID, req.ID, (err, room) => {
					if (!err) {
						socket.join(`room${room.ID}`);
						socket.emit("update_room", {
							room: room,
							moveto: true,
						});
						rooms.getPublicRooms((err, rooms) => {
							if (!err)
								socket.emit("update_public_channels", {
									publicChannels: rooms,
								});
						});
					}
				});
			}
		});
	});

	/**
	 * @param {Object} req - The request object containing the token, the username of the user to add and the channel ID
	 */
	socket.on("add_user_to_channel", (req) => {
		authenticateToken(req.token, (err, decodedToken) => {
			if (decodedToken) {
				const rooms = new Rooms(database);
				rooms.addUserToChannel(req.user, req.channel, (err, userID, room) => {
					if (!err && userID && room) {
						if (socketMap[userID]) {
							socketMap[userID].join(`room${room.ID}`);
							socketMap[userID].emit("update_room", {
								room: room,
								moveto: true,
							});
						}
					}
				});
			}
		});
	});

	/**
	 * @param {Object} req - The request object containing the token and the channel ID
	 
	 */
	socket.on("leave_channel", (req) => {
		authenticateToken(req.token, (err, decodedToken) => {
			if (decodedToken) {
				const rooms = new Rooms(database);
				rooms.removeUserFromChannel(decodedToken.ID, req.ID, (err) => {
					if (!err) {
						rooms.getMembers(req.ID, (err, members) => {
							if (!err) {
								sendToRoom(req.ID, "update_user", {
									room: req.ID,
									username: decodedToken.username,
									action: "removed",
									members: members,
								});
								socket.leave(`room${req.ID}`);
								socket.emit("remove_room", {
									room: req.ID,
								});
							}
						});
					}
				});
			}
		});
	});

	////////////////
	// reconnects //
	////////////////

	// Not 100% sure when this is triggered
	socket.on("reconnect", () => {
		const userID = Object.keys(socketMap).find(
			(userID) => socketMap[userID] === socket
		);
		const user = new User(userID, database);
		user.getUser(userID, (err, user) => {
			if (!err) {
				setUserState(socket, userID, user.username, true);
			}
		});
	});

	/////////////////
	// disconnects //
	/////////////////

	socket.on("disconnect", () => {
		const userID = Object.keys(socketMap).find(
			(userID) => socketMap[userID] === socket
		);
		if (userID) {
			const user = new User(userID, database);
			user.getUser((err, user) => {
				if (!err) {
					setUserState(socket, userID, user.username, false);
					delete socketMap[userID];
				}
			});
		}
	});
});
