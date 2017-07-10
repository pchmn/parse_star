const cheerio = require('cheerio'),
			request = require('request');

const url = "http://nmp-ihm.ctp.prod.canaltp.fr/fr/load/cM4Vcsgo/journey/result/?search%5Bfrom%5D%5Bautocomplete%5D=56+Mail+Fran%C3%A7ois+Mitterrand+%28Rennes%29&search%5Bfrom%5D%5Bautocomplete-hidden%5D=-1.692075%3B48.109223&search%5Bto%5D%5Bautocomplete%5D=Villejean-Universit%C3%A9+%28Rennes%29&search%5Bto%5D%5Bautocomplete-hidden%5D=stop_area%3ASAR%3ASA%3A1297&search%5Bdatetime%5D%5Bdate%5D=10%2F07%2F2017&search%5Bdatetime_represents%5D=departure&search%5Bdatetime%5D%5Btime%5D%5Bhour%5D=14&search%5Bdatetime%5D%5Btime%5D%5Bminute%5D=50&search%5Bmodes%5D%5B%5D=physical_mode%3ABus%3Bphysical_mode%3ACoach&search%5Bmodes%5D%5B%5D=physical_mode%3AMetro&search%5Btraveler_type%5D%5B%5D=standard&search%5Bcount%5D=&search%5Bmin_nb_journeys%5D=3&search%5Bmax_nb_journeys%5D=";
request(url, function (error, response, html) {
  if (!error && response.statusCode == 200) {
    parse(html);
  }
});

function parse(html) {
	const $ = cheerio.load(html);
	var journeys = {};
	const $content = $('div#ctp-page-content');
	const $journeys = $content.find('li.ctp-journey');
	journeys.count = $journeys.length;
	journeys.result = [];

	$journeys.each(function(i, elem) {
		const $origin = $(this).find('ul.ctp-info-points');
		const $duree = $(this).find('div.ctp-right-info.ctp-head-duration');
		const $path = $(this).find('ul.ctp-modes');

	  journeys.result[i] = {};
		journeys.result[i].departure = $origin.find('li.ctp-origin').text().replace(/\s/g,'');
		journeys.result[i].arrival = $origin.find('li.ctp-destination').text().replace(/\s/g,'');
		journeys.result[i].duration = $duree.children().first().find('span').text().replace(/\s/g,'');
		journeys.result[i].walk_time = $duree.children().last().text().replace(/(\s|dont|Durée estimée)/g,'');

		// short description
		journeys.result[i].modes = []
		var k = 0;	
		$path.children().each(function(j, element) {		
			if($(this).attr('class') !== "ctp-division") {
				journeys.result[i].modes[k] = {};
				// type
				const type = $(this).children().first().attr('title');
				journeys.result[i].modes[k].type = type;
				// value
				switch(type) {
					case "Bus":
					case "Métro":
						journeys.result[i].modes[k].value = $(this).find('img').attr('title');
						break;
					case "Marche":
						journeys.result[i].modes[k].value = $(this).find('span.ctp-drawdown-time').text().replace(/\s/g,'');
						break;
				}
				k++;
			}
		});

		// long description
		const $steps = $content.find('div#ctp-details-'+(i+1)+' ol.list-detail-iti');
		journeys.result[i].steps = [];

		$steps.find('li.ctp-section').each(function(l, element) {		
			if($(this).hasClass('ctp-section-no-type'))
				parseNoType($(this))
			else if($(this).hasClass('ctp-section-public_transport'))
				parsePublicTransport($(this))
			else if($(this).hasClass('ctp-section-waiting'))
				parseWaiting($(this))
			else if($(this).hasClass('ctp-section-street_network'))
				parseWalking($(this))
			
		});
	});
	console.log(JSON.stringify(journeys))
}

function parseNoType(html) {

}

function parsePublicTransport(html) {
	
}

function parseWaiting(html) {
	
}

function parseWalking(html) {
	
}