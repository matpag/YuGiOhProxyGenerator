define(["react", "react-class", "draw/Canvas", "./layout/All", "./Attributes", "./Stars", "./Icons", "./Rarities", "./Template"], function App(React, ReactClass, Canvas, Layouts, Attributes, Stars, Icons, Rarities, Template)
{
	var Card = ReactClass({
		render: function render()
		{	
			return React.createElement(
				Canvas,
				{
					width: this.props.pixelWidth || Template.width,
					height: this.props.pixelHeight || Template.height,
					logicalWidth: Template.width, logicalHeight: Template.height,
					className: "ygo card"
				},
				React.createElement(
					Layouts[this.props.layout].fn,
					this.props
				)
			);
		}
	});
	Card.defaultProps = { layout: "Normal" };
	Card.displayName = "Card";
	Card.Layout = Layouts;
	Card.Attributes = Attributes;
	Card.Stars = Stars;
	Card.Icons = Icons;
	Card.Rarities = Rarities;
	return Card;
});
