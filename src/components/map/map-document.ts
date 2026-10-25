import leaflet from "@/assets/map/leaflet.json";

// Both platforms run this local, token-free renderer. All API/business logic stays native.
const runtime = String.raw`
(function () {
  var L = window.L, state = {mode:'explore'}, focusKey = null, dragging = false;
  var map = L.map('map', {zoomControl:false, preferCanvas:true}).setView([14.2813,121.4173],14);
  var pins = L.layerGroup().addTo(map), selection = L.layerGroup().addTo(map), references = L.layerGroup().addTo(map), route = L.layerGroup().addTo(map);
  var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  L.control.zoom({position:'bottomright'}).addTo(map);
  document.querySelectorAll('.leaflet-control-zoom a').forEach(function(a){ a.setAttribute('role','button'); });
  var tileErrors = 0;
  tiles.on('tileerror', function(){ if (++tileErrors === 3) send({type:'tiles-unavailable'}); });
  function send(event) {
    var message = JSON.stringify(Object.assign({source:'surios-map'}, event));
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
    else window.parent.postMessage(message, '*');
  }
  document.querySelector('.leaflet-control-attribution').addEventListener('click', function(e){e.preventDefault();send({type:'attribution'});});
  function icon(text, className, color) {
    var span = document.createElement('span'); span.className=className; span.textContent=text;
    if(color) span.style.backgroundColor=color;
    return L.divIcon({className:'pin-root',html:span,iconSize:[36,40],iconAnchor:[18,38]});
  }
  function color(n){return n>=8?'#dc2626':n>=4?'#a95c00':'#64748b';}
  function drawPins() {
    pins.clearLayers(); references.clearLayers(); route.clearLayers();
    if(state.mode !== 'explore') return;
    (state.referenceRoads||[]).forEach(function(road){ L.polyline(road.coordinates,{color:'#78716c',weight:3,opacity:.7,dashArray:'5 5',interactive:false}).addTo(references); });
    if(state.route && state.route.length>1) L.polyline(state.route,{color:'#C93D00',weight:4,dashArray:state.routeEstimated?'6 6':null}).addTo(route);
    var clusters = new Map();
    (state.pins||[]).forEach(function(h){
      if(h.roadSegment){
        var coords=h.roadSegment.coordinates;
        L.polyline(coords,{color:color(h.severity),weight:7,opacity:.85}).on('click',function(e){L.DomEvent.stopPropagation(e);send({type:'select',ids:[h.id]});}).addTo(pins);
        [coords[0],coords[coords.length-1]].forEach(function(p){ L.circleMarker(p,{radius:5,color:'#fff',weight:2,fillColor:color(h.severity),fillOpacity:1}).on('click',function(){send({type:'select',ids:[h.id]});}).addTo(pins); });
      }
      var p=map.latLngToLayerPoint([h.latitude,h.longitude]), key=Math.round(p.x/42)+':'+Math.round(p.y/42);
      var group=clusters.get(key)||[]; group.push(h); clusters.set(key,group);
    });
    clusters.forEach(function(group){
      var h=group.slice().sort(function(a,b){return b.severity-a.severity;})[0];
      var pin=icon(h.severity,'hazard-pin',color(h.severity));
      if(group.length>1){var count=document.createElement('small');count.textContent=group.length;pin.options.html.appendChild(count);}
      var title=group.length>1?group.length+' separate hazards, highest severity '+h.severity:h.title+', severity '+h.severity;
      var marker=L.marker([h.latitude,h.longitude],{icon:pin,title:title,keyboard:true}).addTo(pins);
      marker.on('add',function(){ marker.getElement().setAttribute('aria-label',title); });
      if(marker.getElement()) marker.getElement().setAttribute('aria-label',title);
      marker.on('click',function(){send({type:'select',ids:group.map(function(item){return item.id;})});});
    });
  }
  function shadow(point) {
    return L.marker(point,{interactive:false,keyboard:false,icon:L.divIcon({className:'drop-shadow',iconSize:[32,12],iconAnchor:[16,6]})}).addTo(selection);
  }
  function drawSelection() {
    if(dragging) return;
    selection.clearLayers();
    if(state.mode==='explore') return;
    var point=state.point||[map.getCenter().lat,map.getCenter().lng];
    if(state.section){
      L.polyline(state.section.coordinates,{color:'#C93D00',weight:6}).addTo(selection);
      ['start','end'].forEach(function(which,i){
        var coords=state.section.coordinates, p=i?coords[coords.length-1]:coords[0];
        L.marker(p,{draggable:!state.disabled,icon:icon(i?'B':'A','road-end')}).addTo(selection).on('dragstart',function(){dragging=true;}).on('dragend',function(e){dragging=false;var p=e.target.getLatLng();send({type:'endpoint',which:which,point:[p.lat,p.lng]});});
      });
    }
    var ghost=!state.point && !state.section;
    var s=shadow(point);
    var marker=L.marker(point,{draggable:!state.disabled && (state.mode==='point'||ghost),keyboard:true,title:ghost?'Drop pin here':'Drag report pin',icon:icon('','location-pin'+(ghost&&!state.reducedMotion?' hopping':''))}).addTo(selection);
    if(ghost) marker.on('click',function(){if(!state.disabled)send({type:'pick',point:point});});
    marker.on('dragstart',function(){dragging=true;marker.getElement().classList.add('lifting');});
    marker.on('drag',function(){s.setLatLng(marker.getLatLng());});
    marker.on('dragend',function(){dragging=false;marker.getElement().classList.remove('lifting');var p=marker.getLatLng();send({type:'pick',point:[p.lat,p.lng]});});
  }
  map.on('click',function(e){if(state.mode!=='explore'&&!state.disabled)send({type:'pick',point:[e.latlng.lat,e.latlng.lng]});});
  map.on('moveend zoomend',function(){drawPins();if(!state.point&&!state.section)drawSelection();var p=map.getCenter();send({type:'center',point:[p.lat,p.lng]});});
  function receive(event){
    if(!window.ReactNativeWebView && event.source !== window.parent) return;
    var msg=event.data;
    try {if(typeof msg==='string')msg=JSON.parse(msg);}catch(e){return;}
    if(!msg || msg.source!=='surios-app' || msg.type!=='state')return;
    clearInterval(readyTimer); state=msg.state;
    if(state.disabled){map.dragging.disable();map.touchZoom.disable();map.doubleClickZoom.disable();}else{map.dragging.enable();map.touchZoom.enable();map.doubleClickZoom.enable();}
    if(state.focus && state.focus.key!==focusKey){focusKey=state.focus.key;if(state.focus.bounds && state.focus.bounds.length){map.fitBounds(state.focus.bounds,{padding:[48,80],maxZoom:18,animate:false});}else if(state.focus.point){map.setView(state.focus.point,state.focus.zoom||17,{animate:false});}}
    drawPins();drawSelection();
  }
  window.addEventListener('message',receive); document.addEventListener('message',receive);
  new ResizeObserver(function(){map.invalidateSize({pan:false});}).observe(document.getElementById('map'));
  var readyTimer=setInterval(function(){send({type:'ready'});},250);send({type:'ready'});
})();`;

export const mapDocument = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https://tile.openstreetmap.org data:;"><style>${leaflet.css}\nhtml,body,#map{height:100%;width:100%;margin:0;background:#F2F1ED;font-family:system-ui} .leaflet-control-zoom{border:1px solid #DEDEE3!important;border-radius:12px!important;overflow:hidden;box-shadow:none!important}.leaflet-control-zoom a{width:48px!important;height:48px!important;line-height:48px!important;color:#18181B!important;background:white!important}.leaflet-control-attribution{font-size:10px!important}.pin-root{background:none;border:0}.hazard-pin{display:flex;position:relative;align-items:center;justify-content:center;width:32px;height:32px;border:2px solid white;border-radius:10px 10px 10px 2px;color:white;font:700 13px system-ui;box-shadow:0 2px 4px #0003}.hazard-pin small{position:absolute;top:-8px;right:-9px;min-width:18px;height:18px;border:1px solid white;border-radius:12px;background:#18181B;display:grid;place-items:center;font:600 10px system-ui}.location-pin{display:block;position:relative;margin:4px 6px;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#C93D00;border:3px solid white;box-shadow:0 1px 4px #0003}.location-pin:after{content:'';position:absolute;left:7px;top:7px;width:10px;height:10px;background:white;border-radius:50%}.road-end{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#C93D00;color:white;border:3px solid white;font:700 14px system-ui}.drop-shadow{border-radius:50%;background:#0005;box-shadow:0 0 0 2px #C93D00;pointer-events:none}.hopping{animation:hop 1.3s ease-in-out infinite}.lifting .location-pin{translate:0 -10px}@keyframes hop{0%,60%,100%{translate:0 0}30%{translate:0 -7px}}@media(prefers-reduced-motion:reduce){.hopping{animation:none}} .leaflet-control-attribution{cursor:pointer} </style></head><body><div id="map" role="region" aria-label="OpenStreetMap street map"></div><script>${leaflet.js.replaceAll("</script", "<\\/script")}</script><script>${runtime}</script></body></html>`;
