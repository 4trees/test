//scroll the page to Riverside stop when load the page.
window.onload = function(){setTimeout(function(){window.scrollTo(0,2500)},10);}

// URL globals
apikey = "ASOviiaeO0qR9EkRy7WF3A";
stopsurl = "https://api.mbtace.com/stops?route=Green-D";
vehiclesurl = "https://api.mbtace.com/vehicles?route=Green-D&include=stop";
predictionsurl = "https://api.mbtace.com/predictions?route=Green-D";
tripsurl = "https://api.mbtace.com/trips?route=Green-D";
alerturl = "https://api.mbtace.com/alerts?route=Green-D";
allvehicleurl = "https://api.mbtace.com/vehicles?route=Green-B,Green-C,Green-D,Green-E";


var app = angular.module('hdwyApp', []);
app.controller('hdwyCtrl',function($scope, $http, $interval) {
	$scope.stops = [];
	$scope.predictions = [];
	$scope.allStops = [];
	$scope.arrivalTripId = [];
	$scope.arrivalVehicle = [];
	$scope.alerts = [];
	$scope.allPredictions=[];

//get all the stations data
	$scope.getStops = function(){
		$http.get(stopsurl+"&direction_id=0")
		.then(function(response) {
			$scope.stops.xbound = response.data.data;
			angular.forEach($scope.stops.xbound, function(stop, k){
			$scope.allStops.push({id:stop.id,name:stop.attributes.name})
			});
			drawStation('left',$scope.stops.xbound)//draw left group of stations
		});
		
		$http.get(stopsurl+"&direction_id=1")
		.then(function(response) {
			$scope.stops.ybound = response.data.data;			
			angular.forEach($scope.stops.ybound, function(stop, k){
			$scope.allStops.push({id:stop.id,name:stop.attributes.name})
			});
			drawStation('right',$scope.stops.ybound)//draw right group of stations
		});
	};
//get all the vehicles data
	$scope.getVehicles = function(){
		$http.get(vehiclesurl)
		.then(function(response) {
			$scope.vehicles = []
			angular.forEach(response.data.included,function(stop){
				var parentStation = $scope.allStops.find(function(d){return d.id == stop.relationships.parent_station.data.id});
				if(parentStation){
					stationId = stop.id
					var vehicle = response.data.data.find(function(d){return d.relationships.stop.data.id == stop.id})
					vehicle['parent_station'] = parentStation;
					$scope.vehicles.push(vehicle)
				}
			});

			//draw the vehicles on the main diagram
			drawVehicles($scope.vehicles)

			// SEARCH 
			d3.select('.searchButton').on('click',function(d){
				var searchValue = d3.select('.searchInput')._groups[0][0].value
				//search on local
				var getResults = response.data.data.filter(function(d){return d.attributes.label.includes(searchValue)})
				if(getResults.length == 0){
					//search on server
					$http.get(allvehicleurl)
					.then(function(response) {
						var getServerResult = response.data.data.filter(function(d){return d.attributes.label.includes(searchValue)})
						if(getServerResult.length == 0){
							d3.select('#searchRT').html('<hr><p class=\'lead\'>Train '+searchValue+ ' is not listed in Green lines.</p>')
						}else if(getServerResult.length == 1){
							d3.select('#searchRT').html('<hr><p class=\'lead\'>Train '+searchValue+' is on '+getServerResult[0].relationships.route.data.id+'.</p>')
						}else{
							d3.select('#searchRT').html('<hr><p class=\'lead\'>Data error: Train '+searchValue+ ' is listed in more than one place.</p>')
						}
					})
				}else{
				//highlight the vehicle
				//scroll the page to the first vehicle
					var theTrain = d3.select('#train'+getResults[0].id)
					var moveY = getXYFromTranslate(theTrain._groups[0][0])[1]
					window.scrollTo(0,moveY - windowHeight / 2)
				//give color & bg
					var text = theTrain.select('text').classed('highlight',true)
					var textSize = text.node().getBBox();
					theTrain.insert('rect', 'text')
						.attr('class','highlightBG')
						.attr('height',textSize.height + 5)
						.attr('width',textSize.width + 5)
						.attr('transform','translate('+(textSize.x - 2.5)+','+(textSize.y - 2.5)+')')
				}
			})
			
		});
	};
//get the prediction data
	$scope.getPrediction = function(){
		$http.get(predictionsurl)
		.then(function(response) {
			//get the current working station id from TOP BAR
			var stationCode = document.querySelector('[data-station]').dataset.station
			//get the prediction data related to the working station
			$scope.allPredictions = response.data.data
				.filter(function(d){return d.relationships.stop.data.id == stationCode}) 
			$scope.predictions = $scope.allPredictions.sort(function(a,b){
       				return b.attributes.arrival_time - a.attributes.arrival_time; // sort by arrival time
    			})
    			.slice(0,3);//get first 3 new arrivals
			$scope.arrivalTripId = getTripId($scope.predictions)

			//show first three time on NEW ARRIVALS section
			$scope.vehicles.forEach(function(vehicle){
				var arrivalTime = $scope.allPredictions.find(function(d){return d.relationships.trip.data.id == vehicle.relationships.trip.data.id})
				if(arrivalTime){
					vehicle.arrival_time = 	new Date(Date.parse(arrivalTime.attributes.arrival_time));
				}
			})
			showArrivalVehicles($scope.vehicles,$scope.allStops)
		})
	}
//get alerts data
	$scope.getAlerts = function(){
		$http.get(alerturl)
		.then(function(response) {
			$scope.alerts = response.data.data;
			//show alert icon only when alerts exist
			if($scope.alerts.length > 0 ){
				var alert = d3.select('#alerts')
				alert.classed('hidden', false)
				showAlerts($scope.alerts)
				
				drawAlertIcon($scope.alerts.length)
			}else{
				alert.classed('hidden',true)
			}
		})
	}
//show the clock on TOP BAR section
	$scope.timeNow = function(){
		d3.select('#nowTime').html(getTime()[0]);
		d3.select('#ap').html(getTime()[1]);
	}
// Initial
	$scope.timeNow();
	$scope.getPrediction();
	$scope.getStops();
	$scope.getVehicles();
	$scope.getAlerts();
// Update
	$interval(function(){
		$scope.timeNow();

	},1000)
	$interval(function() {    
		$scope.getVehicles();
		$scope.getPrediction();
		$scope.getAlerts();
	}, 10000);

});
//get the trip id from prediction data
function getTripId(data){
	return data.map(function(el){
		return el.relationships.trip.data.id
	})
}
//draw routes and stations on main diagram
function drawStation(position,data){
var line, location,arrowAngle;
//draw station and route based on dirction
if(position == 'right'){
	location = rightLocation;
	data.reverse();
	arrowAngle = true;
}
else{
	location = leftLocation;
	arrowAngle = false;
}
var length = data.length;
var line = bindLine.append('g')
//green routes
line.append('rect')
	.attr('class','bind')
	.attr('x',location)
	.attr('width',bindWidth)
	.attr('y',interval)
	.attr('height',(length -1) * interval)

//direction arrows
var arrows = line.append('g')
var count = 4 // the count of arrow between stops
for(i=0;i<(length -1)*count;i++){
	if(i%count){
		arrows.append('line')
			.attr('x1',location)
			.attr('y1',interval+interval/count*i)
			.attr('x2',location+bindWidth/2)
			.attr('y2',interval+interval/count*i+bindWidth/2)
			.attr('class','triangle')
			.attr('transform','translate('+(arrowAngle?bindWidth/2:0)+'0)')
		arrows.append('line')
			.attr('x2',location+bindWidth)
			.attr('y2',interval+interval/count*i)
			.attr('x1',location+bindWidth/2)
			.attr('y1',interval+interval/count*i+bindWidth/2)
			.attr('class','triangle')
			.attr('transform','translate('+(arrowAngle?-bindWidth/2:0)+'0)')
	}

}

var update = line.selectAll('.stop')
	.data(data,function(d){return d.id})
var enter = update.enter()
	.append('g')
	.attr('class',function(d){return 'stop '+d.id})
	.attr('transform',function(d,i){return 'translate('+location + ',' + (i+1)*interval + ')'})
enter.append('circle')
	.attr('r',function(d,i){return i == 0 || i == length - 1?bindWidth - 6:(bindWidth - 6)/2})
	.attr('class',function(d,i){return i == 0 || i == length - 1?'terminalStop':'middleStop'})
	.attr('cx',bindWidth / 2)

//only append station names once
if(position == 'left'){
	enter.append('text')
		.text(function(d){return d.attributes.name})
		.attr('class','stationName')
		.attr('x',(rightLocation - leftLocation + bindWidth) / 2)
}
}
//draw vehicles on main diagram
function drawVehicles(data){
	console.log(data)
var update = vehicles.selectAll('.vehicle')
	.data(data,function(e){return e.id})
var enter = update.enter()
	.append('g')
	.attr('class','vehicle')
	.attr('id',function(e){return 'train' + e.id})
	.on('click',function(e){var n = [];n[0] = e;return showVehicle(n)})
	.attr('transform',function(e){return e.attributes.direction_id?('translate('+rightLocation+','+h+')'):('translate('+leftLocation+',0)')})
enter.append('svg:image')
	.attr("xlink:href","images/yellow-train.png")
	.attr('width', vehicleSize + 'em')
    .attr('height', vehicleSize + 'em')
    .attr('x',-vehicleSize/2 + 'em')
    .attr('y',-vehicleSize/2 + 'em')
enter.append('text').text(function(e){return e.attributes.label})
	.attr('class','vehicleNum')

update.merge(enter)
	.transition()
	.attr('transform',function(e){
		var station = getXYFromTranslate(d3.select('.'+e.parent_station.id)._groups[0][0]);
		var offsetY,offsetX;
		// if(e.attributes.direction_id == e.parent_station.direction){
			offsetY = station[1] + (e.attributes.current_status == 'INCOMING_AT'? (e.attributes.direction_id? 1 : -1) * interval / 2 : 0);
			offsetX = e.attributes.direction_id? (rightLocation + 2 * bindWidth) : (leftLocation - 1 * bindWidth);
		// }else{
		// 	offsetY = station[1];
		// 	offsetX = e.parent_station.direction? ((rightLocation - 1) * bindWidth) : (leftLocation + 2 * bindWidth)
		// }
		return 'translate(' + offsetX + ',' + offsetY + ')';
	})
	.attr('id',function(e){return 'train'+e.id})
	.select('text')
	.attr('x',function(e){return (e.attributes.direction_id == 0? -1 : 1) * 15})
	.attr('y',function(e){})
	.style('text-anchor',function(e){return e.attributes.direction_id == 0?'end':'start'})

update.exit().remove();

//when multiple trans, hidden them and draw a grouped train 
data.forEach(function(d){console.log(d.attributes.label+d.attributes.current_status+d.relationships.stop.data.id+d.parent_station.id+d.parent_station.name+d.attributes.direction_id)})
var vehicleByStation = d3.nest()
	.key(function(d){return d.relationships.stop.data.id})
	.key(function(d){return d.attributes.current_status})
	.entries(data)
console.log(vehicleByStation,data.length)
	vehicleByStation.forEach(function(station){
		station.values.forEach(function(trains){
			console.log(trains.values.length)
			var countTrain = trains.values.length;
			if(countTrain > 1){
				console.log(trains.values[0].id)
				console.log(d3.select('#train'+trains.values[0].id))
				var stop =getXYFromTranslate(d3.select('#train'+trains.values[0].id)._groups[0][0])
				var multitrain = d3.select('.vehicleContainer')
					.append('g').attr('class','multitrain'+trains.key)
					.attr('transform','translate('+stop[0]+','+stop[1]+')')
					.on('click',showVehicle(trains.values))
				trains.values.forEach(function(train,i){
					d3.select('#train'+train.id).classed('hidden',true);
					var offsetX = train.attributes.direction_id == 0? -1 : 1;
					multitrain.append('svg:image')
						.attr("xlink:href","images/yellow-train.png")
						.attr('width', vehicleSize+'em')
					    .attr('height', vehicleSize+'em')
					    .attr('x',(offsetX * vehicleSize * i + vehicleSize/2)+'em')
					    .attr('y',-vehicleSize/2+'em')
				})	
			}
			else{
				var selectMulti = d3.select('.multitrain'+trains.key)
				if(selectMulti){selectMulti.remove};
				d3.selectAll('.vehicle').classed('hidden',false);
			}
		})
	})
}
//show vehicle's information when click on the icon of it
function showVehicle(data){
	//open the dismiss area when open the search/alerts
	dismiss.classList.remove('hidden');isDismiss = true;
	vehicleBox.classList.add('openBox');
	vehicleCT.innerHTML = 
		data.map(function(d){
			return '<p class=\'lead\'>Train '+ d.attributes.label + (d.arrival_time?(' will arrive at '+getTime(d.arrival_time)[0]+getTime(d.arrival_time)[1]):'')+'.</p>';
		}).join('')
	isVehicle = true;
}

//show the new arrivals' vehicle label and location
function showArrivalVehicles(data,allStops){
	if(data!='' && allStops!=''){
		console.log(data);

		var newarrivals = data.filter(function(d){return d.arrival_time})
				.sort(function(a,b){
       				return a.arrival_time - b.arrival_time; // sort by arrival time
    			})
    			.slice(0,3);//get first 3 new arrivals
    	console.log(newarrivals)
		document.querySelector('#arrivalTime').innerHTML = 
			newarrivals.map(function(arrival) {
			var time = getTime(arrival.arrival_time);
    		return '<div class=\"col-xs-4 col-sm-4 col-md-4 col-lg-4\"><h4>'+time[0]+'<span class=\"ap\">'+time[1]+'</span></h4></div>';
    	}).join('');
		document.querySelector('#arrivalVehicle').innerHTML =
			'<hr class="arrivals">'+newarrivals.map(function(arrival) {
    		return '<div class=\"col-xs-4 col-sm-4 col-md-4 col-lg-4\"><p><span class=\"vehicleCode\">'+arrival.attributes.label+'</span></p></div>'
    	}).join('');
		document.querySelector('#arrivalLocation').innerHTML = 
			newarrivals.map(function(arrival) {
			var name = allStops.find(function(d){return d.id == arrival.parent_station.id}).name;
    		return  '<div class=\"col-xs-4 col-sm-4 col-md-4 col-lg-4\"><p><span class=\"text-darker\">'+(arrival.attributes.current_status == 'INCOMING_AT'?'to ':'at ')+'</span><span>'+name.slice(0, name.indexOf("-"))+'</span></p></div>'
    	}).join('');
	}
}
//show alerts
function showAlerts(data){
	document.querySelector('#alertDetail').innerHTML = 
		data.map(function(alert){
			return 	'<div id=alert'+alert.id+'><h5 class=\"alertTitle\"><strong>' + alert.attributes.effect_name +':&nbsp;</strong>'+ alert.attributes.short_header +'</h5>'+(alert.attributes.description?('<p class=\"alertDes hidden\">'+alert.attributes.description+'</p><p class=\"viewMore\"><a>View More Detail&nbsp;<i class="fa fa-angle-right" aria-hidden="true"></i></a></p>'):(''))+'<p class=\"text-darker\">Last Updated: '+ getDate(alert.attributes.updated_at) +'</p></div>';
		}).join('') 

	//when click the detail of X alert, close other details of alerts.
	var alerts = document.querySelectorAll('.viewMore');
	alerts.forEach(function(alert){
		alert.addEventListener('click',function(){
			var active = this.parentElement.id
			document.querySelectorAll('.alertDes').forEach(function(d){
				if(d.parentElement.id == active){
					d.classList.remove('hidden')
				}else{
					d.classList.add('hidden') 
				}
			})
			alerts.forEach(function(d){
				if(d.parentElement.id == active){
					d.classList.add('hidden')
				}else{
					d.classList.remove('hidden') 
				}
			})
		})
	})

}
//draw alerts icon
function drawAlertIcon(count){
	var svgBox = document.querySelector('.alertImg')
	if(svgBox.childElementCount){
		d3.select('.alertImg').select('svg').select('text').text(count)
	}else{	
		var width = document.querySelector('.alertImg').clientWidth;
		var height = document.querySelector('.alertImg').clientHeight;
		var svg = d3.select('.alertImg').append('svg')
			.attr('viewBox','0 0 ' + width*3 +' ' + height*3)
			.attr('transform','translate(0,'+height/4+')')
		svg.append('path')
			.attr('d','M84.18,41.34l-3.42.46C80.61,26,73.21,14.52,59.34,7.34a37,37,0,0,0-30-2.08C9,12.23-2,35,5.3,55.14,11.76,73,32.57,88.68,58.91,77.48L60,80.57A36.58,36.58,0,0,1,46.57,84.1c-7,.39-13.92.05-20.55-2.7A42.41,42.41,0,0,1,10.07,69.55,39.54,39.54,0,0,1,1.74,54.66,44.81,44.81,0,0,1,.14,38.6a41.54,41.54,0,0,1,4.07-15A40.25,40.25,0,0,1,12,12.5C17.87,6.68,24.71,2.49,32.9.85a46.15,46.15,0,0,1,16-.29c11.91,1.8,21,8.13,27.88,17.81A40.89,40.89,0,0,1,83.87,36.7C84.08,38.23,84.08,39.8,84.18,41.34Z')
			.style('fill','#fff')
		svg.append('path')
			.attr('d', 'M69.24,34.66H48.86V68.78H34.35V34.7H14.79v-12H69.24Z')
			.style('fill','#fff')
		svg.append('path')
			.attr('d','M85.73,94a24.65,24.65,0,1,1,24.72-24.54A24.74,24.74,0,0,1,85.73,94Z')
			.style('fill','#FFD852')
		svg.append('text').text(count).attr('transform','translate(75,80)')
			.style('font-size','1.6em')
			.style('stroke',10)
	}
}

// get the coordinates of stops
function getXYFromTranslate(element){
    var split = element.getAttribute('transform').split(',');
    var x = +split[0].split("(")[1];
    var y = +split[1].split(")")[0];
    return [x, y];
} 


function getTime(datestring) {
var time = [];
if(datestring){
	var msec = Date.parse(datestring);
	var d = new Date(msec);
}else{
	d = new Date()
}
var	timing = (d.getHours() >12? -12 : 0 )+ d.getHours() + ' : ' + (d.getMinutes() <10? '0': '')+d.getMinutes() + ' : ' + (d.getSeconds() <10? '0':'') + d.getSeconds(),
	ap = d.getHours() >=12? ' PM':' AM';
	time.push(timing,ap)
	return time
}
function getDate(datestring){
	var d = new Date(Date.parse(datestring));
	var date = (d.getMonth()+1) + '/' + d.getDate() + '/' + d.getFullYear() + ' ' + (d.getHours() >12? -12 : 0 )+ d.getHours() + ':' + (d.getMinutes() <10? '0': '')+d.getMinutes() + (d.getHours() >=12? ' PM':' AM');
	return date
}


