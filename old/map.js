// MAP
var map = L.map('mapid');
map.setView(new L.LatLng(42.351486,-71.066829), 15);
L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png').addTo(map);
  // possible tile values 
  // light_all,
  // dark_all,
  // light_nolabels,
  // light_only_labels,
  // dark_nolabels,
  // dark_only_labels
//set the zoomcontrol's position
map.zoomControl.setPosition('bottomright')

//reset map view
var resetMap = L.Control.extend({
  options: {
    position: 'bottomright' 
  },
  onAdd: function (map) {
  	var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    container.innerHTML = '<a title = "Back to Boston" role="button"><i class="fa fa-dot-circle-o" aria-hidden="true"></i></a>'
    container.onclick = function(){
      map.setView(new L.LatLng(42.351486,-71.066829), 15);

    }
    return container;
  },

});
map.addControl(new resetMap());

//set a drawcontrol
var drawnItems = new L.FeatureGroup();
drawnItems.options.pane = 'draw';
drawnItems.addTo(map)
var drawControl = new L.Control.Draw({
    draw: {
    	marker: false,
    	polyline:false,
    	circle:false,
    }, 
    position:'topright'
});
map.addControl(drawControl)


//create a popup
var popup = L.popup({className:'popup',closeButton:false})

//create panes for stops
var stopPanes = map.createPane('stops');
	stopPanes.style.zIndex = 550;
	stopPanes.style.pointerEvents = 'none';
//create panes for shapes
var routePanes = map.createPane('routes');
	routePanes.style.zIndex = 440;
	routePanes.style.pointerEvents = 'none';
//create panes for hlshapes
var hlshapePanes = map.createPane('hlshapes');
	hlshapePanes.style.zIndex = 450;
	hlshapePanes.style.pointerEvents = 'none';
//create panes for shapes
var shapePanes = map.createPane('shapes');
	shapePanes.style.zIndex = 410;
	shapePanes.style.pointerEvents = 'none';
//create panes for draw 
var drawPanes = map.createPane('draw');
	drawPanes.style.zIndex = 555;
	drawPanes.style.pointerEvents = 'none';


//TOOLTIP EDIT
map.on('draw:created', function (e) {
	let drawSelection = []
   	let layer = e.layer;   
	let countMarkers = stopMarkers.length
	console.log(layer.getBounds().getCenter())

	for(i=0;i<countMarkers;i++){
		let isInside = isMarkerInsidePolygon(stopMarkers[i].marker,layer)
		if(isInside){
			// console.log('found!'),console.log(stopMarkers[i])
			let foundStopId = stopMarkers[i].marker.options.className.split(' ')[1].replace('stop','')
			drawSelection.push(foundStopId)
			// console.log(drawSelection)
		}
	}
	if(drawSelection.length == 0)return

	drawnItems.addLayer(layer)
	selectionPopup(layer,drawSelection)
	layer.on('mouseover',function(){selectionPopup(layer,drawSelection)})
});
//add a cover layer when drawing to avoid other events fire
map.on('draw:drawstart',function(e){
	document.querySelector('.leaflet-popup-pane').classList.add('hidden')
})
map.on('draw:drawstop',function(e){
	document.querySelector('.leaflet-popup-pane').classList.remove('hidden')
})

//GLOBAL SIZE
var stopRadius = {default:14,select:28}

//DRAW MAP
var stopMarkers = []
function drawStops(){
	//get all parent stops and orphan stops
	stops = allData.stop.filter(function(stop){return stop.parent_station == ''})

	let countStops = stops.length
	for(i=0; i<countStops; i++){
		let stop = stops[i]

		let stopMarker = L.circle([stop.stop_lat,stop.stop_lon], {radius:stopRadius.default,className:'stop stop' + slugStr(stop.stop_id), pane:'stops'})
			.on('mouseover',function(){
				//get info of the stop
				let stopinfo = getStopInfo(stop);
				//show popup
				stopPopup(stop,stopinfo[1],stopinfo[2])
				//highlight the stop
				setStopsDisplay('hover',[stop.stop_id])
			})
			.on('mouseout',function(){
				let stopinfo = getStopInfo(stop);
				setStopsDisplay('default',[stop.stop_id]);
				// map.closePopup();
			})
			.on('click',function(e){
				makeSelection('stop',e.originalEvent.shiftKey,stop.stop_id)
				// populateSelection(e.originalEvent.shiftKey,{stops:[stop.stop_id],routes:[]})
			})
			.addTo(map);
		stopMarkers.push({id:slugStr(stop.stop_id),marker:stopMarker})
	}

}

function drawShapes(shapeId){
	let shapes,type,pane;
	if(shapeId == 'all'){
		shapes = allData.shape;
		type = 'shape'
		pane = 'shapes'
	}else{
		shapes = [allData.shape.find(function(d){return d.key == shapeId})]
		type = 'hlShape'
		pane = 'hlshapes'
	}
	let countShapes = shapes.length
	for(i=0; i<countShapes; i++){
		let shape = shapes[i];
		let shapepts = [];
		shape.values.forEach(function(shapept){
			shapepts.push([shapept.shape_pt_lat,shapept.shape_pt_lon])
		})
		let shapeMarker = L.polyline(shapepts, {className: type + ' ' + type + shape.key,pane:pane})
			.addTo(map);
		if(type == 'hlShape'){
			shapeMarker
				.on('mouseover',function(e){
					//get the shape info
					let shapeinfo = getShapeInfo(shape.key)
					//show the popup
					shapePopup([e.latlng.lat,e.latlng.lng],shapeinfo)
				})
				.on('mouseout',function(){
					map.closePopup();
				})
		}
	}
}
var routeMarkers = []
function drawRoutes(){
	let countRoutes = allNest.route_direction_shape.length
	for(i=0; i<countRoutes; i++){
		let route = allNest.route_direction_shape[i];
		//find the top trips shape of this route
		let topShapeId = route.values[0].values.sort(function(a,b){return b.value - a.value})[0].key
		let topShape = allData.shape.find(function(shape){return shape.key == topShapeId})

		// console.log('topshapeid',route.key,topShape)
		let shapepts = [];
		topShape.values.forEach(function(shapept){
			shapepts.push([shapept.shape_pt_lat,shapept.shape_pt_lon])
		})
		// console.log('shapedots',topShape,shapepts)
		//draw the top shape as this route
		let routeMarker = L.polyline(shapepts, {className: 'route route'+ route.key + ' hlShape' + topShapeId,pane:'routes'})
			.on('mouseover',function(e){
				//get the route info
				let routeData = allData.route.find(function(d){return d.route_id == route.key})
				let touchStops = getRelationships([route.key],'route_stop')
				// show the popup
				if(e.latlng){
					routePopup([e.latlng.lat,e.latlng.lng],routeData,touchStops[0].length)
				}
				
				//highlight the stops on the route
				setStopsDisplay('hover',touchStops[0])
				//highlight the touching routes based on the stops on this route
				setRoutesDisplay('hover',[route.key])

			})
			.on('mouseout',function(){
				let touchStops = getRelationships([route.key],'route_stop')
				setRoutesDisplay('default',[route.key])
				setStopsDisplay('default',touchStops[0])
				// map.closePopup();
				
			})
			.on('click',function(e){
				makeSelection('route',e.originalEvent.shiftKey,route.key)
			})
			.addTo(map);
		routeMarkers.push({id:slugStr(route.key),marker:routeMarker})
	}
}
function showSubway(){
	setRoutesDisplay('subway',subwayLines)
}


function isMarkerInsidePolygon(marker, poly) {
    var inside = false;
    var x = marker.getLatLng().lat, y = marker.getLatLng().lng;
    for (var ii=0;ii<poly.getLatLngs().length;ii++){
        var polyPoints = poly.getLatLngs()[ii];
        for (var i = 0, j = polyPoints.length - 1; i < polyPoints.length; j = i++) {
            var xi = polyPoints[i].lat, yi = polyPoints[i].lng;
            var xj = polyPoints[j].lat, yj = polyPoints[j].lng;

            var intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
    }

    return inside;
};