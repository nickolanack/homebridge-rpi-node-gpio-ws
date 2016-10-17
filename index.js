var http = require('http');
var WebSocket=require('ws')

var sprinklerUrl='ws://the.garden:8080';

var Accessory, Service, Characteristic, UUIDGen;

var pluginName='rpi';
var platformName='Sprinklers';

module.exports = function(homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  
  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform(pluginName, platformName, RaspberryPiSprinklers, true);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function RaspberryPiSprinklers(log, config, api) {
  log("RaspberryPiSprinklers Init");
  var platform = this;
  this.log = log;
  this.config = config;
  this.accessories = [];


  var ws=new WebSocket(sprinklerUrl);
    ws.on('open', function open() {
    
  
      platform.log("Connected to Sprinklers");
        
      ws.on('message', function(data, flags) {
        


        var parts=data.split(':');
        var task=parts.shift();
        var json={};

        if(parts.length&&(parts[0].indexOf('[')===0||parts[0].indexOf('{')===0)){
          json=JSON.parse(parts.join(':'));
        }


        platform.log(data);

        if(task==="list_devices"){

          platform.devices=json;

          platform.accessories.forEach(function(accessory){

            //if(!platform.accessoryInDevices(accessory)){
              platform.removeSprinkler(accessory);
           // }

          });

          platform.devices.forEach(function(deviceMeta){

            if(!platform.hasSprinklerAccessory(deviceMeta.name)){
              platform.addSprinkler(deviceMeta.name);
            }

            platform.updateSprinklerValue(deviceMeta.name, deviceMeta.state);
            platform.initSprinklerEvents(ws, deviceMeta.name);

          });


        }

        if(task==='notification.statechange'){

          platform.updateSprinklerValue(platform.deviceNameFromPin(json.pin), json.value);


        }

      });

      ws.send(JSON.stringify({"id":"list_devices","task":"list_devices","json":{}}));



  });




  if (api) {
      // Save the API object as plugin needs to register new accessory via this object.
      this.api = api;

      // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories
      // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
      // Or start discover new accessories
      this.api.on('didFinishLaunching', function() {
        platform.log("DidFinishLaunching");
      }.bind(this));
  }
}

RaspberryPiSprinklers.prototype.deviceNameFromPin = function(pin) {

   var platform=this;

  
   //console.log('checking : '+accessory.displayName);
   //console.log(accessory);

   for(var i=0;i<platform.devices.length;i++){
    //console.log('check: '+platform.devices[i].name);
    if(platform.devices[i].pin===pin){
       //console.log('true');
      return platform.devices[i].name;
    }
   }

    //console.log('false');

   return false;

};


RaspberryPiSprinklers.prototype.devicePinFromName = function(name) {

   var platform=this;

  
   //console.log('checking : '+accessory.displayName);
   //console.log(accessory);

   for(var i=0;i<platform.devices.length;i++){
    //console.log('check: '+platform.devices[i].name);
    if(platform.devices[i].name===name){
       //console.log('true');
      return platform.devices[i].pin;
    }
   }

    //console.log('false');

   return false;

};

RaspberryPiSprinklers.prototype.accessoryInDevices = function(accessory) {

   var platform=this;

  
   //console.log('checking : '+accessory.displayName);
   //console.log(accessory);

   for(var i=0;i<platform.devices.length;i++){
    //console.log('check: '+platform.devices[i].name);
    if(platform.devices[i].name===accessory.displayName){
       //console.log('true');
      return true;
    }
   }

    //console.log('false');

   return false;

};


// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
RaspberryPiSprinklers.prototype.configureAccessory = function(accessory) {
  this.log(accessory.displayName, "Configure Accessory");
  var platform = this;

  // set the accessory to reachable if plugin can currently process the accessory
  // otherwise set to false and update the reachability later by invoking 
  // accessory.updateReachability()
  accessory.reachable = true;

  accessory.on('identify', function(paired, callback) {
    platform.log(accessory.displayName, "Identify!!!");
    callback();
  });


  this.accessories.push(accessory);
}

//Handler will be invoked when user try to config your plugin
//Callback can be cached and invoke when nessary
RaspberryPiSprinklers.prototype.configurationRequestHadnler = function(context, request, callback) {
  this.log("Context: ", JSON.stringify(context));
  this.log("Request: ", JSON.stringify(request));

  // Check the request response
  if (request && request.response && request.response.inputs && request.response.inputs.name) {
    this.addSprinkler(request.response.inputs.name);

    // Invoke callback with config will let homebridge save the new config into config.json
    // Callback = function(response, type, replace, config)
    // set "type" to platform if the plugin is trying to modify platforms section
    // set "replace" to true will let homebridge replace existing config in config.json
    // "config" is the data platform trying to save
    callback(null, "platform", true, {"platform":platformName, "otherConfig":"SomeData"});
    return;
  }

  // - UI Type: Input
  // Can be used to request input from user
  // User response can be retrieved from request.response.inputs next time
  // when configurationRequestHandler being invoked

  var respDict = {
    "type": "Interface",
    "interface": "input",
    "title": "Add Accessory",
    "items": [
      {
        "id": "name",
        "title": "Name",
        "placeholder": "Fancy Light"
      }//, 
      // {
      //   "id": "pw",
      //   "title": "Password",
      //   "secure": true
      // }
    ]
  }

  // - UI Type: List
  // Can be used to ask user to select something from the list
  // User response can be retrieved from request.response.selections next time
  // when configurationRequestHandler being invoked

  // var respDict = {
  //   "type": "Interface",
  //   "interface": "list",
  //   "title": "Select Something",
  //   "allowMultipleSelection": true,
  //   "items": [
  //     "A","B","C"
  //   ]
  // }

  // - UI Type: Instruction
  // Can be used to ask user to do something (other than text input)
  // Hero image is base64 encoded image data. Not really sure the maximum length HomeKit allows.

  // var respDict = {
  //   "type": "Interface",
  //   "interface": "instruction",
  //   "title": "Almost There",
  //   "detail": "Please press the button on the bridge to finish the setup.",
  //   "heroImage": "base64 image data",
  //   "showActivityIndicator": true,
  // "showNextButton": true,
  // "buttonText": "Login in browser",
  // "actionURL": "https://google.com"
  // }

  // Plugin can set context to allow it track setup process
  context.ts = "Hello";

  //invoke callback to update setup UI
  callback(respDict);
}

// Sample function to show how developer can add accessory dynamically from outside event
RaspberryPiSprinklers.prototype.addSprinkler = function(accessoryName) {
  this.log("Add Accessory: "+accessoryName);
  var platform = this;
  var uuid;

  uuid = UUIDGen.generate(accessoryName);

  var newAccessory = new Accessory(accessoryName, uuid);
  newAccessory.on('identify', function(paired, callback) {
    platform.log(accessory.displayName, "Identify!!!");
    callback();
  });
  // Plugin can save context on accessory
  // To help restore accessory in configureAccessory()
  // newAccessory.context.something = "Something"


  newAccessory.addService(Service.Switch, accessoryName);

  this.accessories.push(newAccessory);
  this.api.registerPlatformAccessories(pluginName, platformName, [newAccessory]);
  return newAccessory;
}

RaspberryPiSprinklers.prototype.updateAccessoriesReachability = function() {
  this.log("Update Reachability");
  for (var index in this.accessories) {
    var accessory = this.accessories[index];
    accessory.updateReachability(false);
  }
}

// Sample function to show how developer can remove accessory dynamically from outside event
RaspberryPiSprinklers.prototype.removeSprinkler = function(accessory) {
  this.log("Remove Accessory");
  this.api.unregisterPlatformAccessories(pluginName, platformName, [accessory]);

  this.accessories = [];
}
RaspberryPiSprinklers.prototype.getSprinklerAccessory = function(sprinkerName) {
 var platform=this;

   for(var i=0;i<platform.accessories.length;i++){
    if(platform.accessories[i].displayName===sprinkerName){
      return platform.accessories[i]
    }
   }
   return false;
}

RaspberryPiSprinklers.prototype.hasSprinklerAccessory = function(sprinkerName) {
  return !!this.getSprinklerAccessory(sprinkerName);
}

RaspberryPiSprinklers.prototype.updateSprinklerValue = function(sprinkerName, value) {
 var accessory=this.getSprinklerAccessory(sprinkerName);


this.log(sprinkerName+" - Update value: "+value);


    accessory.getService(Service.Switch)
    .updateCharacteristic(Characteristic.On, value);


}


RaspberryPiSprinklers.prototype.initSprinklerEvents = function(ws, sprinkerName) {

 var platform=this;
 var accessory=this.getSprinklerAccessory(sprinkerName);



 if( accessory.getService(Service.Switch)){
 accessory.getService(Service.Switch)
    .getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      platform.log(accessory.displayName+" Sprinker Event -> " + value);

      ws.send(JSON.stringify({"id":"set_device_value","task":"set_device_value","json":{"pin":platform.devicePinFromName(accessory.displayName),"value":value}}));

      callback();
    });
  }

}

