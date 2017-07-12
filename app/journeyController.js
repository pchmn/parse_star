const cheerio = require('cheerio'),
			request = require('request');
var $;

const url = "http://nmp-ihm.ctp.prod.canaltp.fr/fr/load/cM4Vcsgo/journey/result/?search%5Bfrom%5D%5Bautocomplete%5D=Mus%C3%A9e+Beaux+Arts+%28Rennes%29&search%5Bfrom%5D%5Bautocomplete-hidden%5D=stop_area%3ASAR%3ASA%3A1166&search%5Bto%5D%5Bautocomplete%5D=Villejean-Universit%C3%A9+%28Rennes%29&search%5Bto%5D%5Bautocomplete-hidden%5D=stop_area%3ASAR%3ASA%3A1297&search%5Bdatetime%5D%5Bdate%5D=13%2F07%2F2017&search%5Bdatetime_represents%5D=departure&search%5Bdatetime%5D%5Btime%5D%5Bhour%5D=17&search%5Bdatetime%5D%5Btime%5D%5Bminute%5D=50&search%5Bmodes%5D%5B%5D=physical_mode%3ABus%3Bphysical_mode%3ACoach&search%5Bmodes%5D%5B%5D=physical_mode%3AMetro&search%5Btraveler_type%5D%5B%5D=standard&search%5Bcount%5D=&search%5Bmin_nb_journeys%5D=3&search%5Bmax_nb_journeys%5D=";

exports.getJourneys = function(req, res, next) {
	request(url, function (error, response, html) {
	  if (!error && response.statusCode == 200) {
	    parse(html, req, res, next);
	  }
	});
}

function parse(html, req, res, next) {
	$ = cheerio.load(html);
	var journeys = {};
	const $content = $('div#ctp-page-content');
	const $journeys = $content.find('li.ctp-journey');
	journeys.count = $journeys.length;
	journeys.units = {
		distance: "meters",
		duration: "seconds"
	}
	journeys.results = [];

	$journeys.each(function(i, elem) {
		const $origin = $(this).find('ul.ctp-info-points');
		const $duree = $(this).find('div.ctp-right-info.ctp-head-duration');
		const $path = $(this).find('ul.ctp-modes');

	  journeys.results[i] = {};
		journeys.results[i].departure = $origin.find('li.ctp-origin').text().replace(/\s/g,'');
		journeys.results[i].arrival = $origin.find('li.ctp-destination').text().replace(/\s/g,'');
		journeys.results[i].duration = timeStringToSeconds($duree.children().first().find('span').text().replace(/\s/g,''));
		journeys.results[i].walk_time = timeStringToSeconds($duree.children().last().text().replace(/(\s|dont|Durée estimée)/g,''));

		// short description
		journeys.results[i].short_steps = []
		var k = 0;	
		$path.children().each(function(j, element) {		
			if($(this).attr('class') !== "ctp-division") {
				journeys.results[i].short_steps[k] = {};
				// type
				const type = $(this).children().first().attr('title');
				journeys.results[i].short_steps[k].type = type;
				// value
				switch(type) {
					case "Bus":
					case "Métro":
						journeys.results[i].short_steps[k].line = $(this).find('img').attr('title');
						break;
					case "Marche":
						journeys.results[i].short_steps[k].duration = timeStringToSeconds($(this).find('span.ctp-drawdown-time').text().replace(/\s/g,''));
						break;
				}
				k++;
			}
		});

		// long description
		const $longSteps = $content.find('div#ctp-details-'+(i+1)+' ol.list-detail-iti');
		journeys.results[i].long_steps = [];

		$longSteps.children().each(function(l, element) {	
			if($(this).hasClass('ctp-section-no-type'))
				journeys.results[i].long_steps[l] = parseNoType($(this))
			else if($(this).hasClass('ctp-section-public_transport'))
				journeys.results[i].long_steps[l] = parsePublicTransport($(this))
			else if($(this).hasClass('ctp-section-waiting'))
				journeys.results[i].long_steps[l] = parseWaiting($(this))
			else if($(this).hasClass('ctp-section-street_network'))
				journeys.results[i].long_steps[l] = parseWalking($(this))
			else if($(this).hasClass('ctp-section-transfer'))
				journeys.results[i].long_steps[l] = parseTransfer($(this))	
		});
	});
  return res.status(200).json(journeys);
}

function parseNoType($step) {
	element = {};
	element.type = $step.find('div.ctp-picto img').attr('title');
	element.time = $step.find('div.ctp-time').text();
	element.description = $step.find('div.ctp-txtInfo strong').text();
	return element;
}

function parsePublicTransport($step) {
	element = {};
	element.type = $step.find('div.ctp-picto span').attr('title');	
	element.value = $step.find('div.ctp-picto img').attr('title');
	element.sub_steps = [];
	$step.find('div.ctp-info ul li.clearfix').each(function(m, elt) {
		if($(this).hasClass('ctp-duration'))
			element.duration = parseInt($(this).attr('data-duration'));
		else if($(this).find('.ctp-time').text() != "") {
			element.sub_steps[m] = {};
			element.sub_steps[m].time = $(this).find('.ctp-time').text();
			element.sub_steps[m].description = removeBlanks($(this).find('span.ctp-stop').text());		
		}
	});	
	return element;
}

function parseWaiting($step) {
	element = {};
	element.type = "Waiting";		
	element.duration = parseInt($step.find('span.ctp-duration').attr('data-duration'));
	return element;
}

function parseWalking($step) {
	element = {};
	element.type = "Walking";	
	element.duration = parseInt($step.find('span.ctp-duration').attr('data-duration'));
	const description = removeBlanks($step.find('div.ctp-info').children().remove().end().text())
	var distance = description.match(/\d+(,\d+)*/g) ? description.match(/\d+(,\d+)*/g)[0]: "";
	if(distance.includes(','))
		distance = parseFloat(distance.replace(',', '.'))*1000;
	else
		distance = parseInt(distance);
	element.distance = distance;
	element.destination = description.split('à')[1].trim();
	element.description = description;
	return element;
}

function parseTransfer($step) {
	element = {};
	element.type = "Transfer";	
	element.duration = parseInt($step.find('span.ctp-duration').attr('data-duration'));
	const description = removeBlanks($step.find('div.ctp-info span.ctp-duration').text())
	element.destination = getStop(description, 'arrêt');
	element.description = description;
	return element;
}

function removeBlanks(text) {
	return text.replace(/[ ]{2,}/g, '').replace(/(\n)+/g, ' ').trim();
}

function getStop(text, splitter) {
	return text.split(splitter)[1].match(/(\w+ *)*\(\w*\)/g)[0];
}

function timeStringToSeconds(timeString) {
	const digits = timeString.match(/\d+/g);
	var time = 0;
	if(timeString.includes("h")) {
		const hours = parseInt(digits[0]),
					minutes = parseInt(digits[1]);
		time = hours*3600 + minutes*60;
	}
	else {
		time = parseInt(digits[0])*60;
	}
	return time;
}