const axios = require('axios');
const FormData = require('form-data');
const prompt = require('prompt')
const cheerio = require('cheerio')
const fs = require('fs');



const separator = "================================================================================"
const separatorText = (text) => {
	const textLength = text.length;
	const separatorLength = separator.length - (textLength + 2);
	return separator.substring(0, (separatorLength / 2)) + " " + text + " " + separator.substring(0, (separatorLength % 2) + (separatorLength / 2));
};


console.log(`\n${separator}\n`);
start();
function start(defaultUserName = '') {
	var schema = {
		properties: {
		"Nom d'utilisateur": {
			pattern: "[a-zA-Z0-9._%+-@]$",
			message: "Le nom d'utilisateur doit contenir que des caracteres du type [a-z0-9._%+-@]",
			required: true,
			default: defaultUserName
		},
		"Mot de passe": {
			hidden: true,
			required: true,
			replace: '*'
		}
		}
	  };
	
	prompt.get(schema, function (err, result) {
		if (err) { return onErr(err); }
	
		const userName = result['Nom d\'utilisateur'];
		const userPassword = result['Mot de passe'];
		main(userName, userPassword);
	});
}

function login(userName, userPassword) {
	return new Promise((resolve, reject) => {
		var bodyFormData = new FormData();
		bodyFormData.append('login', userName);
		bodyFormData.append('motdepasse', userPassword);
		bodyFormData.append('connexion', '1');

		axios({
			method: 'POST',
			url: `https://cahier-de-prepa.fr/mp2i-fenelonsaintemarie/ajax.php`,
			data: bodyFormData,
		})
		.then(async function (res) {
		
			const logged = res?.data?.etat === 'ok';
		
			if (!logged) {
				res?.data?.message ? console.log(`  ${res?.data?.message}`) : console.log(`  Impossible de se connecter, veuillez réessayer`);
				console.log(`\n${separator}\n`);
				start(userName);
			} else {
				const cdp_session = res.headers['set-cookie'][1].split(';')[0];
				resolve(cdp_session);
			}
		})
		.catch(() => {
			console.log(`  Une erreur est survenue, veuillez réessayer (vérifiez votre connexion internet)`);
			console.log(`\n${separator}\n`);
			start();
		});
	})
}



async function main(userName, userPassword) {

	function logStart() {
		console.log(`\n${separatorText("Démarrage de l'application")}\n`);
		console.log(`  Nom d'utilisateur: ${userName}`);
		console.log(`  Mot de passe: ${userPassword.replace(/./g, '*')}`);
		console.log(`\n${separator}\n`);
	}

	logStart()

	const cdp_session = await login(userName, userPassword);

	downloadRep('./', 'https://cahier-de-prepa.fr/mp2i-fenelonsaintemarie/docs?physique', cdp_session);

}


// Vérifier que le dossier existe sinon le créer
function checkFolder (folderPath) {
	if (!fs.existsSync(folderPath)) {
		fs.mkdirSync(folderPath);
	}
}

// Permet de télécharger le dossier
function downloadRep(path, url, cdp_session) {
	checkFolder(path);

	axios({
		method: 'POST',
		url,
		headers: {
			Cookie: cdp_session
		}
	})
	.then(res => {
		const data = res.data;
		const htmlCheerio = cheerio.load(data, null, false);

		const section = htmlCheerio("p.topbarre").parent();

		for (element of section.children()) {
			// vérifier si l'élément est un paragraph et si sa classe est 'rep' ou 'doc
			const elemClass = ['rep', 'doc'];
			if (element.name !== 'p' || !elemClass.includes(element.attribs.class)) {
				continue
			}

			if (element.attribs.class === 'doc') {
				const type = element.children[0].children[0].data.replace('(', '').replace(')', '').split(', ')[0];
				const link = "https://cahier-de-prepa.fr/mp2i-fenelonsaintemarie/" + element.children[2].attribs.href;
				const name = element.children[2].children[1].children[0].data;

				if (name.includes('/') || name.includes('\\')) continue;

				downloadFile(path, name, type, link, cdp_session);
			}
			else if (element.attribs.class === 'rep') {
				const link = "https://cahier-de-prepa.fr/mp2i-fenelonsaintemarie/docs" + element.children[2].attribs.href;
				let name = element.children[2].children[1].children[0].data;

				name.trim().replace(/[^a-zA-Z0-9_éêèàùïüëöâôûç ]/g, '_').trim().replace(/_+/g, '_');
				while (name.endsWith('_')) {
					name = name.substring(0, name.length - 1);
				}
				while (name.startsWith('_')) {
					name = name.substring(1, name.length);
				}

				downloadRep(path + name + '/', link, cdp_session);
			}
		}
	})
}


// Permet de télécharger un fichier
function downloadFile(path, name, type, url, cdp_session) {
	checkFolder(path);
	

	let fileName = name.trim().replace(/[^a-zA-Z0-9_éêèàùïüëöâôûç]/g, '_').trim().replace(/_+/g, '_');
	while (fileName.endsWith('_')) {
		fileName = fileName.substring(0, fileName.length - 1);
	}
	while (fileName.startsWith('_')) {
		fileName = fileName.substring(1, fileName.length);
	}

	const documentPath = path + fileName + '.' + type;

	if (fs.existsSync(documentPath)) return;

	axios({
		method: 'GET',
		url,
		headers: {
			Cookie: cdp_session
		},
		responseType: 'stream'
	})
	.then(function (res) {
		res.data.pipe(fs.createWriteStream(documentPath))
		console.log(`Fichier téléchargé: ${name}`)
		setTimeout(() => {}, 5000)
	})
}

