const path = require("path");
const http = require("https");
const map = require(path.join(__dirname, './map.js'));
const fs = require('fs');

const getJSON = function(hostname, pth, opt) {
	return new Promise(function(respond, reject) {
		var options = {
			"method": "GET",
			"hostname": hostname,
			"path": pth,
			"headers": {
				"Cache-Control": "no-cache",
				"User-Agent": "nodejs"
			}
		};

		var req = http.request(options, function(res) {
			var chunks = [];

			res.on("data", function(chunk) {
				chunks.push(chunk);
			});

			res.on("end", function() {
				var body = Buffer.concat(chunks);
				respond([JSON.parse(body.toString()), opt]);
			});
		});

		req.on('error', reject);

		req.end();
	});
};

const mapRepos = function([repos]) {
	return new Promise(function(respond, reject) {
		let releases = [];
		for (let x in repos) {
			if (map[repos[x].name]) {
				releases.push(getJSON("api.github.com", `/repos/sn-extensions/${repos[x].name}/releases`, repos[x].name));
			} else {
				console.log(`Missing ${repos[x].name}`);
			}
		}
		let packages = [];
		Promise.all(releases).then(function(tags) {
			for (let x in tags) {
				tags[x][0] = tags[x][0].filter((e) => e.draft == false && e.prerelease == false);
				if (tags[x][0][0]) {
					map[tags[x][1]].download_url = `https://api.github.com/repos/sn-extensions/${tags[x][1]}/zipball/${tags[x][0][0].tag_name}`;
					map[tags[x][1]].version = tags[x][0][0].tag_name;
					packages.push(getJSON("raw.githubusercontent.com", `/sn-extensions/${tags[x][1]}/${tags[x][0][0].tag_name}/package.json`, tags[x][1]));
				}
			}
			return Promise.all(packages);
		}).then(function(pkg) {
			for (let x in pkg) {
				if (map[pkg[x][1]].area == "themes") {
					map[pkg[x][1]].url = map[pkg[x][1]].latest_url = `https://cdn.staticaly.com/gh/sn-extensions/${pkg[x][1]}/${pkg[x][0].version}/${(pkg[x][0].sn && pkg[x][0].sn.main) || "dist/dist.css"}`;
				} else {
					map[pkg[x][1]].url = map[pkg[x][1]].latest_url = `https://cdn.staticaly.com/gh/sn-extensions/${pkg[x][1]}/${pkg[x][0].version}/${(pkg[x][0].sn && pkg[x][0].sn.main) || "index.html"}`;
				}
			}
		}).then(respond);
	});
};

const writeJSON = function() {
	Object.keys(map).map(function(objectKey, index) {
		let value = map[objectKey];
		fs.writeFileSync(path.join(__dirname, './dist/', objectKey + ".json"), JSON.stringify(value, "", "\t") + "\n", "utf8");
	});
};

const writeREADME = function() {
	let md = [
		"# StandardNotes Extensions",
		"",
		"Run this code in your `standardnotes/web` repo",
		"",
		"    git submodule add https://github.com/brahma-dev/sn-extensions public/extensions/sn-extensions",
		"",
		"Then adapt the following URLs to install",
		""
	];
	Object.keys(map).map(function(objectKey, index) {
		let value = map[objectKey];
		let u = `[[Your Public URL]]/extensions/sn-extensions/dist/${objectKey}.json`;
		md.push(`- ${value.name} : ${u}`);
	});
	fs.writeFileSync(path.join(__dirname, "./README.md"), md.join("\n") + "\n", "utf8");

};

getJSON("api.github.com", "/users/sn-extensions/repos").then(mapRepos).then(writeJSON).then(writeREADME);
