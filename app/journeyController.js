const cheerio = require('cheerio'),
			request = require('request');
var $;

var fromStr = "", fromCoord = "",
			toStr = "", toCoord = "",
			date = "", hour = "", minute = "", timeRepresents = "departure",
			travelerType = "standard",
			busMode = true, metroMode = true;


exports.getJourneys = function(req, res, next) {
	// form
	fromStr = req.body.from_str;
	fromCoord = req.body.from_coord;
	toStr = req.body.to_str;
	toCoord = req.body.to_coord;
	date = req.body.date;
	hour = req.body.hour;
	minute = req.body.minute;
	timeRepresents = "departure" || req.body.time_represents;
	travelerType = "standard" || req.body.traveler_type;
	busMode = req.body.bus_mode || true;
	metroMode = req.body.metro_mode || true;
	// create url
	var url = "http://nmp-ihm.ctp.prod.canaltp.fr/fr/load/cM4Vcsgo/journey/result/?"+
						"search[from][autocomplete]=" + fromStr +
						"&search[from][autocomplete-hidden]=" + fromCoord +
						"&search[to][autocomplete]=" + toStr +
						"&search[to][autocomplete-hidden]=" + toCoord +
						"&search[datetime][date]=" + date +
						"&search[datetime_represents]=" + timeRepresents +
						"&search[datetime][time][hour]=" + hour + "&search[datetime][time][minute]=" + minute + 
						"&search[traveler_type][]=" + travelerType +
						"&search[count]=&search[min_nb_journeys]=1&search[max_nb_journeys]=";
	// modes
	if(busMode && metroMode)
		url += "&search[modes][]=physical_mode:Bus;physical_mode:Coach&search[modes][]=physical_mode:Metro";
	else if(busMode)
		url += "&search[modes][]=physical_mode:Bus;physical_mode:Coach";
	else if(metroMode)
		url += "&search[modes][]=physical_mode:Bus;physical_mode:Coach";
	else
		return res.status(400).json({error: "You must provide at least one mode"});

	console.log(url)

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
	element.line = $step.find('div.ctp-picto img').attr('title');

	// from to
	$step.find('div.ctp-info ul li.clearfix').each(function(i, elt) {
		const time = $(this).find('.ctp-time').text();
		if($(this).hasClass('ctp-duration'))
			element.duration = parseInt($(this).attr('data-duration'));
		else if(time != "") {
			const description = removeBlanks($(this).find('span.ctp-stop').text());
			if(description.includes("Prendre")) {
				element.from = element.type == "Métro" ? getStop(description, "station"): getStop(description, "arrêt");
				element.direction = getDirection(description);
				element.departure = time;
			}
			else if(description.includes("Descendre")) {
				element.to = element.type == "Métro" ? getStop(description, "station"): getStop(description, "arrêt");
				element.arrival = time;
			}	
		}
	});
	// steps
	element.sub_steps = [];
	element.sub_steps[0] = element.from;
	$step.find('ul.ctp-stops-description li span.ctp-stop-name').each(function(j, elt) {
		element.sub_steps[j+1] = $(this).text().trim();
	});
	element.sub_steps[element.sub_steps.length] = element.to;
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
	console.log(text, splitter)
	console.log(text.split(splitter)[1].match(/([a-zA-Zéèàêâ\-]| )+\([a-zA-Zéèàêâ\-]+\)/g))
	return text.split(splitter)[1].match(/([a-zA-Zéèàêâ\-]| )+\([a-zA-Zéèàêâ\-]+\)/g)[0].trim();
}

function getDirection(text) {
	return text.split("direction de")[1].trim();
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