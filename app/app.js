const cheerio = require('cheerio'),
			request = require('request');

const url = "http://nmp-ihm.ctp.prod.canaltp.fr/fr/load/cM4Vcsgo/journey/result/?search%5Bfrom%5D%5Bautocomplete%5D=Champs+Blancs+%28Cesson-S%C3%A9vign%C3%A9%29&search%5Bfrom%5D%5Bautocomplete-hidden%5D=stop_area%3ASAR%3ASA%3A2126&search%5Bto%5D%5Bautocomplete%5D=56+Mail+Fran%C3%A7ois+Mitterrand+%28Rennes%29&search%5Bto%5D%5Bautocomplete-hidden%5D=-1.692075%3B48.109223&search%5Bdatetime%5D%5Bdate%5D=07%2F07%2F2017&search%5Bdatetime_represents%5D=departure&search%5Bdatetime%5D%5Btime%5D%5Bhour%5D=14&search%5Bdatetime%5D%5Btime%5D%5Bminute%5D=45&search%5Bmodes%5D%5B%5D=physical_mode%3ABus%3Bphysical_mode%3ACoach&search%5Bmodes%5D%5B%5D=physical_mode%3AMetro&search%5Btraveler_type%5D%5B%5D=standard&search%5Bcount%5D=&search%5Bmin_nb_journeys%5D=3&search%5Bmax_nb_journeys%5D=";
request(url, function (error, response, html) {
  if (!error && response.statusCode == 200) {
    parse(html);
  }
});

function parse(html) {
	const $ = cheerio.load(html);
	var itineraire1 = {}
	const $content = $('div#ctp-page-content');
	const $origin = $content.find('li#ctp-journey-1 ul.ctp-info-points');
	const $duree = $content.find('li#ctp-journey-1 div.ctp-right-info.ctp-head-duration');
	const $path = $content.find('ul.ctp-modes.ctp-frise-js');
	
	itineraire1.departure = $origin.find('li.ctp-origin').text().replace(/\s/g,'');
	itineraire1.arrival = $origin.find('li.ctp-destination').text().replace(/\s/g,'');
	itineraire1.duration = $duree.find('span').text().replace(/\s/g,'');
	itineraire1.walk_time = $duree.find('i.icon-mode-walk.ctp-walking-duration i').text().replace(/\s/g,'');

	console.log(itineraire1)
}
