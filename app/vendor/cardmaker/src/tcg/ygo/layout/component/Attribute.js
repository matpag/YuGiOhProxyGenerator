define(["react", "react-class", "../../Attributes", "draw/Image", "../../Template"], function Attribute(React, ReactClass, Attributes, Image, Template)
{
	var Attribute = ReactClass({
		render: function render()
		{
			var props = Object.assign({}, this.props, {
				// Maps the attribute to a path name
				src: Attributes[this.props.value].url,
				style: Template.attribute
			});
			return React.createElement(Image, props);
		}
	});
	Attribute.displayName = "Attribute";
	Attribute.defaultProps = {
		value: "None",
	};
	
	return Attribute;
});
