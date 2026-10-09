define(["react", "react-class", "draw/Text", "../../Template"], function Copyright(React, ReactClass, Text, Template)
{
	var Copyright = ReactClass({
		render: function render()
		{
			return React.createElement(Text, { text: this.props.value, style: Object.assign({
				fontFamily: ["ITC Stone Serif LT", "serif"],
				color: this.props.color,
				fontSize: 12,
				textAlign: "right",
				whitespace: "nowrap",

			}, Template.footer.copyright), canvas: this.props.canvas, repaint: this.props.repaint })
		}
	});
	Copyright.displayName = "Copyright";
	Copyright.defaultProps = {
		value: "",
		color: "black"
	};
	return Copyright;
});
