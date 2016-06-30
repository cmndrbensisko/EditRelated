define(
  ["dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/text!./EditFields.html",
    'dijit/_TemplatedMixin',
    'jimu/BaseWidgetSetting',
    'jimu/dijit/SimpleTable',
    "jimu/dijit/Popup"
  ],
  function(
    declare,
    lang,
    array,
    template,
    _TemplatedMixin,
    BaseWidgetSetting,
    Table,
    Popup) {
    return declare([BaseWidgetSetting, _TemplatedMixin], {
      baseClass: "jimu-widget-edit-setting-fields",
      templateString: template,
      _layerInfo: null,

      postCreate: function() {
        this.inherited(arguments);
        this.nls = lang.mixin(this.nls, window.jimuNls.common);
        this._initFieldsTable();
        this._setFiedsTabele(this._layerInfo.fieldInfos);
        this._checkForRelationships(this._layerInfo)
      },

      _checkForRelationships: function(layerInfo){
        var layerObject = this._viewerMap.getLayer(layerInfo.featureLayer.id);
        if (layerObject.relationships && layerObject.type == "Feature Layer"){
          array.forEach(layerObject.relationships,lang.hitch(this,function(relationship){
            var str = layerObject.url.substr(layerObject.url.lastIndexOf('/') + 1);
            var relatedUrl = layerObject.url.replace( new RegExp(str), '' ) + relationship.relatedTableId;
            esri.request({"url":relatedUrl,"content":{"f":"json"}}).then(lang.hitch(this, function(response,io){
              array.forEach(response.fields, lang.hitch(this,function(fieldInfo){
                this._fieldsTable.addRow({
                  fieldName: "[R]" + fieldInfo.name,
                  isEditable: fieldInfo.editable,
                  label: fieldInfo.alias
                });
              }))
            }))
          }))
        }
      },

      popupEditPage: function() {
        var fieldsPopup = new Popup({
          titleLabel: this.nls.configureFields,
          width: 640,
          maxHeight: 600,
          autoHeight: true,
          content: this,
          buttons: [{
            label: this.nls.ok,
            onClick: lang.hitch(this, function() {
              this._resetFieldInfos();
              fieldsPopup.close();
            })
          }, {
            label: this.nls.cancel,
            onClick: lang.hitch(this, function() {
              fieldsPopup.close();
            })
          }],
          onClose: lang.hitch(this, function() {
          })
        });
      },

      _initFieldsTable: function() {
        var fields2 = [{
          name: 'isEditable',
          title: this.nls.edit,
          type: 'checkbox',
          'class': 'editable'
        }, {
          name: 'fieldName',
          title: this.nls.editpageName,
          type: 'text'
        }, {
          name: 'label',
          title: this.nls.editpageAlias,
          type: 'text',
          editable: true
        }, {
          name: 'actions',
          title: this.nls.actions,
          type: 'actions',
          actions: ['up', 'down'],
          'class': 'editable'
        }];
        var args2 = {
          fields: fields2,
          selectable: false,
          style: {
            'height': '300px',
            'maxHeight': '300px'
          }
        };
        this._fieldsTable = new Table(args2);
        this._fieldsTable.placeAt(this.fieldsTable);
        this._fieldsTable.startup();
      },

      _setFiedsTabele: function(fieldInfos) {
        array.forEach(fieldInfos, function(fieldInfo) {
          this._fieldsTable.addRow({
            fieldName: fieldInfo.fieldName,
            isEditable: fieldInfo.isEditable,
            label: fieldInfo.label
          });
        }, this);
      },

      _resetFieldInfos: function() {
        var newFieldInfos = [];
        var fieldsTableData =  this._fieldsTable.getData();
        array.forEach(fieldsTableData, function(fieldData) {
          newFieldInfos.push({
            "fieldName": fieldData.fieldName,
            "label": fieldData.label,
            "isEditable": fieldData.isEditable
          });
        });

        this._layerInfo.fieldInfos = newFieldInfos;
      }

    });
  });