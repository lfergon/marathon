/** @jsx React.DOM */

var $ = require("jquery");
var _ = require("underscore");
var React = require("react/addons");
var BackboneMixin = require("../mixins/BackboneMixin");
var App = require("../models/App");
var FormGroupComponent = require("../components/FormGroupComponent");
var ModalComponent = require("../components/ModalComponent");

function ValidationError(attribute, message) {
  this.attribute = attribute;
  this.message = message;
}

var NewAppModalComponent = React.createClass({
  displayName: "NewAppModalComponent",
  mixins: [BackboneMixin],
  propTypes: {
    onCreate: React.PropTypes.func,
    onDestroy: React.PropTypes.func
  },

  getDefaultProps: function () {
    return {
      onCreate: $.noop,
      onDestroy: $.noop
    };
  },

  getInitialState: function () {
    return {
      model: new App(),
      parametersCount: 0,
      volumesCount: 0,
      errors: []
    };
  },

  destroy: function () {
    // This will also call `this.props.onDestroy` since it is passed as the
    // callback for the modal's `onDestroy` prop.
    this.refs.modalComponent.destroy();
  },

  addParameters: function () {
    this.setState({parametersCount: this.state.parametersCount + 1});
  },

  removeParameters: function () {
    this.setState({parametersCount: this.state.parametersCount - 1});
  },

  addVolumes: function () {
    this.setState({volumesCount: this.state.volumesCount + 1});
  },

  removeVolumes: function () {
    this.setState({volumesCount: this.state.volumesCount - 1});
  },

  toggleSettings: function () {
    $(".settings").toggle();
  },

  toggleDocker: function () {
    $(".docker-settings").toggle();
  },

  getResource: function () {
    return this.state.model;
  },

  clearValidation: function () {
    this.setState({errors: []});
  },

  validateResponse: function (response) {
    var errors;

    if (response.status === 422 && response.responseJSON != null &&
        _.isArray(response.responseJSON.errors)) {
      errors = response.responseJSON.errors.map(function (e) {
        return new ValidationError(
          // Errors that affect multiple attributes provide a blank string. In
          // that case, count it as a "general" error.
          e.attribute.length < 1 ? "general" : e.attribute,
          e.error
        );
      });
    } else if (response.status >= 500) {
      errors = [
        new ValidationError("general", "Server error, could not create app.")
      ];
    } else {
      errors = [
        new ValidationError(
          "general",
          "App creation unsuccessful. Check your connection and try again."
        )
      ];
    }

    this.setState({errors: errors});
  },

  onSubmit: function (event) {
    event.preventDefault();

    var attrArray = $(event.target).serializeArray();
    var modelAttrs = {};

    for (var i = 0; i < attrArray.length; i++) {
      var val = attrArray[i];
      if (val.value !== "") {
        modelAttrs[val.name] = val.value;
      }
    }

    // URIs should be an Array of Strings.
    if ("uris" in modelAttrs) {
      modelAttrs.uris = modelAttrs.uris.split(",");
    } else {
      modelAttrs.uris = [];
    }

    // Constraints should be an Array of Strings.
    if ("constraints" in modelAttrs) {
      var constraintsArray = modelAttrs.constraints.split(",");
      modelAttrs.constraints = constraintsArray.map(function (constraint) {
        return constraint.split(":").map(function (value) {
          return value.trim();
        });
      });
    }

    // Ports should always be an Array.
    if ("ports" in modelAttrs) {
      var portStrings = modelAttrs.ports.split(",");
      modelAttrs.ports = _.map(portStrings, function (p) {
        var port = parseInt(p, 10);
        return _.isNaN(port) ? p : port;
      });
    } else {
      modelAttrs.ports = [];
    }

    // mem, cpus, and instances are all Numbers and should be parsed as such.
    if ("mem" in modelAttrs) {
      modelAttrs.mem = parseFloat(modelAttrs.mem);
    }
    if ("cpus" in modelAttrs) {
      modelAttrs.cpus = parseFloat(modelAttrs.cpus);
    }
    if ("disk" in modelAttrs) {
      modelAttrs.disk = parseFloat(modelAttrs.disk);
    }
    if ("instances" in modelAttrs) {
      modelAttrs.instances = parseInt(modelAttrs.instances, 10);
    }
    if ("privileges" in modelAttrs) {
      if (modelAttrs.privileges === "true") {
        modelAttrs.instances = true;
      }
    }

    this.state.model.set(modelAttrs);

    if (this.state.model.isValid()) {
      this.props.onCreate(
        this.state.model,
        {
          error: function (model, response) {
            this.validateResponse(response);
            if (response.status < 300) {
              this.clearValidation();
              this.destroy();
            }
          }.bind(this),
          success: function () {
            this.clearValidation();
            this.destroy();
          }.bind(this),

          // Wait to add the model to the collection until a successful
          // response code is received from the server.
          wait: true
        }
      );
    }
  },

  render: function () {
    var model = this.state.model;
    var errors = this.state.errors;

    var generalErrors = errors.filter(function (e) {
      return (e.attribute === "general");
    });

    var inputs = [];
    for (var i = 0; i < this.state.parametersCount; i++) {
      inputs.push(i);
    }

    /* jshint trailing:false, quotmark:false, newcap:false */
    /* jscs:disable disallowTrailingWhitespace, validateQuoteMarks, maximumLineLength */
    var errorBlock = generalErrors.map(function (error, i) {
      return <p key={i} className="text-danger"><strong>{error.message}</strong></p>;
    });

    return (
      <ModalComponent ref="modalComponent" onDestroy={this.props.onDestroy}>
        <form method="post" role="form" onSubmit={this.onSubmit}>
          <div className="modal-header">
            <button type="button" className="close"
              aria-hidden="true" onClick={this.destroy}>&times;</button>
            <h3 className="modal-title">New Application</h3>
          </div>
          <div className="modal-body">
            <div className="row">
              <FormGroupComponent
                  attribute="id"
                  label="ID"
                  model={model}
                  errors={errors}>
                <input autoFocus required />
              </FormGroupComponent>
            </div>
            <div className="row">
              <div className="col-md-3">
                <FormGroupComponent
                    attribute="cpus"
                    label="CPUs"
                    model={model}
                    errors={errors}>
                  <input min="0" step="any" 
                    type="number" required />
                </FormGroupComponent>
              </div>
              <div className="col-md-3">
                <FormGroupComponent
                    attribute="mem"
                    label="Memory (MB)"
                    model={model}
                    errors={errors}>
                  <input min="0" step="any"
                    type="number" required />
                </FormGroupComponent>
              </div>
              <div className="col-md-3">
                <FormGroupComponent
                    attribute="disk"
                    label="Disk Space (MB)"
                    model={model}
                    errors={errors}>
                  <input min="0" step="any"
                    type="number" required />
                </FormGroupComponent>
              </div>
              <div className="col-md-3">
                <FormGroupComponent
                    attribute="instances"
                    label="Instances"
                    model={model}
                    errors={errors}>
                  <input min="1" step="1"
                    type="number" required />
                </FormGroupComponent>
              </div>
            </div>
            <h4>Optional Settings</h4>
            <FormGroupComponent
                attribute="cmd"
                label="Command"
                model={model}
                errors={errors}>
              <textarea style={{resize: "vertical"}} />
            </FormGroupComponent>
            <div className="row">
              <button className="btn btn-success" onClick={this.toggleSettings}>
                Hide optional settings
              </button>
            </div>
            <div className="row settings">
              <FormGroupComponent
                  attribute="ports"
                  help="Comma-separated list of numbers. 
                  0's (zeros) assign random ports. (Default: one random port)"
                  label="Ports"
                  model={model}
                  errors={errors}>
                <input />
              </FormGroupComponent>
              <FormGroupComponent
                  attribute="uris"
                  help="Comma-separated list of valid URIs."
                  label="URIs"
                  model={model}
                  errors={errors}>
                <input />
              </FormGroupComponent>
              <FormGroupComponent
                  attribute="constraints"
                  help='Comma-separated list of valid constraints.
                   Valid constraint format is "field:operator[:value]".'
                  label="Constraints"
                  model={model}
                  errors={errors}>
                <input />
              </FormGroupComponent>
            </div>
            <div className="row">
              <button className="btn btn-success" onClick={this.toggleDocker}>
                Hide docker container settings
              </button>
            </div>
            <div className="docker-settings">
              <div className="row">
                <div className="col-md-6">
                  <FormGroupComponent
                      attribute="image"
                      help='Image for docker'
                      label="Image"
                      model={model}
                      errors={errors}>
                    <input />
                  </FormGroupComponent>
                </div>
                <div className="col-md-6">
                  <FormGroupComponent
                      attribute="network"
                      help='Network host'
                      label="Network"
                      model={model}
                      errors={errors}>
                    <select>
                      <option value="host">Host</option>
                      <option value="host_two">Host two</option>
                    </select>
                  </FormGroupComponent>
                </div>
              </div>
              <h4>Privileges</h4>
              <FormGroupComponent
                  attribute="privileges"
                  help='Select to give this container access to all devices on the host'
                  label="Extend runtime privileges to this container"
                  model={model}
                  errors={errors}>
                <input type="checkbox" value="true"/>
              </FormGroupComponent>
              <h4>Parameters</h4>
              <div className="row">
                <div className="col-md-5">
                  <FormGroupComponent
                      attribute="key"
                      label="Key"
                      model={model}
                      errors={errors}>
                    <input />
                  </FormGroupComponent>
                </div>
                <div className="col-md-5">
                  <FormGroupComponent
                      attribute="value"
                      label="Value"
                      model={model}
                      errors={errors}>
                    <input />
                  </FormGroupComponent>
                </div>
                <div className="col-md-1">
                  <button className="btn btn-default" 
                    type="button" onClick={this.addParameters}>
                    +
                  </button>
                </div>
                <div className="col-md-1">
                  <button className="btn btn-default" 
                    type="button" onClick={this.removeParameters}>
                    -
                  </button>
                </div>
              </div>
              <h4>Volumes</h4>
              <div className="row">
                <div className="col-md-3">
                  <FormGroupComponent
                      attribute="container_path"
                      label="Container path"
                      model={model}
                      errors={errors}>
                    <input />
                  </FormGroupComponent>
                </div>
                <div className="col-md-3">
                  <FormGroupComponent
                      attribute="host_path"
                      label="Host path"
                      model={model}
                      errors={errors}>
                    <input />
                  </FormGroupComponent>
                </div>
                <div className="col-md-3">
                  <FormGroupComponent
                      attribute="mode"
                      label="Mode"
                      model={model}
                      errors={errors}>
                    <select>
                      <option value="read">Read only</option>
                      <option value="write">Write - Read</option>
                      <option value="admin">Admin</option>
                    </select>
                  </FormGroupComponent>
                </div>
                <div className="col-md-1">
                  <button className="btn btn-default" 
                    type="button" onClick={this.addVolumes}>
                    +
                  </button>
                </div>
                <div className="col-md-1">
                  <button className="btn btn-default" 
                    type="button" onClick={this.removeVolumes}>
                    -
                  </button>
                </div>
              </div>
            </div>
            <div>
              {errorBlock}
              <input type="submit" className="btn btn-success" 
                value="+ Create" /> 
              <button className="btn btn-default" 
                type="button" onClick={this.destroy}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      </ModalComponent>
    );
  }
});

module.exports = NewAppModalComponent;
