define(["react", "react-class", "draw/Text", "../../Template"], function Id(React, ReactClass, Text, Template)
{
	var shared = {
			fontFamily: ["ITC Stone Serif LT", "serif"],
			fontSize: 12,
			whitespace: "nowrap",

			height: undefined
	}
	var styles = {
		regular: Object.assign({textAlign: "right"}, Template.id.regular),
		pendulum: Object.assign({textAlign: "left", color: "black"}, Template.id.pendulum),
		link: Object.assign({textAlign: "right"}, Template.id.link)
	};

	var Id = ReactClass({
		render: function render()
		{
			return React.createElement(Text, { text: this.props.value, style: Object.assign({color: this.props.color}, shared, styles[this.props.position]), canvas: this.props.canvas, repaint: this.props.repaint })
		}
	});
	Id.displayName = "Id";
	Id.defaultProps = {
		value: "",
		color: "black",
		position: "regular"
	};
	return Id;
});
