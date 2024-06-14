const crypto = require("crypto");
const fs = require("fs");

function generateKeys() {
	const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
		modulusLength: 2048,
		publicKeyEncoding: {
			type: "spki",
			format: "pem",
		},
		privateKeyEncoding: {
			type: "pkcs8",
			format: "pem",
		},
	});
	fs.writeFileSync("keys/private.pem", privateKey);
	fs.writeFileSync("keys/public.pem", publicKey);
}

if (!fs.existsSync("keys")) fs.mkdirSync("keys");
if (!fs.existsSync("keys/private.pem") || !fs.existsSync("keys/public.pem"))
	generateKeys();

function getPrivateKey() {
	return fs.readFileSync("keys/private.pem", "utf8");
}

function getPublicKey() {
	return fs.readFileSync("keys/public.pem", "utf8");
}

function decryptWithPrivateKey(privateKey, message) {
	return crypto.privateDecrypt(privateKey, message);
}

function generateAesKey() {
	return crypto.randomBytes(32);
}

function encryptMessage(message, aesKey) {
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
	let encrypted = cipher.update(message, "utf8", "hex");
	encrypted += cipher.final("hex");
	return Buffer.concat([iv, Buffer.from(encrypted, "hex")]);
}

function encryptAesKey(aesKey, publicKey) {
	return crypto.publicEncrypt(publicKey, aesKey);
}

module.exports = {
	getPrivateKey,
	getPublicKey,
	decryptWithPrivateKey,
	generateAesKey,
	encryptMessage,
	encryptAesKey,
};
