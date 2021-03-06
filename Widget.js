///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/_base/html',
    "dojo/dom-construct",
    'dojo/i18n!esri/nls/jsapi',
    "dojo/dom-attr",
    'dojo/on',
    "esri/layers/FeatureLayer",
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidget',
    'jimu/MapManager',
    "esri/tasks/query", 
    "esri/tasks/QueryTask",
    'jimu/LayerInfos/LayerInfos',
    'esri/dijit/editing/Editor',
    "esri/tasks/RelationshipQuery",
    'esri/dijit/Popup',
    "esri/dijit/editing/TemplatePicker",
    "dijit/form/Button","dojo/store/Memory", "dijit/form/Select",
    "./utils"
  ],
  function(declare, lang, array, html, domConstruct, esriBundle, domAttr, on, FeatureLayer, _WidgetsInTemplateMixin,
    BaseWidget, MapManager, Query, QueryTask, LayerInfos, Editor, RelationshipQuery, Popup, TemplatePicker, Button, Memory, Select, editUtils) {
    return declare([BaseWidget, _WidgetsInTemplateMixin], {
      name: 'EditRelated',
      baseClass: 'jimu-widget-edit',
      editor: null,
      _defaultStartStr: "",
      _defaultAddPointStr: "",
      resetInfoWindow: {},
      _sharedInfoBetweenEdits: {
        editCount: 0,
        resetInfoWindow: null
      },
      _jimuLayerInfos: null,
      editPopup: null,
      _configEditor: null,

      startup: function() {
        this.inherited(arguments);
        this.editPopup = new Popup(null, html.create("div",
                                                    {"class":"jimu-widget-edit-infoWindow"},
                                                    null,
                                                    this.map.root));
      },

      _init: function() {
        this._editorMapClickHandlers = [];
        this._configEditor = lang.clone(this.config.editor);
        if (this._configEditor.runMinimized){
          html.setStyle(this.domNode.parentNode.parentNode.parentNode, 'display', 'none');
        }
      },

      onOpen: function() {
        this._init();
        LayerInfos.getInstance(this.map, this.map.itemInfo)
          .then(lang.hitch(this, function(operLayerInfos) {
            this._jimuLayerInfos = operLayerInfos;
            //ADAdd
            array.forEach(operLayerInfos._finalLayerInfos,lang.hitch(this,function(layerInfo){
              if (layerInfo.layerObject.relationships && layerInfo.layerObject.type == "Feature Layer"){
                array.forEach(layerInfo.layerObject.relationships,lang.hitch(this,function(relationship){
                  layerInfo.layerObject.on("click",lang.hitch(this,function(evt){
                    var signal = _viewerMap.infoWindow.on("show",lang.hitch(this,function(){
                      signal.remove()
                      domConstruct.destroy(dojo.query(".atiAttributes table")[0])
                      dojo.query(".relatedItems").forEach(function(node){domConstruct.destroy(node)});
                      var queryTask = new QueryTask(layerInfo.layerObject.url.replace("FeatureServer","MapServer"))
                      var query = new Query()
                      //query.where = "GISADM.RE_CityFacilities2.OBJECTID=" + evt.graphic.attributes["OBJECTID"]
                      query.where = layerInfo.layerObject.displayField.substring(0, layerInfo.layerObject.displayField.lastIndexOf('.')) + "." + layerInfo.layerObject.objectIdField + "=" + evt.graphic.attributes[layerInfo.layerObject.objectIdField]
                      query.outFields = ["*"]
                      queryTask.execute(query,lang.hitch(this,function(results){
                        for (var key in results.features[0].attributes){
                          array.forEach(this.getThisLayerInfo(this.config.editor,layerInfo.id).fieldInfos, lang.hitch(this,function(_field){
                            if (_field.fieldName == key){
                              var row = domConstruct.toDom('<tr class="relatedItems"><td class="atiLabel">' + key + '</td><td width="100%">' + results.features[0].attributes[key] + '</td></tr>')
                              domConstruct.place(row, dojo.query(".atiAttributes")[0])               
                            }
                          }))                  
                        }
                        var relatedQuery = new RelationshipQuery();
                        relatedQuery.outFields = ["*"];
                        relatedQuery.relationshipId = relationship.id;
                        graphicAttributes = evt.graphic.attributes;
                        relatedQuery.objectIds = [graphicAttributes[evt.graphic._layer.objectIdField]];
                        layerInfo.layerObject.queryRelatedFeatures(relatedQuery,lang.hitch(this,function(relatedRecords){
                          relatedChange = function(event, uniqueId, fieldName, foreignKeyField, objectId, objectIdField, isNew) {
                            var relatedChangeRecord = {
                              attributes: {}
                            };
                            relatedChangeRecord.attributes[foreignKeyField]=uniqueId;
                            relatedChangeRecord.attributes[fieldName] = event
                            var str = layerInfo.layerObject.url.substr(layerInfo.layerObject.url.lastIndexOf('/') + 1);
                            var relatedURL = layerInfo.layerObject.url.replace( new RegExp(str), '' ) + relationship.relatedTableId;
                            var relatedTable = new FeatureLayer(relatedURL);
                            if (isNew){
                              relatedTable.applyEdits([relatedChangeRecord],null,null);  
                            }else{
                              relatedChangeRecord.attributes[objectIdField] = objectId;
                              relatedTable.applyEdits(null,[relatedChangeRecord],null);  
                            }
                            
                          };
                          var str = layerInfo.layerObject.url.substr(layerInfo.layerObject.url.lastIndexOf('/') + 1);
                          var relatedURL = layerInfo.layerObject.url.replace( new RegExp(str), '' ) + relationship.relatedTableId;
                          var relatedTable = new FeatureLayer(relatedURL);
                          relatedTable.on("load",lang.hitch(this,function(loadedLayer){
                            relatedTable = loadedLayer.layer
                            if (Object.keys(relatedRecords).length == 0){
                                array.forEach(relatedTable.fields,lang.hitch(this,function(field){
                                  array.forEach(this.getThisLayerInfo(this.config.editor,layerInfo.id).fieldInfos, lang.hitch(this,function(_field){
                                    if (_field.fieldName.substring(3) == field.name && _field.isEditable && _field.label == field.alias && field.name != relatedTable.relationships[0].keyField && field.name != layerInfo.layerObject.objectIdField){
                                      if (field.domain){
                                        var row = domConstruct.toDom('<tr class="relatedItems"><td class="atiLabel">' + field.alias + '</td><td><input id="select_' + field.name + '"></input></td></tr>')
                                        domConstruct.place(row, dojo.query(".atiAttributes")[0])   
                                        if (dijit.registry.byId("select_" + field.name)){
                                          dijit.registry.byId("select_" + field.name).destroy()
                                        }
                                        for (var i = 0; i < field.domain.codedValues.length; i++){
                                          field.domain.codedValues[i].label = field.domain.codedValues[i].name
                                          field.domain.codedValues[i].value = field.domain.codedValues[i].code
                                        }
                                        var comboBox = new Select({
                                          id: "select_" + field.name,
                                          name: field.alias,
                                          value: "0",
                                          options: field.domain.codedValues
                                        }, "select_" + field.name)
                                        comboBox.startup();
                                        comboBox.on("change",function(){
                                          relatedChange(this.get("value"),graphicAttributes[relationship.keyField],field.name,relatedTable.relationships[0].keyField,"","",true)
                                          setTimeout(function(){_viewerMap.setExtent(_viewerMap.extent)},500)
                                        })
                                      }else{
                                        var row = domConstruct.toDom('<tr class="relatedItems"><td class="atiLabel">' + field.alias + '</td><td width="100%"><div class="dijit dijitReset dijitInline dijitLeft atiField dijitTextBox" role="presentation"><div class="dijitReset dijitInputField dijitInputContainer"><input class="dijitReset dijitInputInner" data-dojo-attach-point="textbox,focusNode" autocomplete="off" type="text"' + " onblur='relatedChange(event," + '"' + graphicAttributes[relationship.keyField] + '"' + ',"' + field.name + '","' + relatedTable.relationships[0].keyField + '","","",true)' + "'" + ' tabindex="0" value="" aria-disabled="false"></div></div></td></tr>')  
                                        domConstruct.place(row, dojo.query(".atiAttributes")[0])      
                                      }                              
                                      //domConstruct.place(this.editor.attributeInspector._createDomainField(field).domNode, dojo.query(".atiAttributes")[0])
                                    }
                                  }))
                                }))
                            }else{
                              for (var field in relatedRecords[graphicAttributes[evt.graphic._layer.objectIdField]].features[0].attributes){
                                array.forEach(this.getThisLayerInfo(this.config.editor,layerInfo.id).fieldInfos, lang.hitch(this,function(_field){
                                  array.forEach(relatedTable.fields,lang.hitch(this,function(afield){
                                    if (_field.fieldName.substring(3) == field && field == afield.name && _field.isEditable && field != relatedTable.relationships[0].keyField && field != layerInfo.layerObject.objectIdField){
                                      var displayValue = ""
                                      if (relatedRecords[graphicAttributes[evt.graphic._layer.objectIdField]].features[0].attributes[field]){
                                        displayValue = relatedRecords[graphicAttributes[evt.graphic._layer.objectIdField]].features[0].attributes[field]
                                      }
                                      if (afield.domain){
                                        var row = domConstruct.toDom('<tr class="relatedItems"><td class="atiLabel">' + afield.alias + '</td><td><input id="select_' + afield.name + '"></input></td></tr>')
                                        domConstruct.place(row, dojo.query(".atiAttributes")[0])   
                                        if (dijit.registry.byId("select_" + afield.name)){
                                          dijit.registry.byId("select_" + afield.name).destroy()
                                        }
                                        for (var i = 0; i < afield.domain.codedValues.length; i++){
                                          afield.domain.codedValues[i].label = afield.domain.codedValues[i].name
                                          afield.domain.codedValues[i].value = afield.domain.codedValues[i].code
                                        }
                                        var comboBox = new Select({
                                          id: "select_" + afield.name,
                                          name: afield.alias,
                                          value: displayValue,
                                          options: afield.domain.codedValues
                                        }, "select_" + afield.name)
                                        comboBox.startup();
                                        comboBox.on("change",function(){
                                          relatedChange(this.get("value"),graphicAttributes[relationship.keyField],afield.name,relatedTable.relationships[0].keyField,relatedRecords[graphicAttributes[evt.graphic._layer.objectIdField]].features[0].attributes[relatedRecords[graphicAttributes[evt.graphic._layer.objectIdField]].features[0]._layer.objectIdField],relatedRecords[graphicAttributes[evt.graphic._layer.objectIdField]].features[0]._layer.objectIdField,false)
                                          setTimeout(function(){_viewerMap.setExtent(_viewerMap.extent)},500)
                                        })
                                      }else{
                                        var row = domConstruct.toDom('<tr class="relatedItems"><td class="atiLabel">' + afield.alias + '</td><td width="100%"><div class="dijit dijitReset dijitInline dijitLeft atiField dijitTextBox" role="presentation"><div class="dijitReset dijitInputField dijitInputContainer"><input class="dijitReset dijitInputInner" data-dojo-attach-point="textbox,focusNode" autocomplete="off" type="text"' + " onblur='relatedChange(event," + '"' + graphicAttributes[relationship.keyField] + '"' + ',"' + afield + '","' + relatedTable.relationships[0].keyField + '", ' + relatedRecords[graphicAttributes[evt.graphic._layer.objectIdField]].features[0].attributes[relatedRecords[graphicAttributes[evt.graphic._layer.objectIdField]].features[0]._layer.objectIdField] + ',"' + relatedRecords[graphicAttributes[evt.graphic._layer.objectIdField]].features[0]._layer.objectIdField + '",false)' + "'" + ' tabindex="0" value="' + displayValue + '" aria-disabled="false"></div></div></td></tr>')
                                        domConstruct.place(row, dojo.query(".atiAttributes")[0])
                                      }
                                      //domConstruct.place(this.editor.attributeInspector._createDomainField(afield).domNode, dojo.query(".atiAttributes")[0])
                                    }
                                  }))
                                }))
                              }
                            }
                          }))
                        }))
                      }))
                    }))
                  }))
                }))
              }
            }))
            //
            setTimeout(lang.hitch(this, function() {
              this.widgetManager.activateWidget(this);
              this._createEditor();
            }), 1);
          }));
      },

      getThisLayerInfo: function(config,id){
        var match
        array.forEach(config.layerInfos,function(layerInfo){
          if (layerInfo.featureLayer.id == id){
            match = layerInfo;
          }
        })
        return match;
      },

      onActive: function(){
        this.disableWebMapPopup();
      },

      onDeActive: function(){
        this.enableWebMapPopup();
      },

      disableWebMapPopup: function() {
        var mapManager = MapManager.getInstance();
        mapManager.disableWebMapPopup();
        // hide map's infoWindow
        this.map.infoWindow.hide();
        // instead of map's infowindow by editPopup
        this.map.setInfoWindow(this.editPopup);
        this._enableMapClickHandler();

        // instead of Mapmanager.resetInfoWindow by self resetInfoWindow
        if (this._sharedInfoBetweenEdits.resetInfoWindow === null) {
          this._sharedInfoBetweenEdits.resetInfoWindow = mapManager.resetInfoWindow;
          this.own(on(this.map.infoWindow, "show", lang.hitch(this, function() {
            if (window.appInfo.isRunInMobile) {
              this.map.infoWindow.maximize();
            }
          })));
        }
        mapManager.resetInfoWindow = lang.hitch(this, function() {});

        //this._sharedInfoBetweenEdits.editCount++;
      },

      enableWebMapPopup: function() {
        var mapManager = MapManager.getInstance();
        var mapInfoWindow = mapManager.getMapInfoWindow();
        // recover restInfoWindow when close widget.
        //this._sharedInfoBetweenEdits.editCount--;
        if (this._sharedInfoBetweenEdits.resetInfoWindow) {
          //this._sharedInfoBetweenEdits.editCount === 0 &&

          this.map.setInfoWindow(mapInfoWindow.bigScreen);
          mapManager.isMobileInfoWindow = false;

          mapManager.resetInfoWindow =
            lang.hitch(mapManager, this._sharedInfoBetweenEdits.resetInfoWindow);
          this._sharedInfoBetweenEdits.resetInfoWindow = null;
          mapManager.resetInfoWindow();
          this._disableMapClickHandler();
          // hide popup and delete seleection
          this.editPopup.hide();
          this.editor._clearSelection();
          // recall enableWebMap
          mapManager.enableWebMapPopup();
        }
      },

      _enableMapClickHandler: function() {
        if (this.editor) {
          this._editorMapClickHandlers.push(this.editor._mapClickHandler);
          this.editor._enableMapClickHandler();
          this._editorMapClickHandlers.push(this.editor._mapClickHandler);
        }
      },

      _disableMapClickHandler: function() {
        if (this.editor) {
          this.editor._disableMapClickHandler();
          array.forEach(this._editorMapClickHandlers, function(editorMapClickHandler) {
            if(editorMapClickHandler && editorMapClickHandler.remove) {
              editorMapClickHandler.remove();
            }
          });
          this._editorMapClickHandlers = [];
        }
      },

      _getDefaultFieldInfos: function(layerId) {
        // summary:
        //  filter webmap fieldInfos.
        // description:
        //   return null if fieldInfos has not been configured in webmap.
        var fieldInfos = editUtils.getFieldInfosFromWebmap(layerId, this._jimuLayerInfos);
        if(fieldInfos) {
          fieldInfos = array.filter(fieldInfos, function(fieldInfo) {
            return fieldInfo.visible || fieldInfo.isEditable;
          });
        }
        return fieldInfos;
      },

      _getDefaultLayerInfos: function() {
        var defaultLayerInfos = [];
        var fieldInfos;
        for(var i = this.map.graphicsLayerIds.length - 1; i >= 0 ; i--) {
          var layerObject = this.map.getLayer(this.map.graphicsLayerIds[i]);
          if (layerObject.type === "Feature Layer" && layerObject.url) {
            var layerInfo = {
              featureLayer: {}
            };
            layerInfo.featureLayer.id = layerObject.id;
            layerInfo.disableGeometryUpdate = false;
            fieldInfos = this._getDefaultFieldInfos(layerObject.id);
            if(fieldInfos && fieldInfos.length > 0) {
              layerInfo.fieldInfos = fieldInfos;
            }
            defaultLayerInfos.push(layerInfo);
          }
        }
        return defaultLayerInfos;
      },

      _converConfiguredLayerInfos: function(layerInfos) {
        array.forEach(layerInfos, function(layerInfo) {
          // convert layerInfos to compatible with old version
          if(!layerInfo.featureLayer.id && layerInfo.featureLayer.url) {
            var layerObject = getLayerObjectFromMapByUrl(this.map, layerInfo.featureLayer.url);
            if(layerObject) {
              layerInfo.featureLayer.id = layerObject.id;
            }
          }

          // convert fieldInfos
          var newFieldInfos = [];
          var webmapFieldInfos =
            editUtils.getFieldInfosFromWebmap(layerInfo.featureLayer.id, this._jimuLayerInfos);
          array.forEach(layerInfo.fieldInfos, function(fieldInfo) {
            if(/*fieldInfo.isEditable &&*/
               // only for compitible with old version of config.
               // 'globalid' and 'objectid' can not appear in new app's config.
               fieldInfo.fieldName !== "globalid" &&
               fieldInfo.fieldName !== "objectid") {
              var webmapFieldInfo = getFieldInfoFromWebmapFieldInfos(webmapFieldInfos, fieldInfo);
              if(webmapFieldInfo) {
                if( webmapFieldInfo.isEditable ||
                    webmapFieldInfo.isEditableSettingInWebmap ||
                    webmapFieldInfo.visible) {
                  newFieldInfos.push(webmapFieldInfo);
                }
              } else {
                newFieldInfos.push(fieldInfo);
              }
            }
          }, this);

          if(newFieldInfos.length !== 0) {
            layerInfo.fieldInfos = newFieldInfos;
          }
        }, this);
        return layerInfos;

        function getFieldInfoFromWebmapFieldInfos(webmapFieldInfos, fieldInfo) {
          var resultFieldInfo = null;
          if(webmapFieldInfos) {
            for(var i = 0; i < webmapFieldInfos.length; i++) {
              if(fieldInfo.fieldName === webmapFieldInfos[i].fieldName) {
                webmapFieldInfos[i].label = fieldInfo.label;
                webmapFieldInfos[i].isEditableSettingInWebmap = webmapFieldInfos[i].isEditable;
                webmapFieldInfos[i].isEditable = fieldInfo.isEditable;
                resultFieldInfo = webmapFieldInfos[i];
                // resultFieldInfo.label = fieldInfo.label;
                // resultFieldInfo.isEditableSettingInWebmap = webmapFieldInfos[i].isEditable;
                // resultFieldInfo.isEditable = fieldInfo.isEditable;
                break;
              }
            }
          }
          return resultFieldInfo;
        }

        function getLayerObjectFromMapByUrl(map, layerUrl) {
          var resultLayerObject = null;
          for(var i = 0; i < map.graphicsLayerIds.length; i++) {
            var layerObject = map.getLayer(map.graphicsLayerIds[i]);
            if(layerObject.url.toLowerCase() === layerUrl.toLowerCase()) {
              resultLayerObject = layerObject;
              break;
            }
          }
          return resultLayerObject;
        }
      },

      _getLayerInfosParam: function() {
        // var retDef = new Deferred();
        // var defs = [];
        var layerInfos;
        var resultLayerInfosParam = [];
        if(!this._configEditor.layerInfos) {
          // configured in setting page and no layers checked.
          layerInfos = [];
        } else if(this._configEditor.layerInfos.length > 0)  {
          // configured and has been checked.
          layerInfos = this._converConfiguredLayerInfos(this._configEditor.layerInfos);
        } else {
          // has not been configure.
          layerInfos = this._getDefaultLayerInfos();
        }

        //according to condition to filter
        array.forEach(layerInfos, function(layerInfo) {
          var layerObject = this.map.getLayer(layerInfo.featureLayer.id);
          if(layerObject &&
             layerObject.visible &&
             layerObject.isEditable &&
             layerObject.isEditable()) {
            layerInfo.featureLayer = layerObject;
            resultLayerInfosParam.push(layerInfo);
          }
        }, this);
        return resultLayerInfosParam;
      },

      _getTemplatePicker: function(layerInfos) {
        var layerObjects = [];

        array.forEach(layerInfos, function(layerInfo) {
          if(layerInfo.featureLayer &&
            layerInfo.featureLayer.getEditCapabilities &&
            layerInfo.featureLayer.getEditCapabilities().canCreate) {
            layerObjects.push(layerInfo.featureLayer);
          }
        }, this);

        var templatePicker = new TemplatePicker({
          featureLayers: layerObjects,
          grouping: true,
          rows: "auto",
          columns: "auto",
          style: this._configEditor.toolbarVisible ? "" : "bottom: 0px"
        }, html.create("div", {}, this.domNode));
        templatePicker.startup();
        return templatePicker;
      },

      _getSettingsParam: function() {
        var settings = {
          map: this.map,
          createOptions: {
            polygonDrawTools: [
              Editor.CREATE_TOOL_ARROW,
              Editor.CREATE_TOOL_AUTOCOMPLETE,
              Editor.CREATE_TOOL_CIRCLE,
              Editor.CREATE_TOOL_ELLIPSE,
              Editor.CREATE_TOOL_RECTANGLE,
              Editor.CREATE_TOOL_TRIANGLE,
              Editor.CREATE_TOOL_POLYGON,
              Editor.CREATE_TOOL_FREEHAND_POLYGON
            ],
            polylineDrawTools: [
              Editor.CREATE_TOOL_POLYLINE,
              Editor.CREATE_TOOL_FREEHAND_POLYLINE
            ]
          }
        };
        for (var attr in this._configEditor) {
          settings[attr] = this._configEditor[attr];
        }
        settings.layerInfos = this._getLayerInfosParam();
        settings.templatePicker = this._getTemplatePicker(settings.layerInfos);

        return settings;
      },

      _createEditor: function() {
        var params = {
          settings: this._getSettingsParam()
        };
        this._worksBeforeCreate(params.settings);
        //var it = lang.clone(params.settings.layerInfos[0].featureLayer.infoTemplate);
        //params.settings.layerInfos[0].featureLayer = new esri.layers.FeatureLayer(params.settings.layerInfos[0].featureLayer.url.replace("FeatureServer","MapServer"),{})
        //params.settings.layerInfos[0].featureLayer.setInfoTemplate(it);
        this.editor = new Editor(params, html.create("div", {}, this.domNode));
        this.editor.startup();
        this._worksAfterCreate();
      },

      _addButtonToInspector: function() {
        var closeButton = new Button({
          label: esriBundle.common.close,
          "class": " atiButton closeButton"
        }, html.create("div"));

        html.place(closeButton.domNode,
                   this.editor.attributeInspector.deleteBtn.domNode,
                   "after");
        this.own(on(closeButton, 'click', lang.hitch(this, function() {
          this.editPopup.hide();
        })));
      },

      _update: function() {
        if(this.editor){
          this.editor.templatePicker.update();
        }
      },

      resize: function() {
        this._update();
      },

      onClose: function() {
        if (this.editor) {
          this.editor.destroy();
        }
        this.editor = null;
        // close method will call onDeActive automaticlly
        // so do not need to call onDeActive();
        this._worksAfterClose();
      },

      _worksBeforeCreate: function(settings) {
        // change string of mouse tooltip
        var additionStr = "<br/>" + "(" + this.nls.pressStr + "<b>" +
          this.nls.ctrlStr + "</b> " + this.nls.snapStr + ")";
        this._defaultStartStr = esriBundle.toolbars.draw.start;
        this._defaultAddPointStr = esriBundle.toolbars.draw.addPoint;
        esriBundle.toolbars.draw.start =
          esriBundle.toolbars.draw.start + additionStr;
        esriBundle.toolbars.draw.addPoint =
          esriBundle.toolbars.draw.addPoint + additionStr;

        // hide label layer.
        var labelLayer = this.map.getLayer("labels");
        if(labelLayer) {
          labelLayer.hide();
        }

        // change layer name
        array.forEach(settings.layerInfos, function(layerInfo) {
          var jimuLayerInfo =
            this._jimuLayerInfos.getLayerInfoByTopLayerId(layerInfo.featureLayer.id);
          if(jimuLayerInfo) {
            layerInfo.featureLayer.name = jimuLayerInfo.title;
          }
        }, this);
      },

      _worksAfterCreate: function() {
        // add close button to atiInspector
        this._addButtonToInspector();
        // resize editPopup
        this.editPopup.resize(500, 251);
        // update templatePicker for responsive.
        this.editor.templatePicker.update();
        //just for BoxTheme
        setTimeout(lang.hitch(this, this._update), 900);
        // // reset default selectionSymbol that change by Editor dijit.
        // array.forEach(this.editor.settings.layerInfos, function(layerInfo) {
        //   layerInfo.featureLayer.setSelectionSymbol();
        // }, this);
      },

      _worksAfterClose: function() {
        esriBundle.toolbars.draw.start = this._defaultStartStr;
        esriBundle.toolbars.draw.addPoint = this._defaultAddPointStr;

        // show lable layer.
        var labelLayer = this.map.getLayer("labels");
        if(labelLayer) {
          labelLayer.show();
        }
      },

      onNormalize: function(){
        setTimeout(lang.hitch(this, this._update), 100);
      },

      onMinimize: function(){
      },

      onMaximize: function(){
        setTimeout(lang.hitch(this, this._update), 100);
      }
    });
  });